import pandas as pd
import re
import os

REAL_DATA_DIR = 'data/real'
PROCESSED_DIR = 'data/processed'
os.makedirs(PROCESSED_DIR, exist_ok=True)

def parse_nasa_logs(file_path):
    print(f"Parsing NASA logs: {file_path}")
    # Regex for NASA log format
    # 199.72.81.55 - - [01/Jul/1995:00:00:01 -0400] "GET /history/apollo/ HTTP/1.0" 200 6245
    regex = r'^(\S+) - - \[([^\]]+)\] "(\S+) (\S+) (\S+)" (\d+) (\d+|-)$'
    
    data = []
    with open(file_path, 'r', encoding='latin-1') as f:
        for line in f:
            match = re.match(regex, line.strip())
            if match:
                ip, timestamp, method, path, proto, status, size = match.groups()
                data.append({
                    'ip': ip,
                    'timestamp': timestamp,
                    'method': method,
                    'path': path,
                    'status': int(status),
                    'size': 0 if size == '-' else int(size)
                })
    
    df = pd.DataFrame(data)
    # Basic cleaning
    df['timestamp'] = pd.to_datetime(df['timestamp'], format='%d/%b/%Y:%H:%M:%S -0400')
    print(f"✅ Parsed {len(df)} NASA log records")
    return df

def preprocess_mindweave(file_path):
    print(f"Preprocessing Mindweave logs: {file_path}")
    df = pd.read_csv(file_path)
    # Mindweave is already clean, but let's standardize
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    print(f"[SUCCESS] Loaded {len(df)} Mindweave records")
    return df

def preprocess_nab(file_path):
    print(f"Preprocessing NAB Time Series: {file_path}")
    df = pd.read_csv(file_path)
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
    # Rename 'value' to a generic metric name for our pipeline
    if 'value' in df.columns:
        df['metric_value'] = df['value']
    print(f"[SUCCESS] Loaded {len(df)} NAB records")
    return df

def main():
    # 1. Mindweave
    mw_path = os.path.join(REAL_DATA_DIR, 'mindweave_logs.csv')
    if os.path.exists(mw_path):
        mw_df = preprocess_mindweave(mw_path)
        mw_df.to_csv(os.path.join(PROCESSED_DIR, 'mindweave_processed.csv'), index=False)

    # 2. NAB
    nab_path = os.path.join('data/nab_repo/data/realAWSCloudwatch', 'grok_asg_anomaly.csv')
    if os.path.exists(nab_path):
        nab_df = preprocess_nab(nab_path)
        nab_df.to_csv(os.path.join(PROCESSED_DIR, 'nab_processed.csv'), index=False)

    print("\n[FINISH] Preprocessing Complete!")

if __name__ == "__main__":
    main()

import os
import requests
import gzip
import shutil
from datasets import load_dataset

DATA_DIR = 'data/real'
os.makedirs(DATA_DIR, exist_ok=True)

def download_mindweave():
    print("--- 1. Downloading Mindweave Web Server Logs (Hugging Face) ---")
    try:
        dataset = load_dataset("mindweave/web-server-logs", split='train', trust_remote_code=True)
        df = dataset.to_pandas()
        df.to_csv(os.path.join(DATA_DIR, 'mindweave_logs.csv'), index=False)
        print(f"[SUCCESS] Saved Mindweave logs ({len(df)} records)")
    except Exception as e:
        print(f"[ERROR] Failed to download Mindweave: {e}")

def download_nasa():
    print("--- 2. Downloading NASA Access Logs (UCI) ---")
    files = ["NASA_access_log_Jul95.gz"]
    base_url = "https://archive.ics.uci.edu/ml/machine-learning-databases/nasa-http/"
    
    for f in files:
        target_gz = os.path.join(DATA_DIR, f)
        target_log = target_gz.replace('.gz', '')
        
        if not os.path.exists(target_log):
            print(f"Downloading {f}...")
            r = requests.get(base_url + f, stream=True)
            with open(target_gz, 'wb') as out:
                shutil.copyfileobj(r.raw, out)
            
            print(f"Decompressing {f}...")
            with gzip.open(target_gz, 'rb') as f_in:
                with open(target_log, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            os.remove(target_gz)
            print(f"[SUCCESS] Saved {target_log}")
        else:
            print(f"[SUCCESS] {f} already exists.")

def download_nab():
    print("--- 3. Downloading NAB (Numenta Anomaly Benchmark) ---")
    files = [
        "realAWSCloudwatch/cpu_utilization_asg_misconfiguration.csv",
        "realTraffic/occupancy_t4011.csv"
    ]
    base_url = "https://raw.githubusercontent.com/numenta/NAB/master/data/"
    
    for f in files:
        target = os.path.join(DATA_DIR, os.path.basename(f))
        print(f"Downloading {f}...")
        r = requests.get(base_url + f)
        with open(target, 'wb') as out:
            out.write(r.content)
        print(f"[SUCCESS] Saved {target}")

if __name__ == "__main__":
    download_mindweave()
    download_nasa()
    download_nab()
    print("\n[FINISH] Step 2: Transition to Real Data - Download Complete!")

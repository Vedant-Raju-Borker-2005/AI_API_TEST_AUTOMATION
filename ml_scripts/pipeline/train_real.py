import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import joblib
import os
import sys
import json

# Paths relative to this script to ensure they work regardless of CWD
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROCESSED_DATA = os.path.join(BASE_DIR, '../data/processed/mindweave_processed.csv')
MODELS_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE_DIR, '../../backend/ml/models')
os.makedirs(MODELS_DIR, exist_ok=True)

def train_real_pipeline():
    print("--- Step 3: Model Improvement (Training on Real Data) ---")
    
    if not os.path.exists(PROCESSED_DATA):
        print(f"[ERROR] Processed data not found at {PROCESSED_DATA}")
        return

    df = pd.read_csv(PROCESSED_DATA)
    print(f"Loaded {len(df)} real-world log records.")

    # 1. Feature Engineering (Aligning Real Data to Backend Schema)
    print("Engineering features from real logs to match Production Schema...")
    
    # Calculate aggregated stats per endpoint (path)
    endpoint_stats = df.groupby('path').agg(
        total_requests=('status_code', 'count'),
        failures=('status_code', lambda x: (x >= 400).sum()),
        avg_rt=('response_time_ms', 'mean'),
        rt_std=('response_time_ms', 'std')
    ).reset_index()
    
    endpoint_stats['historical_failure_rate'] = endpoint_stats['failures'] / endpoint_stats['total_requests']
    endpoint_stats['flakiness'] = endpoint_stats['rt_std'].fillna(0) / endpoint_stats['avg_rt']
    # Normalize flakiness
    endpoint_stats['flakiness'] = np.clip(endpoint_stats['flakiness'] / endpoint_stats['flakiness'].max(), 0, 1)

    # 1b. Advanced & Security Feature Engineering (IP and Signatures)
    print("Engineering IP and Security Features...")
    # Calculate aggregated stats per IP address
    if 'ip_address' in df.columns:
        ip_stats = df.groupby('ip_address').agg(
            request_frequency_per_ip=('status_code', 'count'),
            ip_failures=('status_code', lambda x: (x >= 400).sum())
        ).reset_index()
        ip_stats['error_rate_per_ip'] = ip_stats['ip_failures'] / ip_stats['request_frequency_per_ip']
        
        # Suspicious IP if error rate > 50% AND > 5 requests, or if making > 100 requests in dataset
        ip_stats['suspicious_ip_flag'] = (
            ((ip_stats['error_rate_per_ip'] > 0.5) & (ip_stats['request_frequency_per_ip'] > 5)) |
            (ip_stats['request_frequency_per_ip'] > 100)
        ).astype(int)
        
        df = df.merge(ip_stats[['ip_address', 'request_frequency_per_ip', 'error_rate_per_ip', 'suspicious_ip_flag']], on='ip_address', how='left')
    else:
        # Fallback if no IP in data
        df['request_frequency_per_ip'] = 1
        df['error_rate_per_ip'] = 0.0
        df['suspicious_ip_flag'] = 0

    # Attack Signature in Path (SQLi, XSS keywords)
    attack_keywords = ['union', 'select', 'script', 'drop', '%27', '%20', 'exec', 'alert']
    df['attack_signature'] = df['path'].str.lower().apply(
        lambda x: 1 if any(kw in str(x) for kw in attack_keywords) else 0
    )

    # Merge stats back to main df
    df = df.merge(endpoint_stats[['path', 'historical_failure_rate', 'avg_rt', 'flakiness']], on='path', how='left')
    df['avg_response_time'] = df['avg_rt']

    # Map HTTP Method to Risk
    method_risk_map = {'GET': 1, 'POST': 2, 'PUT': 3, 'PATCH': 3, 'DELETE': 4}
    df['method_risk'] = df['method'].map(method_risk_map).fillna(1)

    # Synthetic extraction for param_count and field_count based on path complexity
    df['param_count'] = df['path'].apply(lambda x: len(str(x).split('?')) - 1 if '?' in str(x) else str(x).count('/') - 1)
    df['field_count'] = np.random.randint(0, 10, len(df)) # Simulated
    df['category_weight'] = np.random.choice([1, 2, 3, 5], len(df)) # Simulated

    FEATURES = [
        'historical_failure_rate', 'param_count', 'field_count',
        'category_weight', 'method_risk', 'avg_response_time', 'flakiness',
        'request_frequency_per_ip', 'error_rate_per_ip', 'suspicious_ip_flag', 'attack_signature'
    ]
    X = df[FEATURES].fillna(0).values

    # Generate heuristic labels for training (Incorporating Security Risk)
    df['priority_label'] = np.clip(
        0.4 * df['historical_failure_rate'] + 0.2 * (df['method_risk'] / 4) + 0.2 * df['flakiness'] + 0.2 * df['suspicious_ip_flag'], 0, 1
    )
    df['risk_label'] = np.clip(
        1 + 9 * (df['historical_failure_rate'] + (df['avg_response_time'] / df['avg_response_time'].max()) + df['attack_signature']), 1, 10
    )

    # 2. Anomaly Detection (Isolation Forest)
    print("Training Isolation Forest on real traffic patterns...")
    iso = IsolationForest(n_estimators=200, contamination=0.05, random_state=42)
    iso.fit(X)
    preds_iso = iso.predict(X)
    anomalies_detected = (preds_iso == -1).sum()
    print(f"[METRIC] Real Data Anomaly Rate Detected: {anomalies_detected / len(X):.2%}")
    joblib.dump(iso, os.path.join(MODELS_DIR, 'anomaly_iso.pkl'))

    # Train Priority
    print("Training Priority Regressor (Random Forest)...")
    from sklearn.metrics import mean_squared_error, r2_score
    rf_prio = RandomForestRegressor(n_estimators=100, random_state=42)
    rf_prio.fit(X, df['priority_label'])
    p_preds = rf_prio.predict(X)
    print(f"[METRIC] Priority Model MSE: {mean_squared_error(df['priority_label'], p_preds):.4f}, R2: {r2_score(df['priority_label'], p_preds):.4f}")
    joblib.dump(rf_prio, os.path.join(MODELS_DIR, 'priority_xgb.pkl'))

    # Train Risk
    print("Training Risk Regressor (Random Forest)...")
    rf_risk = RandomForestRegressor(n_estimators=100, random_state=42)
    rf_risk.fit(X, df['risk_label'])
    r_preds = rf_risk.predict(X)
    print(f"[METRIC] Risk Model MSE: {mean_squared_error(df['risk_label'], r_preds):.4f}, R2: {r2_score(df['risk_label'], r_preds):.4f}")
    joblib.dump(rf_risk, os.path.join(MODELS_DIR, 'risk_rf.pkl'))

    # 4. Phase 4: Iterative Improvement (Stress Testing Robustness)
    print("--- Stress Testing Anomaly Detection ---")
    # Simulate a DDoS/Error spike attack
    stress_df = pd.DataFrame({
        'historical_failure_rate': np.random.uniform(0.8, 1.0, 500), # Very high failure rate
        'param_count': np.random.randint(15, 30, 500), # High complexity
        'field_count': np.random.randint(15, 30, 500),
        'category_weight': [5] * 500, # Critical category
        'method_risk': [4] * 500, # DELETE/High risk
        'avg_response_time': np.random.uniform(5000, 10000, 500), # Very slow
        'flakiness': np.random.uniform(0.7, 1.0, 500), # High instability
        'request_frequency_per_ip': np.random.randint(200, 5000, 500), # Volumetric DDoS
        'error_rate_per_ip': np.random.uniform(0.9, 1.0, 500), # All attacks failing
        'suspicious_ip_flag': [1] * 500, # Flagged
        'attack_signature': [1] * 500 # Contains bad payloads
    })
    
    X_stress = stress_df[FEATURES].values
    stress_preds = iso.predict(X_stress)
    stress_detection_rate = (stress_preds == -1).sum() / len(stress_preds)
    print(f"[METRIC] Stress Test Anomaly Detection Rate (Improved Robustness): {stress_detection_rate:.2%}")

    # 5. Save Feature Map
    with open(os.path.join(MODELS_DIR, 'features.json'), 'w') as f:
        json.dump(FEATURES, f)
    
    print("\n[FINISH] Step 4: Iterative Improvement & Stress Testing Complete!")

if __name__ == "__main__":
    train_real_pipeline()

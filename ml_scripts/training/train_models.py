"""Trains XGBoost (priority), RandomForest (risk), IsolationForest (anomaly)."""
import sys, os, json
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor, IsolationForest
from xgboost import XGBRegressor

# Resolve import
sys.path.insert(0, os.path.dirname(__file__))
from generate_dataset import generate

FEATURES = [
    'historical_failure_rate', 'param_count', 'field_count',
    'category_weight', 'method_risk', 'avg_response_time', 'flakiness'
]

def main(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    df = generate(1000)

    X = df[FEATURES].values
    y_prio = df['priority_score'].values
    y_risk = df['risk_score'].values

    print("Training XGBoost (priority)...")
    xgb = XGBRegressor(n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42)
    xgb.fit(X, y_prio)
    joblib.dump(xgb, os.path.join(out_dir, 'priority_xgb.pkl'))

    print("Training RandomForest (risk)...")
    rf = RandomForestRegressor(n_estimators=150, max_depth=10, random_state=42)
    rf.fit(X, y_risk)
    joblib.dump(rf, os.path.join(out_dir, 'risk_rf.pkl'))

    print("Training IsolationForest (anomaly)...")
    iso = IsolationForest(n_estimators=150, contamination=0.08, random_state=42)
    iso.fit(X)
    joblib.dump(iso, os.path.join(out_dir, 'anomaly_iso.pkl'))

    # Feature list
    with open(os.path.join(out_dir, 'features.json'), 'w') as f:
        json.dump(FEATURES, f)

    print(f"✅ Models saved to {out_dir}")

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else './models'
    main(out)

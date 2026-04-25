"""Reads JSON from stdin, outputs predictions as JSON."""
import sys, os, json
import numpy as np
import joblib

def main(models_dir):
    try:
        payload = json.loads(sys.stdin.read())
    except Exception:
        print(json.dumps([]))
        return

    features_list = payload.get('features', [])
    if not features_list:
        print(json.dumps([]))
        return

    with open(os.path.join(models_dir, 'features.json')) as f:
        FEATURES = json.load(f)

    xgb = joblib.load(os.path.join(models_dir, 'priority_xgb.pkl'))
    rf = joblib.load(os.path.join(models_dir, 'risk_rf.pkl'))
    iso = joblib.load(os.path.join(models_dir, 'anomaly_iso.pkl'))

    X = np.array([[f[k] for k in FEATURES] for f in features_list])

    prio = np.clip(xgb.predict(X), 0, 1)
    risk = np.clip(rf.predict(X), 1, 10)
    anomaly = (iso.predict(X) == -1).astype(int)

    out = [
        {'priority_score': float(p), 'risk_score': float(r), 'anomaly': int(a)}
        for p, r, a in zip(prio, risk, anomaly)
    ]
    print(json.dumps(out))

if __name__ == '__main__':
    models = sys.argv[1] if len(sys.argv) > 1 else './models'
    main(models)

"""Synthesizes a training dataset simulating API test features + outcomes."""
import numpy as np
import pandas as pd

np.random.seed(42)

def generate(n=800):
    rows = []
    for _ in range(n):
        hfr = np.random.beta(2, 8)  # historical failure rate
        params = np.random.randint(0, 10)
        fields = np.random.randint(0, 12)
        cat_w = np.random.choice([1, 2, 3, 5], p=[0.4, 0.25, 0.2, 0.15])
        method_risk = np.random.choice([1, 2, 3, 4])
        avg_rt = np.random.gamma(2, 200)
        flakiness = np.random.beta(2, 6)

        # Priority: higher when failure-rate, category-weight, flakiness high
        priority = np.clip(
            0.3 * hfr + 0.2 * (cat_w / 5) + 0.2 * (method_risk / 4) +
            0.15 * flakiness + 0.15 * min(1, params / 10) + np.random.normal(0, 0.05),
            0, 1
        )

        # Risk: similar but includes response time
        risk = np.clip(
            1 + 9 * (0.25 * hfr + 0.2 * (cat_w / 5) + 0.2 * (method_risk / 4) +
                     0.15 * flakiness + 0.2 * min(1, avg_rt / 3000)) +
            np.random.normal(0, 0.3),
            1, 10
        )

        rows.append({
            'historical_failure_rate': hfr,
            'param_count': params,
            'field_count': fields,
            'category_weight': cat_w,
            'method_risk': method_risk,
            'avg_response_time': avg_rt,
            'flakiness': flakiness,
            'priority_score': priority,
            'risk_score': risk,
        })
    return pd.DataFrame(rows)

if __name__ == '__main__':
    df = generate(1000)
    df.to_csv('dataset.csv', index=False)
    print(f"Generated {len(df)} rows")

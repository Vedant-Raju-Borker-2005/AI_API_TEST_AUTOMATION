import pandas as pd
import numpy as np
import random
from datetime import datetime, timedelta
import os

def generate_mock_web_logs(num_records=5000, output_path='mock_web_logs.csv'):
    print(f"Generating {num_records} mock web server logs...")
    
    start_time = datetime.now() - timedelta(days=30)
    
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    endpoints = ['/api/users', '/api/orders', '/api/products', '/api/auth/login', '/api/payments']
    status_codes = [200, 201, 400, 401, 403, 404, 500, 502, 503]
    
    data = []
    
    for i in range(num_records):
        # Create some anomalies (10% chance)
        is_anomaly = random.random() < 0.10
        
        timestamp = start_time + timedelta(minutes=i * 5)
        method = random.choice(methods)
        endpoint = random.choice(endpoints)
        
        if is_anomaly:
            # Anomalous patterns: High error rates or very slow response times
            status = random.choice([500, 502, 503, 401])
            response_time = int(np.random.normal(3000, 500)) # Slow response
            bytes_sent = int(np.random.normal(500, 100))
            is_attack = 1
        else:
            # Normal patterns
            status = random.choice([200, 201, 404, 400])
            response_time = int(np.random.normal(150, 50)) # Fast response
            bytes_sent = int(np.random.normal(2000, 500))
            is_attack = 0
            
        data.append({
            'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'method': method,
            'endpoint': endpoint,
            'status_code': status,
            'response_time_ms': max(10, response_time),
            'bytes_sent': max(0, bytes_sent),
            'label': is_attack # 1 for anomaly, 0 for normal
        })
        
    df = pd.DataFrame(data)
    df.to_csv(output_path, index=False)
    print(f"Saved mock web logs to {output_path}")
    return df

def generate_mock_time_series(num_records=1000, output_path='mock_time_series.csv'):
    print(f"Generating {num_records} mock time-series metrics...")
    
    start_time = datetime.now() - timedelta(days=7)
    
    data = []
    for i in range(num_records):
        timestamp = start_time + timedelta(minutes=i * 10)
        
        # Periodic normal traffic pattern (sine wave)
        base_traffic = 500 + 200 * np.sin(i / 10.0)
        
        is_anomaly = random.random() < 0.05
        
        if is_anomaly:
            # Spike in traffic, CPU, and Memory
            cpu_usage = min(100.0, np.random.normal(95.0, 5.0))
            memory_usage = min(100.0, np.random.normal(90.0, 5.0))
            traffic = int(base_traffic * random.uniform(3.0, 5.0))
            label = 1
        else:
            # Normal operations
            cpu_usage = max(0.0, min(100.0, np.random.normal(40.0, 10.0)))
            memory_usage = max(0.0, min(100.0, np.random.normal(50.0, 10.0)))
            traffic = int(base_traffic + np.random.normal(0, 50))
            label = 0
            
        data.append({
            'timestamp': timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            'cpu_usage_percent': round(cpu_usage, 2),
            'memory_usage_percent': round(memory_usage, 2),
            'network_traffic_mb': max(0, traffic),
            'label': label
        })
        
    df = pd.DataFrame(data)
    df.to_csv(output_path, index=False)
    print(f"Saved mock time-series metrics to {output_path}")
    return df

if __name__ == "__main__":
    os.makedirs('data', exist_ok=True)
    generate_mock_web_logs(output_path='data/mock_web_logs.csv')
    generate_mock_time_series(output_path='data/mock_time_series.csv')
    print("Mock data generation complete. Ready for Step 1 pipeline validation.")

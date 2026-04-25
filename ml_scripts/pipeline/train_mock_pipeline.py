import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import LabelEncoder
import os
import pickle

def preprocess_web_logs(df):
    print("Preprocessing Web Logs...")
    # Convert timestamps
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Encode categorical features
    le_method = LabelEncoder()
    df['method_encoded'] = le_method.fit_transform(df['method'])
    
    le_endpoint = LabelEncoder()
    df['endpoint_encoded'] = le_endpoint.fit_transform(df['endpoint'])
    
    # Feature Engineering
    df['hour'] = df['timestamp'].dt.hour
    df['day_of_week'] = df['timestamp'].dt.dayofweek
    
    # Select features for training
    features = ['method_encoded', 'endpoint_encoded', 'status_code', 'response_time_ms', 'bytes_sent', 'hour', 'day_of_week']
    X = df[features]
    y = df['label']
    return X, y, le_method, le_endpoint

def preprocess_time_series(df):
    print("Preprocessing Time Series Metrics...")
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['hour'] = df['timestamp'].dt.hour
    
    features = ['cpu_usage_percent', 'memory_usage_percent', 'network_traffic_mb', 'hour']
    X = df[features]
    y = df['label']
    return X, y

def train_anomaly_model(X, y, dataset_name):
    print(f"\n--- Training Anomaly Model (Isolation Forest) on {dataset_name} ---")
    
    # Train Isolation Forest (unsupervised, but we can evaluate against labels)
    clf = IsolationForest(contamination=0.1, random_state=42)
    clf.fit(X)
    
    # Predict (-1 for anomaly, 1 for normal)
    preds = clf.predict(X)
    
    # Convert predictions to match labels (1 for anomaly, 0 for normal)
    preds_binary = [1 if p == -1 else 0 for p in preds]
    
    print("Evaluation Results:")
    print(classification_report(y, preds_binary))
    
    # Save the model
    os.makedirs('models', exist_ok=True)
    with open(f'models/{dataset_name}_iso_forest.pkl', 'wb') as f:
        pickle.dump(clf, f)
    print(f"Saved {dataset_name} model.")

def train_classifier_model(X, y, dataset_name):
    print(f"\n--- Training Risk Scoring Model (Random Forest) on {dataset_name} ---")
    
    # Train Random Forest (Supervised)
    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X, y)
    
    preds = clf.predict(X)
    
    print("Evaluation Results:")
    print(classification_report(y, preds))
    
    # Save the model
    with open(f'models/{dataset_name}_rf_classifier.pkl', 'wb') as f:
        pickle.dump(clf, f)
    print(f"Saved {dataset_name} model.")

if __name__ == "__main__":
    print("Starting ML Pipeline validation on Mock Data...")
    
    # 1. Load Data
    try:
        web_logs_df = pd.read_csv('data/mock_web_logs.csv')
        time_series_df = pd.read_csv('data/mock_time_series.csv')
    except FileNotFoundError:
        print("Mock data not found. Please run generate_mock_data.py first.")
        exit(1)
        
    # 2. Preprocess & Feature Engineering
    X_web, y_web, le_method, le_endpoint = preprocess_web_logs(web_logs_df)
    X_ts, y_ts = preprocess_time_series(time_series_df)
    
    # 3. Train & Validate Models
    train_anomaly_model(X_web, y_web, "web_logs")
    train_classifier_model(X_web, y_web, "web_logs")
    
    train_anomaly_model(X_ts, y_ts, "time_series")
    
    print("\n[SUCCESS] Step 1: Mock Pipeline validated successfully! All stages (Ingestion -> Preprocessing -> Training -> Evaluation) work.")

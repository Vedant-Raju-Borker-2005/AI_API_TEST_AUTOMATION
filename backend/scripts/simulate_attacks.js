const axios = require('axios');

const API_URL = 'http://localhost:5000/api/monitor/logs';

async function sendLog(logData, description) {
  try {
    const res = await axios.post(API_URL, logData);
    console.log(`\n--- [${description}] ---`);
    console.log(`Request Path: ${logData.path}`);
    console.log(`Prediction: Risk=${res.data.prediction?.risk_label} | Priority=${res.data.prediction?.priority} | Anomaly=${res.data.prediction?.anomaly}`);
    if (res.data.features_extracted) {
      console.log(`Features Extracted: AttackSig=${res.data.features_extracted.attack_signature}, SuspiciousIP=${res.data.features_extracted.suspicious_ip_flag}`);
    }
  } catch (e) {
    console.error(`\n--- [${description}] FAILED ---`);
    console.error(e.response ? e.response.data : e.message);
  }
}

async function runSimulations() {
  console.log("🚀 Starting End-to-End Validation Simulations...\n");

  // 1. Normal Traffic Simulation
  await sendLog({
    ip_address: '192.168.1.50',
    method: 'GET',
    path: '/api/v1/health',
    status_code: 200,
    response_time_ms: 45,
    bytes_sent: 512
  }, "NORMAL TRAFFIC");

  // 2. Payload Attack Simulation (SQL Injection)
  await sendLog({
    ip_address: '10.0.0.99',
    method: 'POST',
    path: '/api/v1/auth/login?user=admin%27%20UNION%20SELECT%20*',
    status_code: 401,
    response_time_ms: 120,
    bytes_sent: 1024
  }, "SQL INJECTION ATTACK");

  // 3. Volumetric Attack Simulation (DDoS from single IP)
  console.log("\n--- [VOLUMETRIC DDoS ATTACK] ---");
  console.log("Sending 10 rapid failed requests from the same IP to trigger threshold...");
  const ddosIp = '203.0.113.42';
  for (let i = 0; i < 10; i++) {
    await axios.post(API_URL, {
      ip_address: ddosIp,
      method: 'GET',
      path: '/api/v1/data',
      status_code: 503,
      response_time_ms: 5000 + (i * 100), // Very slow
      bytes_sent: 0
    }).catch(() => {});
  }
  
  // The 11th request should be heavily penalized by the IP frequency/error features
  await sendLog({
    ip_address: ddosIp,
    method: 'GET',
    path: '/api/v1/data',
    status_code: 503,
    response_time_ms: 6000,
    bytes_sent: 0
  }, "DDoS CLIMAX (11th Request)");
  
  console.log("\n✅ Validation Simulations Complete!");
}

runSimulations();

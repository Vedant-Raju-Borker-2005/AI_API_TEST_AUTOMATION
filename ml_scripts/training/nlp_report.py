"""
NexusAI — NLP Report Generator
================================
Reads test-run JSON from stdin, generates a structured markdown report.
Primary: sshleifer/distilbart-cnn-6-6 (HuggingFace)
Fallback: Rule-based template (no model required)

Usage:
    echo '<json>' | python nlp_report.py [--use-model]
"""
import sys, json, os, argparse
from datetime import datetime

parser = argparse.ArgumentParser()
parser.add_argument('--use-model', action='store_true')
args, _ = parser.parse_known_args()

def load_input():
    try:
        return json.loads(sys.stdin.buffer.read().decode('utf-8'))
    except Exception as e:
        sys.stderr.write(f"[nlp_report] JSON parse error: {e}\n")
        return {}

def build_context(data):
    s = data.get('summary', {})
    results = data.get('results', [])
    lines = [
        f"API Test Run Summary: Total tests: {s.get('total',0)}.",
        f"Passed: {s.get('passed',0)} ({s.get('passRate','?')}%).",
        f"Failed: {s.get('failed',0)}. Avg response: {s.get('avgResponseTime',0)}ms.",
        f"Anomalies: {s.get('anomalies',0)}. Environment: {s.get('environment','default')}.",
    ]
    failed = [r for r in results if r.get('status') == 'FAIL'][:5]
    for r in failed:
        lines.append(f"Failed: {r.get('testName','?')} [{r.get('method','?')} {r.get('endpoint','?')}] risk={r.get('risk_score',0):.1f}")
    high = [r for r in results if (r.get('risk_score') or 0) >= 7][:3]
    for r in high:
        lines.append(f"High-risk: {r.get('endpoint','?')} risk={r.get('risk_score',0):.1f} priority={r.get('priority','?')}")
    return " ".join(lines)

def summarize_with_model(text):
    try:
        from transformers import pipeline
        MODEL = os.environ.get('NEXUSAI_NLP_MODEL', 'sshleifer/distilbart-cnn-6-6')
        sys.stderr.write(f"[nlp_report] Loading model: {MODEL}\n")
        summ = pipeline("summarization", model=MODEL, tokenizer=MODEL, device=-1)
        result = summ(text[:3000], max_length=180, min_length=60, do_sample=False, truncation=True)
        return result[0]['summary_text']
    except Exception as e:
        sys.stderr.write(f"[nlp_report] Model error: {e}. Using fallback.\n")
        return None

def rule_based_summary(data):
    s = data.get('summary', {})
    total = s.get('total', 0)
    passed = s.get('passed', 0)
    failed = s.get('failed', 0)
    pass_pct = s.get('passRate', 0)
    avg_rt = s.get('avgResponseTime', 0)
    anomalies = s.get('anomalies', 0)
    env = s.get('environment', 'default')
    health = "healthy" if float(pass_pct) >= 80 else ("degraded" if float(pass_pct) >= 50 else "critical")
    anom = (f" {anomalies} anomalous response(s) detected, indicating potential security concerns."
            if anomalies > 0 else " No anomalies were detected.")
    return (f"The API test suite executed {total} tests against the {env} environment with a "
            f"{pass_pct}% pass rate ({passed} passed, {failed} failed), indicating {health} API health. "
            f"Average response time was {avg_rt}ms.{anom}")

def generate_recommendations(data):
    s = data.get('summary', {})
    results = data.get('results', [])
    recs = []
    failed = [r for r in results if r.get('status') == 'FAIL']
    high_risk = [r for r in results if (r.get('risk_score') or 0) >= 7]
    anomalies = [r for r in results if r.get('anomaly')]
    slow = [r for r in results if (r.get('responseTime') or 0) > 1000]
    security = [r for r in results if r.get('category') == 'SECURITY' and r.get('status') == 'FAIL']
    if float(s.get('passRate', 100)) < 80:
        recs.append("🔴 **Pass rate below 80%** — Fix failing endpoints before deployment.")
    if high_risk:
        eps = ', '.join(set(r.get('endpoint','') for r in high_risk[:3]))
        recs.append(f"⚠️ **High-risk endpoints ({len(high_risk)})**: `{eps}` — apply rate limiting and validation.")
    if security:
        recs.append(f"🔒 **{len(security)} security test(s) failed** — review injection and auth controls immediately.")
    if anomalies:
        recs.append(f"📊 **{len(anomalies)} anomaly(ies)** — check for DDoS exposure or attack signatures.")
    if slow:
        avg_s = sum(r.get('responseTime',0) for r in slow) / len(slow)
        recs.append(f"⏱️ **{len(slow)} slow endpoint(s)** (avg {avg_s:.0f}ms) — consider caching or async processing.")
    if not recs:
        recs.append("✅ All tests performed within acceptable parameters. Continue monitoring.")
    return recs

def build_report(data, use_model):
    s = data.get('summary', {})
    results = data.get('results', [])
    run_id = data.get('runId', 'N/A')
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    context = build_context(data)
    ai_summary = summarize_with_model(context) if use_model else None
    summary_source = 'sshleifer/distilbart-cnn-6-6' if ai_summary else 'rule-based'
    if not ai_summary:
        ai_summary = rule_based_summary(data)

    failed = [r for r in results if r.get('status') == 'FAIL']
    high_risk = sorted([r for r in results if (r.get('risk_score') or 0) >= 7],
                       key=lambda x: x.get('risk_score', 0), reverse=True)
    anomalies = [r for r in results if r.get('anomaly')]
    risk_dist = {'Critical': 0, 'High': 0, 'Medium': 0, 'Low': 0}
    for r in results:
        lbl = r.get('risk_label', 'Low')
        risk_dist[lbl] = risk_dist.get(lbl, 0) + 1
    recommendations = generate_recommendations(data)

    md = [
        "# NexusAI Test Execution Report", "",
        f"> **Run ID:** `{run_id}`  ",
        f"> **Generated:** {ts}  ",
        f"> **Environment:** {s.get('environment','default')}  ",
        f"> **Mode:** {'Chained' if s.get('chaining') else 'Concurrent'}", "",
        "---", "", "## 🤖 Executive Summary", "",
        f"_{ai_summary}_", "",
        f"> Summary generated by: **{summary_source}**", "",
        "---", "", "## 📊 Statistics", "",
        "| Metric | Value |", "|--------|-------|",
        f"| Total Tests | **{s.get('total',0)}** |",
        f"| Passed | **{s.get('passed',0)}** ✅ |",
        f"| Failed | **{s.get('failed',0)}** ❌ |",
        f"| Pass Rate | **{s.get('passRate','?')}%** |",
        f"| Avg Response Time | **{s.get('avgResponseTime',0)}ms** |",
        f"| Anomalies | **{s.get('anomalies',0)}** |", "",
        "---", "", "## 🎯 Risk Distribution", "",
        "| Risk Level | Count |", "|-----------|-------|",
    ]
    icons = {'Critical': '🔴', 'High': '🟠', 'Medium': '🟡', 'Low': '🟢'}
    for level, count in risk_dist.items():
        md.append(f"| {icons.get(level,'⚪')} {level} | {count} |")

    md += ["", "---", "", f"## 🚨 Failed Tests ({len(failed)})", ""]
    if failed:
        md += ["| Test | Method | Endpoint | Risk | Error |", "|------|--------|----------|------|-------|"]
        for r in failed[:20]:
            md.append(f"| {r.get('testName','?')} | `{r.get('method','?')}` | `{r.get('endpoint','?')}` | {r.get('risk_score',0):.1f} | {(r.get('error','') or '')[:60]} |")
    else:
        md.append("✅ All tests passed!")

    md += ["", "---", "", f"## ⚠️ High-Risk Endpoints ({len(high_risk)})", ""]
    if high_risk:
        md += ["| Endpoint | Method | Risk | Priority | Anomaly |", "|----------|--------|------|----------|---------|"]
        for r in high_risk[:10]:
            md.append(f"| `{r.get('endpoint','?')}` | `{r.get('method','?')}` | {r.get('risk_score',0):.1f} | {r.get('priority','?')} | {'⚠️' if r.get('anomaly') else 'No'} |")
    else:
        md.append("No high-risk endpoints detected.")

    if anomalies:
        md += ["", "---", "", f"## 🔍 Anomalies ({len(anomalies)})", "",
               "| Test | Response Time | Category |", "|------|--------------|----------|"]
        for r in anomalies[:10]:
            md.append(f"| {r.get('testName','?')} | {r.get('responseTime',0)}ms | {r.get('category','?')} |")

    md += ["", "---", "", "## 💡 Recommendations", ""]
    for rec in recommendations:
        md.append(f"- {rec}")

    md += ["", "---", "", f"## 📋 Full Results ({len(results)} tests)", "",
           "| Test | Method | Status | Priority | Risk | Time | Anomaly |",
           "|------|--------|--------|----------|------|------|---------|"]
    for r in results[:50]:
        st = "✅ PASS" if r.get('status') == 'PASS' else "❌ FAIL"
        md.append(f"| {r.get('testName','?')} | `{r.get('method','?')}` | {st} | {r.get('priority','?')} | {r.get('risk_score',0):.1f} | {r.get('responseTime',0)}ms | {'⚠️' if r.get('anomaly') else '—'} |")
    if len(results) > 50:
        md.append(f"_... and {len(results)-50} more results_")
    md += ["", "---", "_Report generated by NexusAI v1.0.0_"]

    return {
        "success": True, "runId": run_id, "generatedAt": ts,
        "summarySource": summary_source, "markdown": "\n".join(md),
        "metadata": {
            "total": s.get('total',0), "passed": s.get('passed',0),
            "failed": s.get('failed',0), "passRate": s.get('passRate',0),
            "anomalies": s.get('anomalies',0), "environment": s.get('environment','default'),
            "riskDistribution": risk_dist, "recommendations": recommendations,
            "executiveSummary": ai_summary,
        }
    }

if __name__ == '__main__':
    data = load_input()
    if not data:
        print(json.dumps({"success": False, "error": "No input data provided"}))
        sys.exit(1)
    print(json.dumps(build_report(data, use_model=args.use_model)))

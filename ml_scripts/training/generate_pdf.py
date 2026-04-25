"""
NexusAI — PDF Report Generator
================================
Reads JSON (markdown + metadata) from stdin, outputs a base64-encoded PDF.
Uses fpdf2 — MIT licensed, lightweight, no commercial dependencies.

Usage:
    echo '<json>' | python generate_pdf.py
    Output: {"success": true, "pdf_base64": "<base64>", "filename": "nexusai_report_<runId>.pdf"}
"""
import sys, json, base64, re, unicodedata
from datetime import datetime

# ── Colour palette (NexusAI brand) ──
DARK_BG   = (7,   8,  13)
ACCENT    = (124,  92, 255)
SUCCESS   = (0,  224, 164)
DANGER    = (255,  92, 124)
WARNING   = (255, 184,  77)
WHITE     = (255, 255, 255)
LIGHT_FG  = (232, 234, 241)
DIM       = (154, 160, 180)

# ── Strip ALL non-latin1 characters safely ──
def clean_text(t):
    """Remove emojis and non-latin1 chars, replace common unicode with ASCII."""
    if not t:
        return ""
    t = str(t)
    # Replace common unicode punctuation with ASCII equivalents
    replacements = {
        '\u2014': '-',   # em-dash
        '\u2013': '-',   # en-dash
        '\u2018': "'",   # left single quote
        '\u2019': "'",   # right single quote
        '\u201c': '"',   # left double quote
        '\u201d': '"',   # right double quote
        '\u2026': '...', # ellipsis
        '\u2022': '-',   # bullet
        '\u00b7': '-',   # middle dot
        '\u27f3': '...',   # rotating arrows
    }
    for orig, repl in replacements.items():
        t = t.replace(orig, repl)
    # Strip markdown bold markers
    t = t.replace('**', '')
    # Remove emoji and other non-printable/non-latin1 characters
    t = re.sub(r'[\U00010000-\U0010ffff]', '', t)  # supplementary planes (emoji)
    t = re.sub(r'[\u2600-\u27BF\u2700-\u27BF\uFE00-\uFE0F\u200d]', '', t)  # misc symbols
    # Final encode/decode to strip anything latin-1 can't handle
    t = t.encode('latin-1', 'replace').decode('latin-1')
    return t.strip()


def make_pdf(data: dict) -> bytes:
    from fpdf import FPDF, XPos, YPos

    meta      = data.get('metadata', {})
    run_id    = str(data.get('runId', 'N/A'))
    ts        = data.get('generatedAt', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    src       = data.get('summarySource', 'rule-based')
    ex_summary= meta.get('executiveSummary', '')
    recs      = meta.get('recommendations', [])
    risk_dist = meta.get('riskDistribution', {})

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # ─────────────── COVER / HEADER ───────────────
    pdf.set_fill_color(*ACCENT)
    pdf.rect(0, 0, 210, 42, 'F')

    pdf.set_text_color(*WHITE)
    pdf.set_font('Helvetica', 'B', 22)
    pdf.set_xy(14, 10)
    pdf.cell(0, 10, 'NexusAI - API Test Execution Report', new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font('Helvetica', '', 10)
    pdf.set_xy(14, 24)
    env_name = clean_text(str(meta.get('environment', 'default')))
    pdf.cell(0, 6, clean_text(f'Run ID: {run_id}   |   Generated: {ts}   |   Environment: {env_name}'))

    pdf.set_fill_color(*WHITE)
    pdf.set_text_color(30, 30, 40)
    pdf.set_xy(0, 44)

    # ─────────────── STATS ROW ───────────────
    def stat_box(x, y, w, label, value, r, g, b):
        pdf.set_fill_color(r, g, b)
        pdf.set_xy(x, y)
        pdf.rect(x, y, w, 24, 'F')
        pdf.set_text_color(*WHITE)
        pdf.set_font('Helvetica', 'B', 18)
        pdf.set_xy(x, y + 2)
        pdf.cell(w, 10, clean_text(str(value)), align='C')
        pdf.set_font('Helvetica', '', 8)
        pdf.set_xy(x, y + 14)
        pdf.cell(w, 6, clean_text(label), align='C')
        pdf.set_text_color(30, 30, 40)

    cols = [
        ('Total Tests',   meta.get('total', 0),    14,  46, 44, *ACCENT),
        ('Passed',        meta.get('passed', 0),    60,  46, 44, 0, 180, 130),
        ('Failed',        meta.get('failed', 0),   106,  46, 44, 200, 60, 90),
        ('Pass Rate',     f"{meta.get('passRate', '?')}%", 152, 46, 44, 80, 60, 180),
    ]
    for item in cols:
        label, value, x, y, w, r, g, b = item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7]
        stat_box(x, y, w, label, value, r, g, b)

    pdf.set_xy(14, 76)

    # ─────────────── SECTION HELPER ───────────────
    def section_title(title):
        pdf.set_font('Helvetica', 'B', 13)
        pdf.set_text_color(*ACCENT)
        pdf.ln(6)
        pdf.cell(0, 8, clean_text(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_draw_color(*ACCENT)
        pdf.line(14, pdf.get_y(), 196, pdf.get_y())
        pdf.ln(3)
        pdf.set_text_color(30, 30, 40)

    def body_text(text, size=10):
        pdf.set_font('Helvetica', '', size)
        pdf.set_text_color(60, 60, 80)
        pdf.multi_cell(0, 5.5, clean_text(text))
        pdf.ln(2)
        pdf.set_text_color(30, 30, 40)

    # ─────────────── EXECUTIVE SUMMARY ───────────────
    section_title('Executive Summary')
    body_text(ex_summary or 'No summary available.')
    pdf.set_font('Helvetica', 'I', 8)
    pdf.set_text_color(*DIM)
    pdf.cell(0, 5, clean_text(f'Summary source: {src}'), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(30, 30, 40)

    # ─────────────── RISK DISTRIBUTION ───────────────
    section_title('Risk Distribution')
    risk_colors = {'Critical': DANGER, 'High': WARNING, 'Medium': ACCENT, 'Low': SUCCESS}
    has_risk = False
    for level, count in risk_dist.items():
        if count == 0:
            continue
        has_risk = True
        col = risk_colors.get(level, DIM)
        pdf.set_fill_color(*col)
        bar_w = min(120, max(8, count * 12))
        pdf.set_xy(14, pdf.get_y())
        pdf.set_font('Helvetica', 'B', 9)
        pdf.set_text_color(*WHITE)
        pdf.set_fill_color(*col)
        pdf.rect(14, pdf.get_y(), bar_w, 7, 'F')
        pdf.set_text_color(30, 30, 40)
        pdf.set_xy(14 + bar_w + 4, pdf.get_y())
        pdf.cell(0, 7, clean_text(f'{level}: {count}'), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(1)
    if not has_risk:
        body_text('All tests are within acceptable risk levels.')

    # ─────────────── ANOMALIES ───────────────
    anomalies_count = meta.get('anomalies', 0)
    if anomalies_count > 0:
        section_title(f'Anomalies Detected: {anomalies_count}')
        body_text(f'{anomalies_count} anomalous response(s) were detected during this test run. '
                  'Review endpoints flagged with anomaly=true for DDoS exposure, SQL injection, or unusual latency.')

    # ─────────────── RECOMMENDATIONS ───────────────
    section_title('Recommendations')
    if recs:
        for idx, rec in enumerate(recs, 1):
            cleaned = clean_text(rec)
            pdf.set_font('Helvetica', '', 10)
            pdf.set_text_color(60, 60, 80)
            pdf.multi_cell(0, 5.5, f'  {idx}. {cleaned}')
            pdf.ln(1)
    else:
        body_text('No specific recommendations at this time.')

    # ─────────────── FOOTER ───────────────
    pdf.set_y(-20)
    pdf.set_draw_color(*ACCENT)
    pdf.line(14, pdf.get_y(), 196, pdf.get_y())
    pdf.set_font('Helvetica', 'I', 8)
    pdf.set_text_color(*DIM)
    pdf.cell(0, 8, 'NexusAI v1.0.0 - AI-Powered API Test Automation | Confidential', align='C')

    return pdf.output()

def main():
    try:
        data = json.loads(sys.stdin.buffer.read().decode('utf-8'))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"JSON parse error: {e}"}))
        sys.exit(1)

    try:
        pdf_bytes = make_pdf(data)
        b64 = base64.b64encode(pdf_bytes).decode('utf-8')
        run_id = str(data.get('runId', 'report'))
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        # Sanitize runId for filename
        safe_id = re.sub(r'[^a-zA-Z0-9_-]', '', run_id)[:8] or 'report'
        filename = f"nexusai_report_{safe_id}_{ts}.pdf"
        print(json.dumps({"success": True, "pdf_base64": b64, "filename": filename}))
    except ImportError:
        print(json.dumps({"success": False, "error": "fpdf2 not installed. Run: pip install fpdf2"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()

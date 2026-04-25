<div align="center">

# 🚀 NexusAI — AI-Powered API Test Automation

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://reactjs.org)
[![Python](https://img.shields.io/badge/Python-3.9%2B-3776AB?logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-purple)](LICENSE)

**NexusAI** is a full-stack, production-grade API testing platform that combines ML-powered test prioritization, real-time anomaly detection, and AI-generated execution reports — all wrapped in a premium glassmorphism UI.

[🎬 Watch Demo](#-demo) · [⚡ Quick Start](#-quick-start) · [📂 Folder Structure](#-folder-structure) · [🔧 API Reference](#-api-reference)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🧠 **ML Test Prioritization** | XGBoost ranks every test by predicted failure risk |
| 🎯 **Smart Test Generation** | Positive, negative, edge, and security tests auto-generated from OpenAPI specs |
| ⚠️ **Endpoint Risk Scoring** | Random Forest identifies fragile endpoints before they hit production |
| 🔍 **Anomaly Detection** | Isolation Forest flags slow or unusual response patterns in real time |
| ⚡ **Concurrent Execution** | Worker-pool runner handles hundreds of parallel tests |
| 📊 **Rich Analytics** | Interactive charts: pass/fail ratio, response time distribution |
| 📄 **NLP Reports** | AI-generated executive summaries with actionable recommendations |
| 📥 **Multi-Format Export** | Download reports as polished PDF or plain-text `.txt` |
| 🌓 **Dark / Light Mode** | System-aware theme with localStorage persistence |
| 🎬 **Live Demo Video** | Embedded demo player accessible from the landing page |

---

## 🎬 Demo

Click **"Watch Demo"** or the **"Demo"** nav link on the landing page to play the full platform walkthrough video in a modal overlay. The video is served directly from the React public directory — no additional setup needed.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Browser                          │
│   React 18  ·  Framer Motion  ·  Recharts            │
│   Landing Page  ·  Dashboard  ·  Demo Modal          │
└────────────────────┬─────────────────────────────────┘
                     │ HTTP / REST (port 3000 → 5000)
┌────────────────────▼─────────────────────────────────┐
│              Express.js Backend (port 5000)           │
│   Upload  ·  Test Generation  ·  Test Execution      │
│   Environment Mgmt  ·  Report Generation (PDF/TXT)   │
│   SQLite (in-memory)  ·  Multer  ·  helmet/rate-limit│
└────────────────────┬─────────────────────────────────┘
                     │ child_process / Python
┌────────────────────▼─────────────────────────────────┐
│              ML Engine (Python 3.9+)                  │
│   XGBoost (priority)  ·  Random Forest (risk)        │
│   Isolation Forest (anomaly)  ·  DistilBART (NLP)    │
│   FPDF2 (PDF)  ·  Transformers (Hugging Face)        │
└──────────────────────────────────────────────────────┘
```

---

## 📂 Folder Structure

```
AI_API_TEST_AUTOMATION/
│
├── frontend/                        # React 18 Application
│   ├── public/
│   │   ├── index.html
│   │   └── demo.mp4                 # Demo video (served as static asset)
│   └── src/
│       ├── components/              # Reusable UI components
│       │   ├── index.js             # Barrel export
│       │   ├── Nav.js               # Navigation bar
│       │   ├── Hero.js              # Hero section + preview card
│       │   ├── Features.js          # Feature cards grid
│       │   ├── HowItWorks.js        # 4-step workflow section
│       │   ├── CTA.js               # Call-to-action section
│       │   ├── DemoModal.js         # Demo video modal player
│       │   ├── Toast.js             # Auto-dismissing notification
│       │   ├── StepBar.js           # 3-step progress indicator
│       │   ├── UploadZone.js        # Drag-and-drop upload area
│       │   └── ResultsView.js       # Charts, results table, NLP report
│       ├── pages/
│       │   ├── Landing.js           # Landing page orchestrator
│       │   └── Dashboard.js         # Dashboard state orchestrator
│       ├── styles/
│       │   ├── global.css           # Design tokens, glassmorphism, buttons
│       │   ├── landing.css          # Landing page + demo modal styles
│       │   └── dashboard.css        # Dashboard-specific styles
│       ├── App.js                   # Root — page routing + theme toggle
│       └── index.js                 # React DOM entry point
│
├── backend/                         # Express.js API Server
│   ├── src/
│   │   ├── server.js                # App entry, middleware, route mounting
│   │   ├── routes/
│   │   │   ├── upload.js            # POST /api/upload, POST /api/upload-excel
│   │   │   ├── tests.js             # POST /api/generate-tests, POST /api/run-tests
│   │   │   ├── ml.js                # POST /api/train-models, POST /api/monitor/logs
│   │   │   ├── report.js            # POST /api/report/generate, POST /api/report/pdf
│   │   │   └── environments.js      # GET /api/environments
│   │   ├── services/
│   │   │   ├── excelParser.js       # XLSX / CSV → structured test cases
│   │   │   ├── openapiParser.js     # JSON / YAML spec → endpoint list
│   │   │   ├── testGenerator.js     # Generates test scenarios per endpoint
│   │   │   ├── testMapper.js        # Maps Excel rows to test schema
│   │   │   ├── executor.js          # HTTP test runner (single test)
│   │   │   ├── chainExecutor.js     # Sequential chained execution engine
│   │   │   ├── mlService.js         # Calls Python ML models via child_process
│   │   │   ├── monitorService.js    # Anomaly detection pipeline
│   │   │   ├── envManager.js        # Manages named test environments
│   │   │   └── validator.js         # Schema validation helpers (AJV)
│   │   └── db/
│   │       └── database.js          # SQLite in-memory DB (run history)
│   ├── scripts/
│   │   ├── full_demo.js             # End-to-end demo runner script
│   │   ├── retrain_cron.js          # Scheduled model retraining (node-cron)
│   │   └── simulate_attacks.js      # Attack simulation test helper
│   ├── uploads/                     # Temp storage for uploaded files (gitignored)
│   └── package.json
│
├── ml_scripts/                      # Python ML & NLP Engine
│   ├── pipeline/
│   │   ├── train_mock_pipeline.py   # Train models on mock data
│   │   ├── train_real.py            # Train models on real datasets
│   │   ├── generate_mock_data.py    # Generate synthetic training data
│   │   ├── download_real_data.py    # Fetch real-world network datasets
│   │   └── preprocess_real.py       # Preprocess raw data for training
│   ├── training/                    # Training scripts & configs
│   ├── models/                      # Saved model files (gitignored)
│   ├── data/                        # Training data (gitignored)
│   └── requirements.txt
│
├── samples/                         # Sample files for download
│   ├── sample_openapi.json          # Example OpenAPI 3.0 spec
│   └── sample_tests.xlsx            # Example Excel test case sheet
│
├── media/
│   └── demo.mp4                     # Source demo video
│
├── dev-tools/                       # Developer utilities (gitignored)
│   ├── test_backend.js              # Manual backend smoke test
│   ├── test_pdf.js / test_pdf2.js   # PDF generation test scripts
│   ├── generate_excel.js            # Sample Excel file generator
│   └── generate_test_datasets.py    # Bulk test dataset generator
│
├── api_test_cases/                  # Stored test case archives
├── files/                           # Miscellaneous project files
├── .gitignore
├── package.json                     # Root workspace package
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18 or higher |
| npm | 9 or higher |
| Python | 3.9 or higher |
| pip | latest |

### 1. Clone the Repository

```bash
git clone https://github.com/Vedant-Raju-Borker-2005/AI_API_TEST_AUTOMATION.git
cd AI_API_TEST_AUTOMATION
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 4. Install Python ML Dependencies

```bash
pip install -r ml_scripts/requirements.txt
```

> **Note:** On first run, `transformers` will download the DistilBART model (~1.5 GB). Ensure you have a stable internet connection.

### 5. Start the Platform

**Option A — Manual (two terminals):**

```bash
# Terminal 1 — Backend
cd backend
npm start          # listens on http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm start          # opens http://localhost:3000
```

**Option B — Single-click launcher (Windows):**

```bat
start_project.bat
```

---

## 🔧 Environment Variables

Create a `backend/.env` file to override defaults:

```env
# Server
PORT=5000

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000   # 15 minutes
RATE_LIMIT_MAX=300

# ML service (optional override)
ML_PYTHON_PATH=python          # path to python binary
```

The frontend proxies all `/api` requests to `http://localhost:5000` automatically (configured in `frontend/package.json`).

---

## 🎮 Usage

### Step 1 — Upload Inputs
- **OpenAPI Spec**: Upload a `.json`, `.yaml`, or `.yml` file. NexusAI parses every endpoint, schema, and parameter.
- **Excel / CSV Test Cases**: Upload an `.xlsx`, `.xls`, or `.csv` file with your manual test cases. Use the sample file from the dashboard as a template.

### Step 2 — Generate & Configure
- Click **Generate Test Suite** to create ML-scored, prioritized tests.
- Select an **environment** (from saved environments) or use the spec default base URL.
- Choose **Concurrent** (faster, parallel) or **Chained** (sequential, token-passing) execution mode.

### Step 3 — Run & Analyse
- Click **Run Tests** to execute the full suite.
- View real-time **pass/fail charts**, **response time distribution**, and the **detailed results table**.

### Step 4 — Export Report
- Click **✨ Generate Report** to produce an AI-powered NLP executive summary.
- Download as **📄 PDF** or **📥 .txt** for sharing and documentation.

---

## 🤖 ML Pipeline

The ML engine runs as a Python subprocess called by the Node.js backend:

| Model | Algorithm | Purpose |
|---|---|---|
| **Priority Scorer** | XGBoost | Ranks tests by predicted failure risk (Critical → Low) |
| **Risk Scorer** | Random Forest | Assigns per-endpoint risk scores (0–10) |
| **Anomaly Detector** | Isolation Forest | Flags slow response times and unusual status codes |
| **Report Generator** | DistilBART (HuggingFace) | Summarizes test run results into an executive report |

### Training

```bash
# Train on mock (synthetic) data — fast, no internet required
cd ml_scripts/pipeline
python train_mock_pipeline.py

# Train on real network datasets — better accuracy, ~1 GB download
python download_real_data.py
python preprocess_real.py
python train_real.py
```

Models are saved to `ml_scripts/models/` (gitignored). The backend will fall back to rule-based scoring if models are not present.

---

## 🔑 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload OpenAPI spec (JSON/YAML), returns endpoint list |
| `POST` | `/api/upload-excel` | Upload Excel/CSV test cases |
| `GET`  | `/api/samples/openapi` | Download sample OpenAPI spec |
| `GET`  | `/api/samples/excel` | Download sample Excel template |
| `POST` | `/api/generate-tests` | Generate ML-scored test suite |
| `POST` | `/api/run-tests` | Execute tests concurrently or in chain |
| `GET`  | `/api/results` | Retrieve all run results |
| `GET`  | `/api/results/:runId` | Retrieve a specific run |
| `GET`  | `/api/environments` | List saved environments |
| `POST` | `/api/train-models` | Trigger model retraining |
| `POST` | `/api/monitor/logs` | Submit logs for anomaly analysis |
| `POST` | `/api/report/generate` | Generate NLP executive report |
| `POST` | `/api/report/pdf` | Render report as PDF (base64) |
| `GET`  | `/api/health` | Health check endpoint |

---

## 🛠️ Development Notes

### SQLite In-Memory Mode
The backend uses `better-sqlite3` in **in-memory mode** to avoid native binary compilation issues in some environments. All run history is stored in RAM — it resets on server restart. To persist data, update `backend/src/db/database.js` to use a file path instead of `:memory:`.

### PDF Generation
PDF export is handled entirely in the Node.js backend via `pdfkit` / custom implementation. The Python ML stack is only used for NLP summarization. If Python is unavailable, the backend falls back to a rule-based summary.

### Large File Warning (GitHub)
The `frontend/node_modules/.cache` directory should not be committed. The `.gitignore` excludes all `node_modules/` and build caches. The `media/demo.mp4` file (33 MB) is kept in the repo for demo purposes; consider using Git LFS for large binary files in production.

### Port Map
| Service | Port |
|---|---|
| Frontend (React dev server) | `3000` |
| Backend (Express) | `5000` |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by the NexusAI Team**

[⬆ Back to top](#-nexusai--ai-powered-api-test-automation)

</div>

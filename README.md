# MedGraph AI 🧠🩻

> **Explainable Clinical Decision Support System for Medical Imaging**

MedGraph AI is a premium, end-to-end clinical decision support platform that combines Deep Learning vision models (YOLO & MONAI U-Net) with a clinical knowledge graph and reasoning engine to provide explainable diagnostic reports for Chest X-Rays and Brain MRIs.

---

## 🚀 Key Features

*   **Multimodal Image Processing:** Automatically preprocesses and detects the modality of uploaded scans (Chest X-Ray or Brain MRI).
*   **Deep Learning Computer Vision:**
    *   **Chest X-Ray:** Object detection for pathological findings using **Ultralytics YOLOv11**.
    *   **Brain MRI:** Semantic segmentation of lesions using **MONAI U-Net**.
*   **Explainable AI & Clinical Reasoning:**
    *   **Visual Annotations:** Generates scan overlays highlighting detected regions.
    *   **Platt-scaled Confidence Calibration:** Calibrates confidence scores based on modality and model outputs.
    *   **Clinical Knowledge Graph:** Dynamically maps findings, clinical concepts, and next-step recommendations.
    *   **Zero-Hallucination Reasoning Engine:** Synthesizes structured clinical interpretations grounded strictly in model findings.
*   **Versioned Reporting:** Physicians edit drafts as numbered versions with revision notes; signing locks a report, and editing after sign-off reopens it.

---

## 🖥️ Frontend (v2)

The web app is split into a public landing page and a radiology **reading room**.

**Landing page** (`#/`)
*   **Diagnostic loupe hero:** move the cursor over a rendered chest film or brain MRI. The loupe magnifies the region and reveals detections, heat maps and live readouts (position in mm, region, signal). Scroll to resize, click to lock.
*   **Pipeline walkthrough:** the six stages with the structured output each one produces.
*   **Calibration playground:** drag a raw score and the steepness `k` to see the Platt curve and confidence bands the backend uses.
*   **Reasoning trace:** hover any graph node to light up its full lineage.

**Reading room** (`#/app`)
| View | What it does |
| :--- | :--- |
| Overview | KPIs, triage queue, severity mix, 7-day volume by modality, activity feed |
| Worklist | Priority-sorted queue (severity + confidence + wait time), status filters, `j`/`k` keyboard navigation |
| Study viewer | Zoom/pan, window/level, invert, measurement ruler in mm, detection boxes linked both ways to findings, calibration breakdown |
| Report | Edit → versioned save, sign/reopen, print-to-PDF layout, `.txt` export |
| Audit | Per-study event log and report version history |
| Reasoning graph | React Flow graph with lineage highlighting, node inspector and type filters |
| Archive | Thumbnail grid, side-by-side compare of two studies, CSV export |
| Settings | API URL, reviewer identity, demo toggle, keyboard reference |

`⌘K` opens a command palette for jumping to any patient, study or action.

**Demo engine.** When no API is reachable (for example on the hosted preview, where browsers block `http://localhost` from an `https` page), the app switches to an in-browser port of the reasoning pipeline in `frontend/src/lib/engine.ts`. It applies the same location heuristics, severity grading, Platt calibration, graph rules and report templates as the backend, and runs them on simulated, deterministic vision output over procedurally rendered scans. These are synthetic; no patient data is used. Set `VITE_API_URL` or use Settings to point at a live backend.

---

## 🛠️ Technology Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React 19 (TypeScript), Vite, TailwindCSS, Lucide Icons, Recharts, Axios |
| **Backend** | FastAPI, Uvicorn, SQLite, SQLAlchemy (Async), Alembic |
| **ML & AI Engine** | PyTorch, Ultralytics (YOLO), MONAI (U-Net), NetworkX, OpenCV |
| **Containerization** | Docker, Docker Compose |
| **Deployment** | Vercel (Frontend), Custom Python Host (Backend) |

---

## 📁 Repository Structure

```
medgraph-ai/
├── backend/                  # FastAPI Application
│   ├── api/                  # Routes, Router, and Schemas
│   ├── core/                 # Configurations & Environments
│   ├── services/             # Core ML Inference & Post-processing
│   │   ├── models/           # Vision (YOLO/U-Net) & Reasoning Engines
│   │   └── preprocessor.py   # Image Preprocessing Utility
│   └── main.py               # Backend entry point
├── frontend/                 # React Frontend
│   ├── src/                  # React components, pages, and services
│   ├── package.json          # Node dependencies & build scripts
│   └── vite.config.ts        # Vite build tool config
├── training/                 # Model Training & Pipelines
├── tests/                    # Backend Pytest suite
├── docker-compose.yml        # Docker composition setup
├── pyproject.toml            # Python tool configurations & Vercel builds
└── requirements.txt          # Python dependencies
```

---

## 💻 Local Setup

### Prerequisites
*   Python 3.11 or 3.12
*   Node.js 20+

### 1. Backend Setup
Navigate to the root directory and create a virtual environment:
```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment (Windows)
.venv\Scripts\activate
# Activate virtual environment (macOS/Linux)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
python -m backend.main
```
The backend API will be available at **`http://localhost:8000`** with interactive Swagger documentation at **`http://localhost:8000/docs`**.

### 2. Frontend Setup
Navigate to the `frontend` directory:
```bash
cd frontend

# Install Node dependencies
npm install

# Run the frontend in development mode
npm run dev
```
The React frontend will be running at **`http://localhost:5173`**.

---

## 🐳 Docker Deployment

You can run the entire stack (FastAPI + React Vite + Database) using Docker Compose:

```bash
# Build and run the containers
docker-compose up --build
```
This mounts the backend container on port `8000` and the frontend container on port `3000`.

---

## ⚡ API Endpoints Quick Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/v1/analyze` | `POST` | Upload and analyze a scan (form-data: `file`, `patient_id`, `modality_override`) |
| `/api/v1/case/{case_id}` | `GET` | Retrieve case diagnostic details & report |
| `/api/v1/overlay/{case_id}`| `GET` | Get the generated PNG overlay file |
| `/api/v1/history` | `GET` | List all historical cases |
| `/api/v1/report/{case_id}` | `PATCH` | Edit/update report findings (saves to history) |
| `/api/v1/models` | `GET` | List details and versions of registered models |
| `/api/v1/health` | `GET` | Verify api readiness and pipeline health |

---

## 🌐 Production Deployment

*   **Frontend (Vercel):** Automatically configured via the root-level `vercel.json` to build and serve the static Vite bundle on Vercel at `https://medgraph-nu.vercel.app`.
*   **Backend:** Due to the large size of deep learning packages (`torch`, `transformers`, etc. total 5.3 GB), the backend must be deployed on a dedicated server (e.g., Render, AWS EC2, or Docker VPS) rather than serverless functions.

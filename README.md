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
*   **Interactive Frontend:** Built with React 19, TypeScript, TailwindCSS, Recharts, and Lucide React.
*   **Versioned Reporting:** Allows physicians to edit reports with local version history and auditable change logs.

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

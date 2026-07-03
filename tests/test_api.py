import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from backend.services.models.storage.database.connection import get_db, Base
from backend.main import app

# Setup isolated database for API tests
test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
test_session_factory = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def override_get_db():
    """Yields test session for API endpoints."""
    async with test_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Override FastAPI database dependency
app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True, scope="module")
async def setup_test_database():
    """Initializes in-memory database tables for test suite duration."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await test_engine.dispose()

client = TestClient(app)

def test_health_check() -> None:
    """Tests health and status endpoints."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["app"] == "MedGraph AI"
    
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_models_endpoint() -> None:
    """Tests registered model details endpoint."""
    response = client.get("/api/v1/models")
    assert response.status_code == 200
    assert "chest_model" in response.json()
    assert "brain_model" in response.json()

def test_analyze_and_flow(mock_png_bytes: bytes, mock_dicom_bytes: bytes) -> None:
    """Tests the full upload, analysis, case retrieve, and edit sequence."""
    
    # 1. Analyze Chest X-Ray (PNG with keyword name)
    files = {"file": ("chest_xray_scan.png", io.BytesIO(mock_png_bytes), "image/png")}
    data = {"patient_id": "PT-001"}
    
    response = client.post("/api/v1/analyze", files=files, data=data)
    assert response.status_code == 201
    res_data = response.json()
    
    assert "case_id" in res_data
    assert res_data["modality"] == "chest_xray"
    assert res_data["severity"] == "Moderate"
    assert len(res_data["findings"]) == 1
    assert res_data["findings"][0]["name"] == "Opacity"
    assert res_data["report"]["physician_review_required"] is True
    
    case_id = res_data["case_id"]

    # 2. Retrieve Case Details
    case_resp = client.get(f"/api/v1/case/{case_id}")
    assert case_resp.status_code == 200
    assert case_resp.json()["case_id"] == case_id
    assert case_resp.json()["modality"] == "chest_xray"

    # 3. Retrieve Case History
    hist_resp = client.get("/api/v1/history")
    assert hist_resp.status_code == 200
    assert len(hist_resp.json()) >= 1
    assert any(c["case_id"] == case_id for c in hist_resp.json())

    # 4. Edit Report Draft
    report_data = res_data["report"]
    report_data["patient_summary"] = "Updated patient summary by cardiologist"
    edit_payload = {
        "edited_report": report_data,
        "doctor_notes": "Clarified lower lobe consolidation margin details."
    }
    
    patch_resp = client.patch(f"/api/v1/report/{case_id}", json=edit_payload)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["report"]["patient_summary"] == "Updated patient summary by cardiologist"

def test_analyze_dicom_brain(mock_dicom_bytes: bytes) -> None:
    """Tests DICOM brain MRI analysis."""
    files = {"file": ("mri_scan.dcm", io.BytesIO(mock_dicom_bytes), "application/dicom")}
    data = {"patient_id": "PT-002"}
    
    response = client.post("/api/v1/analyze", files=files, data=data)
    assert response.status_code == 201
    res_data = response.json()
    
    assert res_data["modality"] == "brain_mri"
    assert res_data["severity"] == "Critical"
    assert res_data["findings"][0]["name"] == "Hyperintensity"
    assert "Temporal Lobe" in res_data["findings"][0]["location"]

def test_analyze_override(mock_png_bytes: bytes) -> None:
    """Tests analysis with manual modality override."""
    files = {"file": ("random_name.png", io.BytesIO(mock_png_bytes), "image/png")}
    data = {"patient_id": "PT-003", "modality_override": "brain_mri"}
    
    response = client.post("/api/v1/analyze", files=files, data=data)
    assert response.status_code == 201
    res_data = response.json()
    
    # Overrode modality detection
    assert res_data["modality"] == "brain_mri"
    assert res_data["severity"] == "Critical"

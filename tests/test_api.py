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


@pytest.fixture(autouse=True, scope="module")
def authenticated_client(setup_test_database):
    """Registers a reader and attaches its bearer token to the shared client."""
    resp = client.post("/api/v1/auth/register", json={
        "email": "tester@medgraph.dev", "password": "correct-horse", "name": "Dr. Test Reader",
    })
    assert resp.status_code == 201, resp.text
    client.headers["Authorization"] = f"Bearer {resp.json()['access_token']}"
    yield
    client.headers.pop("Authorization", None)

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



# ───────────────────────── Authentication ─────────────────────────

def _anon() -> TestClient:
    return TestClient(app)


def test_protected_routes_require_token() -> None:
    anon = _anon()
    for path in ("/api/v1/history", "/api/v1/case/does-not-exist", "/api/v1/auth/me"):
        assert anon.get(path).status_code == 401
    assert anon.get("/api/v1/health").status_code == 200


def test_register_login_and_me() -> None:
    anon = _anon()
    reg = anon.post("/api/v1/auth/register", json={"email": "Jane@Hospital.org", "password": "s3cure-pass", "name": "Dr. Jane Okafor"})
    assert reg.status_code == 201
    assert reg.json()["user"]["email"] == "jane@hospital.org"

    dup = anon.post("/api/v1/auth/register", json={"email": "jane@hospital.org", "password": "another-pass", "name": "Dup"})
    assert dup.status_code == 409

    bad = anon.post("/api/v1/auth/login", json={"email": "jane@hospital.org", "password": "wrong-pass"})
    assert bad.status_code == 401
    unknown = anon.post("/api/v1/auth/login", json={"email": "nobody@hospital.org", "password": "wrong-pass"})
    assert unknown.json()["detail"] == bad.json()["detail"]

    ok = anon.post("/api/v1/auth/login", json={"email": "jane@hospital.org", "password": "s3cure-pass"})
    assert ok.status_code == 200
    me = anon.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {ok.json()['access_token']}"})
    assert me.status_code == 200 and me.json()["name"] == "Dr. Jane Okafor"


def test_register_validation() -> None:
    anon = _anon()
    assert anon.post("/api/v1/auth/register", json={"email": "not-an-email", "password": "longenough", "name": "X Y"}).status_code == 422
    assert anon.post("/api/v1/auth/register", json={"email": "a@b.co", "password": "short", "name": "X Y"}).status_code == 422


def test_demo_account_is_seeded_on_login() -> None:
    resp = _anon().post("/api/v1/auth/login", json={"email": "reader@medgraph.dev", "password": "radiology"})
    assert resp.status_code == 200
    assert resp.json()["user"]["name"] == "Dr. A. Raman"


def test_tampered_and_expired_tokens_rejected(monkeypatch) -> None:
    from backend.core import security
    from backend.core.config.config import settings

    token = client.headers["Authorization"].split()[1]
    head, body, sig = token.split(".")
    tampered = f"{head}.{body}.{sig[:-2]}AA"
    assert _anon().get("/api/v1/history", headers={"Authorization": f"Bearer {tampered}"}).status_code == 401

    monkeypatch.setattr(settings, "JWT_EXPIRE_MINUTES", -1)
    expired = security.create_access_token("someone")
    assert security.decode_access_token(expired) is None


def test_password_hashing_roundtrip() -> None:
    from backend.core.security import hash_password, verify_password
    h = hash_password("radiology")
    assert h.startswith("pbkdf2_sha256$") and "radiology" not in h
    assert verify_password("radiology", h)
    assert not verify_password("Radiology", h)
    assert not verify_password("x", "garbage")


def test_report_edit_records_editor(mock_png_bytes: bytes) -> None:
    files = {"file": ("scan.png", io.BytesIO(mock_png_bytes), "image/png")}
    created = client.post("/api/v1/analyze", files=files, data={"patient_id": "PT-AUTH"})
    assert created.status_code == 201
    case = created.json()
    overlay = _anon().get(f"/api/v1/overlay/{case['case_id']}")
    assert overlay.status_code == 401
    token = client.headers["Authorization"].split()[1]
    assert _anon().get(f"/api/v1/overlay/{case['case_id']}", params={"token": token}).status_code == 200


def test_auth_can_be_disabled(monkeypatch) -> None:
    from backend.core.config.config import settings
    monkeypatch.setattr(settings, "AUTH_REQUIRED", False)
    assert _anon().get("/api/v1/history").status_code == 200

import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from backend.services.models.storage.database.connection import Base
from backend.services.models.storage.database.models import CaseModel
from backend.services.models.storage.cases.manager import CaseManager
from backend.services.models.storage.audit.manager import AuditManager
from backend.api.schemas.schemas import DiagnosticResult, ReportSchema, ConfidenceSchema, GraphSchema

@pytest.fixture
async def test_db_session() -> AsyncSession:
    """Fixture supplying an isolated in-memory async database session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False
    )
    
    async with session_factory() as session:
        yield session
        await session.rollback()
        
    await engine.dispose()

@pytest.mark.asyncio
async def test_create_and_get_case(test_db_session: AsyncSession) -> None:
    """Tests case creation and retrieval via CaseManager."""
    case_manager = CaseManager(test_db_session)
    
    # Construct mock DiagnosticResult schema
    mock_result = DiagnosticResult(
        case_id="case-111",
        modality="chest_xray",
        metadata={"patient_id": "PT-01", "format": "PNG"},
        findings=[],
        evidence=[],
        knowledge_graph=GraphSchema(nodes=[], edges=[]),
        severity="Moderate",
        confidence=ConfidenceSchema(
            confidence_score=0.92,
            confidence_band="High Confidence",
            evidence_score=0.90,
            model_stability=0.95,
            prediction_reliability=0.92
        ),
        overlay_url="/static/overlay.png",
        report=ReportSchema(
            patient_summary="Summary",
            imaging_findings="Findings",
            evidence_summary="Evidence",
            clinical_interpretation="Interpretation",
            severity_level="Moderate",
            recommendations=["Rec1"],
            limitations="Limitation",
            physician_review_required=True
        )
    )
    
    # Save Case
    await case_manager.create_case(mock_result)
    await test_db_session.commit()
    
    # Retrieve Case
    retrieved = await case_manager.get_case("case-111")
    assert retrieved is not None
    assert retrieved.case_id == "case-111"
    assert retrieved.modality == "chest_xray"
    assert retrieved.report.patient_summary == "Summary"
    assert retrieved.report.recommendations == ["Rec1"]

@pytest.mark.asyncio
async def test_audit_logs_and_edits(test_db_session: AsyncSession) -> None:
    """Tests audit telemetry logging and report version history."""
    case_manager = CaseManager(test_db_session)
    audit_manager = AuditManager(test_db_session)
    
    mock_result = DiagnosticResult(
        case_id="case-222",
        modality="brain_mri",
        metadata={"patient_id": "PT-02"},
        findings=[],
        evidence=[],
        knowledge_graph=GraphSchema(nodes=[], edges=[]),
        severity="Severe",
        confidence=ConfidenceSchema(
            confidence_score=0.88,
            confidence_band="High Confidence",
            evidence_score=0.85,
            model_stability=0.90,
            prediction_reliability=0.88
        ),
        overlay_url="/static/overlay.png",
        report=ReportSchema(
            patient_summary="Original Summary",
            imaging_findings="Findings",
            evidence_summary="Evidence",
            clinical_interpretation="Interpretation",
            severity_level="Severe",
            recommendations=["Rec1"],
            limitations="Limitation",
            physician_review_required=True
        )
    )
    
    # 1. Save Case
    await case_manager.create_case(mock_result)
    
    # 2. Log inference audit
    audit = await audit_manager.log_inference_audit(
        case_id="case-222",
        model_version="1.0.0",
        runtime_ms=120,
        input_metadata={"patient_id": "PT-02"},
        output_data=mock_result.report.model_dump(),
        confidence_data=mock_result.confidence.model_dump(),
        severity="Severe"
    )
    assert audit.runtime_ms == 120
    assert audit.model_version == "1.0.0"
    
    # 3. Log report edit by doctor
    edited_report = mock_result.report.model_copy(update={"patient_summary": "Doctor Edited Summary"})
    await audit_manager.log_report_edit(
        case_id="case-222",
        editor_id="dr_house",
        original_report_schema=mock_result.report,
        edited_report_schema=edited_report,
        doctor_notes="Corrected AI draft summary."
    )
    await test_db_session.commit()
    
    # 4. Verify case retrieves the new updated report version
    retrieved = await case_manager.get_case("case-222")
    assert retrieved is not None
    assert retrieved.report.patient_summary == "Doctor Edited Summary"

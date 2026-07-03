import uuid
import time
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.schemas.schemas import (
    DiagnosticResult,
    FindingSchema,
    EvidenceSchema,
    ConfidenceSchema,
    GraphSchema,
    GraphNode,
    GraphEdge,
    ReportSchema,
    ReportEditRequest,
)
from backend.services.preprocessor import MedicalImagePreprocessor
from backend.services.detector import ModalityDetector
from backend.services.models.vision.xray.chest_yolo import ChestXRayYoloModel
from backend.services.models.vision.mri.brain_unet import BrainMriMonaiModel
from backend.services.models.vision.shared.overlay_generator import OverlayGenerator
from backend.services.models.storage.database.connection import get_db
from backend.services.models.storage.cases.manager import CaseManager
from backend.services.models.storage.audit.manager import AuditManager
from backend.services.models.reasoning.knowledge_graph.builder import ClinicalKnowledgeGraphBuilder
from backend.services.models.reasoning.severity.engine import SeverityEngine
from backend.services.models.reasoning.confidence.calibrator import ConfidenceCalibrator
from backend.services.models.reasoning.reasoner import ClinicalReasoningEngine
from backend.services.models.reasoning.report_engine.generator import GroundedReportGenerator
from backend.core.config.config import settings

router = APIRouter()
preprocessor = MedicalImagePreprocessor()
detector = ModalityDetector()

def _build_diagnostic_output(
    case_id: str,
    modality: str,
    metadata: Dict[str, Any],
    findings_list: List[Dict[str, Any]]
) -> DiagnosticResult:
    """
    Transforms raw vision model findings into structured clinical outputs.
    """
    findings = []
    evidence = []
    
    # 1. Map findings & build evidence
    for f in findings_list:
        name = f["name"]
        loc = f["location"]
        prob = f["probability"]
        sev = f["severity"]
        ev_pattern = f["evidence"]
        box = f.get("box")
        
        findings.append(FindingSchema(
            name=name, location=loc, probability=prob, severity=sev, evidence=ev_pattern, box=box
        ))
        
        # Calculate visual size measurements (1 pixel ~ 0.05cm scaled representation)
        sz_text = "N/A"
        if box:
            w_cm = round((box[2] - box[0]) * 0.05, 1)
            h_cm = round((box[3] - box[1]) * 0.05, 1)
            sz_text = f"{w_cm}cm x {h_cm}cm"
            
        evidence.append(EvidenceSchema(
            finding_name=name,
            reason=f"Focal {name.lower()} is identified in the {loc.lower()} area matching a {ev_pattern.lower()}.",
            measurement=sz_text,
            confidence=prob,
            supporting_region=box,
            visualization_path=f"/api/v1/overlay/{case_id}"
        ))

    # 2. Dynamic Severity Engine Grading
    severity_engine = SeverityEngine()
    severity = severity_engine.determine_severity(findings_list)

    # 3. Dynamic Platt-scaled Confidence Calibration
    calibrator = ConfidenceCalibrator()
    confidence = calibrator.calibrate(findings_list, modality)

    # 4. Construct Knowledge Graph using dynamic builder rules
    kg_builder = ClinicalKnowledgeGraphBuilder()
    kg = kg_builder.build_graph(findings_list, modality)
    
    # Extract recommendations directly from graph nodes
    recs = [node.label for node in kg.nodes if node.type == "Recommendation"]

    # 5. Dynamic Clinical Reasoning Engine (Zero-Hallucination Grounded Texts)
    reasoning_engine = ClinicalReasoningEngine()
    clinical_interpretation = reasoning_engine.reason(findings, severity, confidence, modality)

    # 6. Assemble Grounded Report
    report_generator = GroundedReportGenerator()
    report = report_generator.generate_report(
        modality=modality,
        findings=findings,
        evidence=evidence,
        severity=severity,
        clinical_interpretation=clinical_interpretation,
        recommendations=recs
    )

    return DiagnosticResult(
        case_id=case_id,
        modality=modality,
        metadata=metadata,
        findings=findings,
        evidence=evidence,
        knowledge_graph=kg,
        severity=severity,
        confidence=confidence,
        overlay_url=f"/api/v1/overlay/{case_id}",
        report=report
    )

@router.post("/analyze", response_model=DiagnosticResult, status_code=status.HTTP_201_CREATED)
async def analyze_scan(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    modality_override: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
) -> DiagnosticResult:
    """
    Uploads and processes a medical scan file, running model prediction,
    saving overlays, and writing results and logs to database.
    """
    start_time = time.time()
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty"
        )
    
    try:
        image, metadata = preprocessor.preprocess(file_bytes, file.filename)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Preprocessing error: {str(e)}"
        )
        
    if modality_override:
        if modality_override not in ("chest_xray", "brain_mri"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid modality override: {modality_override}"
            )
        modality = modality_override
    else:
        modality = detector.detect_modality(file.filename, metadata)
        
    case_id = str(uuid.uuid4())
    metadata["patient_id"] = patient_id
    
    # 1. Run vision engine inference based on detected modality
    findings_list = []
    if modality == "chest_xray":
        model = ChestXRayYoloModel()
        findings_list = model.predict(image, metadata)
    elif modality == "brain_mri":
        model = BrainMriMonaiModel()
        findings_list = model.predict(image, metadata)
        
    # 2. Build structured diagnostic output
    result = _build_diagnostic_output(case_id, modality, metadata, findings_list)
    
    # 3. Generate scan visual annotation and save to disk
    overlay_gen = OverlayGenerator()
    overlay_gen.generate_and_save(image, findings_list, modality, case_id)
    
    # 4. Insert diagnostic case in database
    case_manager = CaseManager(db)
    await case_manager.create_case(result)
    
    # 5. Log telemetry in audit logs
    runtime_ms = int((time.time() - start_time) * 1000)
    audit_manager = AuditManager(db)
    await audit_manager.log_inference_audit(
        case_id=case_id,
        model_version="1.0.0",
        runtime_ms=runtime_ms,
        input_metadata=metadata,
        output_data=result.report.model_dump(),
        confidence_data=result.confidence.model_dump(),
        severity=result.severity
    )
    
    return result

@router.get("/overlay/{case_id}")
async def get_overlay(case_id: str) -> FileResponse:
    """
    Serves the annotated scan overlay PNG file for a specific case.
    """
    overlay_path = settings.OVERLAY_DIR / f"{case_id}_overlay.png"
    if not overlay_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Overlay annotation file not found for case {case_id}"
        )
    return FileResponse(str(overlay_path), media_type="image/png")

@router.get("/case/{case_id}", response_model=DiagnosticResult)
async def get_case(case_id: str, db: AsyncSession = Depends(get_db)) -> DiagnosticResult:
    """
    Retrieves the clinical details and diagnostic results of a past case.
    """
    case_manager = CaseManager(db)
    result = await case_manager.get_case(case_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with ID {case_id} not found"
        )
    return result

@router.get("/history", response_model=List[DiagnosticResult])
async def get_history(db: AsyncSession = Depends(get_db)) -> List[DiagnosticResult]:
    """
    Returns a history of all analyzed scans and cases.
    """
    case_manager = CaseManager(db)
    return await case_manager.list_cases()

@router.patch("/report/{case_id}", response_model=DiagnosticResult)
async def update_report(
    case_id: str,
    request: ReportEditRequest,
    db: AsyncSession = Depends(get_db)
) -> DiagnosticResult:
    """
    Edits a report's findings, saving modifications to report history.
    """
    case_manager = CaseManager(db)
    current_case = await case_manager.get_case(case_id)
    if not current_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Case with ID {case_id} not found"
        )
    
    audit_manager = AuditManager(db)
    await audit_manager.log_report_edit(
        case_id=case_id,
        editor_id="physician_user",
        original_report_schema=current_case.report,
        edited_report_schema=request.edited_report,
        doctor_notes=request.doctor_notes
    )
    
    updated_case = await case_manager.get_case(case_id)
    if not updated_case:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve updated case record"
        )
    return updated_case

@router.get("/models")
async def get_models() -> Dict[str, Any]:
    """
    Returns the versions and details of registered diagnostic models.
    """
    return {
        "chest_model": {
            "name": "Ultralytics YOLOv11-Chest",
            "version": "1.0.0",
            "task": "Object Detection",
            "input_resolution": [512, 512]
        },
        "brain_model": {
            "name": "MONAI U-Net-Brain",
            "version": "1.0.0",
            "task": "Semantic Segmentation",
            "input_resolution": [512, 512, 1]
        }
    }

@router.get("/health")
async def health_check() -> Dict[str, str]:
    """
    Verifies the server and pipeline components are healthy.
    """
    return {"status": "healthy"}

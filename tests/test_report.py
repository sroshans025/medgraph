from backend.services.models.reasoning.report_engine.generator import GroundedReportGenerator
from backend.api.schemas.schemas import FindingSchema, EvidenceSchema

def test_grounded_report_generator_chest() -> None:
    """Tests that the report generator successfully compiles all 8 sections for chest xray."""
    generator = GroundedReportGenerator()
    
    findings = [FindingSchema(
        name="Opacity",
        location="Right Lower Lobe",
        probability=0.92,
        severity="Moderate",
        evidence="Consolidation Pattern",
        box=[120.0, 240.0, 310.0, 420.0]
    )]
    
    evidence = [EvidenceSchema(
        finding_name="Opacity",
        reason="Focal consolidation.",
        measurement="3.5cm x 4.2cm",
        confidence=0.92,
        supporting_region=[120.0, 240.0, 310.0, 420.0],
        visualization_path="/api/v1/overlay/1"
    )]
    
    report = generator.generate_report(
        modality="chest_xray",
        findings=findings,
        evidence=evidence,
        severity="Moderate",
        clinical_interpretation="Logical clinical interpretation paragraph.",
        recommendations=["Follow-up Chest X-ray."]
    )
    
    # Verify all 8 clinical sections are present
    assert report.patient_summary == "Case processed using MedGraph AI platform. Modality: chest_xray."
    assert "consolidation/opacity" in report.imaging_findings
    assert "1" in report.evidence_summary
    assert report.clinical_interpretation == "Logical clinical interpretation paragraph."
    assert report.severity_level == "Moderate"
    assert report.recommendations == ["Follow-up Chest X-ray."]
    assert len(report.limitations) > 0
    assert report.physician_review_required is True

def test_grounded_report_generator_brain() -> None:
    """Tests report generator compilation for brain mri scans."""
    generator = GroundedReportGenerator()
    
    findings = [FindingSchema(
        name="Hyperintensity",
        location="Right Temporal Lobe",
        probability=0.88,
        severity="Severe",
        evidence="T2/FLAIR Hyperintensity",
        box=[200.0, 150.0, 280.0, 230.0]
    )]
    
    report = generator.generate_report(
        modality="brain_mri",
        findings=findings,
        evidence=[],
        severity="Severe",
        clinical_interpretation="Brain lesion reasoning statement.",
        recommendations=["Brain MRI with contrast."]
    )
    
    assert report.patient_summary == "Case processed using MedGraph AI platform. Modality: brain_mri."
    assert "hyperintensity signal" in report.imaging_findings
    assert report.severity_level == "Severe"
    assert report.recommendations == ["Brain MRI with contrast."]
    assert report.physician_review_required is True

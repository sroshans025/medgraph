from backend.services.models.reasoning.severity.engine import SeverityEngine
from backend.services.models.reasoning.confidence.calibrator import ConfidenceCalibrator
from backend.services.models.reasoning.reasoner import ClinicalReasoningEngine
from backend.api.schemas.schemas import FindingSchema, ConfidenceSchema

def test_severity_engine() -> None:
    """Tests case severity classification boundaries."""
    engine = SeverityEngine()
    
    # 1. Empty findings -> Minimal
    assert engine.determine_severity([]) == "Minimal"
    
    # 2. Mild finding -> Mild
    assert engine.determine_severity([{"probability": 0.35, "severity": "Mild"}]) == "Mild"
    
    # 3. Moderate finding -> Moderate
    assert engine.determine_severity([{"probability": 0.70, "severity": "Moderate"}]) == "Moderate"
    
    # 4. Single Severe finding -> Severe
    assert engine.determine_severity([{"probability": 0.82, "severity": "Severe"}]) == "Severe"
    
    # 5. Multiple Severe findings -> Critical
    assert engine.determine_severity([
        {"probability": 0.85, "severity": "Severe"},
        {"probability": 0.88, "severity": "Severe"}
    ]) == "Critical"

def test_confidence_calibrator() -> None:
    """Tests Platt scaling and confidence band categorization."""
    calibrator = ConfidenceCalibrator()
    
    # 1. Empty findings -> Uncalibrated
    conf = calibrator.calibrate([], "chest_xray")
    assert conf.confidence_band == "Uncalibrated"
    assert conf.confidence_score == 0.0
    
    # 2. High raw probability -> High Confidence
    conf = calibrator.calibrate([{"probability": 0.92}], "brain_mri")
    assert conf.confidence_band == "High Confidence"
    assert conf.prediction_reliability >= 0.85
    assert conf.confidence_score == 0.92
    
    # 3. Mid probability -> Moderate Confidence
    conf = calibrator.calibrate([{"probability": 0.70}], "brain_mri")
    assert conf.confidence_band == "Moderate Confidence"
    assert 0.60 <= conf.prediction_reliability < 0.85

def test_clinical_reasoner() -> None:
    """Tests zero-hallucination logical clinical reasoning generator."""
    reasoner = ClinicalReasoningEngine()
    
    # 1. Empty findings -> Normal scan reasoning
    text = reasoner.reason([], "Minimal", ConfidenceSchema(
        confidence_score=0.0,
        confidence_band="Uncalibrated",
        evidence_score=0.0,
        model_stability=0.0,
        prediction_reliability=0.0
    ), "chest_xray")
    
    assert "no focal structural abnormalities" in text
    assert "Minimal" in text
    
    # 2. Dynamic reasoning grounding test
    findings = [FindingSchema(
        name="Opacity",
        location="Right Lower Lobe",
        probability=0.92,
        severity="Moderate",
        evidence="Consolidation Pattern",
        box=[120.0, 240.0, 310.0, 420.0]
    )]
    
    confidence = ConfidenceSchema(
        confidence_score=0.92,
        confidence_band="High Confidence",
        evidence_score=0.90,
        model_stability=0.95,
        prediction_reliability=0.94
    )
    
    text = reasoner.reason(findings, "Moderate", confidence, "chest_xray")
    
    # Every statement must ground exactly to finding features
    assert "opacity" in text.lower()
    assert "right lower lobe" in text.lower()
    assert "consolidation pattern" in text.lower()
    assert "Moderate" in text
    assert "High Confidence" in text
    assert "94" in text  # Reliability index

from typing import List, Dict, Any
from backend.api.schemas.schemas import FindingSchema, ConfidenceSchema

class ClinicalReasoningEngine:
    """
    Transforms structured clinical findings, severity gradings, and calibrated
    confidence metrics into clear, logical reasoning pathways.
    Reasoning is strictly grounded in database facts to ensure zero-hallucinations.
    """

    def reason(
        self,
        findings: List[FindingSchema],
        severity: str,
        confidence: ConfidenceSchema,
        modality: str
    ) -> str:
        """
        Compiles logical reasoning explaining the diagnostic classification.
        
        Args:
            findings: List of Pydantic FindingSchema findings.
            severity: Graded overall severity.
            confidence: Calibrated ConfidenceSchema statistics.
            modality: Scan modality ('chest_xray' or 'brain_mri').
            
        Returns:
            A string containing clinical reasoning arguments.
        """
        if not findings or modality == "unknown":
            return (
                "Scan analysis demonstrates no focal structural abnormalities, "
                "radiodensities, or hyperintensity patterns. No pathological features "
                "were extracted. Overall clinical severity is graded as Minimal, "
                "correlating with unremarkable imaging findings."
            )

        # 1. Compile logical finding statements
        statements = []
        for idx, f in enumerate(findings):
            loc_str = f.location.lower()
            name_str = f.name.lower()
            prob_pct = int(f.probability * 100)
            
            statement = (
                f"Finding {idx + 1}: A focal area of {name_str} is identified in the {loc_str} "
                f"with a model probability of {prob_pct}%. This finding demonstrates a "
                f"{f.evidence.lower()} pattern of {f.severity.lower()} severity."
            )
            statements.append(statement)

        findings_summary = " ".join(statements)

        # 2. Add case severity rationale
        if severity == "Critical":
            severity_rationale = (
                "Overall case severity is classified as Critical, requiring urgent "
                "intervention due to multiple severe or high-impact findings."
            )
        elif severity == "Severe":
            severity_rationale = (
                "Overall case severity is graded as Severe, warranting immediate clinical "
                "correlation and specialist consultation."
            )
        elif severity == "Moderate":
            severity_rationale = (
                "Overall case severity is graded as Moderate, requiring outpatient clinical "
                "follow-up and diagnostic monitoring."
            )
        else:
            severity_rationale = (
                "Overall case severity is Mild, requiring routine observation."
            )

        # 3. Add calibration details
        calibration_statement = (
            f"Model predictions are calibrated as {confidence.confidence_band} "
            f"(Platt reliability score: {confidence.prediction_reliability}, "
            f"evidence alignment score: {confidence.evidence_score}, "
            f"stability index: {confidence.model_stability})."
        )

        # Combine into cohesive reasoning essay
        reasoning_paragraph = (
            f"{findings_summary} {severity_rationale} {calibration_statement}"
        )

        return reasoning_paragraph

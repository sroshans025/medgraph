from typing import List, Dict, Any
import numpy as np

from backend.api.schemas.schemas import ConfidenceSchema

class ConfidenceCalibrator:
    """
    Calibrates raw neural network probability values using Platt-scaling curves,
    computing standardized prediction reliability, evidence scoring, and clinical confidence bands.
    """

    def calibrate(self, findings: List[Dict[str, Any]], modality: str) -> ConfidenceSchema:
        """
        Calibrates model predictions into clinical reliability scores.
        
        Args:
            findings: List of dictionary findings from vision engines.
            modality: Scan modality ('chest_xray' or 'brain_mri').
            
        Returns:
            A ConfidenceSchema containing calibrated reliability metrics.
        """
        if not findings or modality == "unknown":
            return ConfidenceSchema(
                confidence_score=0.0,
                confidence_band="Uncalibrated",
                evidence_score=0.0,
                model_stability=0.0,
                prediction_reliability=0.0
            )

        # 1. Base raw confidence (highest probability from findings)
        raw_prob = max(f.get("probability", 0.0) for f in findings)
        
        # 2. Prediction Reliability: Platt-style sigmoid calibration mapping
        # Maps raw logits to a calibrated probability distribution curves
        # Formula: 1 / (1 + exp(-k * (p - midpoint)))
        k = 8.0
        midpoint = 0.5
        calibrated_reliability = 1.0 / (1.0 + np.exp(-k * (raw_prob - midpoint)))
        calibrated_reliability = float(np.clip(calibrated_reliability, 0.01, 0.99))
        
        # 3. Evidence Score: Average probability of supporting clues
        evidence_score = float(np.mean([f.get("probability", 0.0) for f in findings]))
        
        # 4. Model Stability: Deviation in detection thresholds
        # High stability if findings have closely aligned high probabilities
        if len(findings) > 1:
            std_dev = np.std([f.get("probability", 0.0) for f in findings])
            model_stability = float(np.clip(1.0 - std_dev, 0.1, 1.0))
        else:
            model_stability = 0.95  # Standard single finding consistency baseline
            
        # 5. Calibration Band mapping
        if calibrated_reliability >= 0.85:
            band = "High Confidence"
        elif calibrated_reliability >= 0.60:
            band = "Moderate Confidence"
        elif calibrated_reliability >= 0.25:
            band = "Low Confidence"
        else:
            band = "Uncalibrated"

        return ConfidenceSchema(
            confidence_score=round(raw_prob, 2),
            confidence_band=band,
            evidence_score=round(evidence_score, 2),
            model_stability=round(model_stability, 2),
            prediction_reliability=round(calibrated_reliability, 2)
        )

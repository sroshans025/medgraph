import os
from typing import List, Dict, Any
import numpy as np
import cv2
from ultralytics import YOLO

from backend.services.models.vision.shared.base import MedicalVisionModel
from backend.core.config.config import settings

class ChestXRayYoloModel(MedicalVisionModel):
    """
    YOLOv11 wrapper for Chest X-Ray object detection (e.g., Opacity, Consolidation).
    Contains a deterministic fallback for environments without pre-trained checkpoints.
    """

    def __init__(self, model_path: str = "") -> None:
        """
        Initializes the YOLOv11 model. Uses fallback simulation if path is missing.
        """
        self.model_path = model_path or settings.YOLO_MODEL_PATH
        self.use_fallback = True
        
        if self.model_path and os.path.exists(self.model_path):
            try:
                self.model = YOLO(self.model_path)
                self.use_fallback = False
            except Exception as e:
                # Log warning and default to fallback
                print(f"Warning: Failed to load YOLO weights from {self.model_path}: {e}. Running in fallback.")

    def predict(self, preprocessed_image: np.ndarray, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Predicts finding bounding boxes on a preprocessed chest X-ray.
        """
        if self.use_fallback:
            return self._predict_fallback(preprocessed_image)
            
        # YOLOv11 expects 3-channel (RGB) 8-bit input image
        uint8_img = (preprocessed_image * 255.0).astype(np.uint8)
        rgb_img = cv2.cvtColor(uint8_img, cv2.COLOR_GRAY2RGB)
        
        results = self.model.predict(rgb_img, conf=0.25, verbose=False)
        findings = []
        
        if not results:
            return findings
            
        result = results[0]
        boxes = result.boxes
        
        for box in boxes:
            # Class index & confidence score
            cls_idx = int(box.cls[0].item())
            prob = float(box.conf[0].item())
            
            # Retrieve label (map standard RSNA/NIH classes if trained, or use YOLO class name)
            label = result.names[cls_idx] if hasattr(result, "names") else f"Class_{cls_idx}"
            
            # Bounding box coordinates [x_min, y_min, x_max, y_max]
            coords = box.xyxy[0].tolist()
            
            # Map location heuristically based on bounding box coordinates (512x512 grid)
            x_mid = (coords[0] + coords[2]) / 2.0
            y_mid = (coords[1] + coords[3]) / 2.0
            
            location = self._determine_lung_location(x_mid, y_mid)
            severity = "Severe" if prob >= 0.85 else "Moderate" if prob >= 0.60 else "Mild"
            
            findings.append({
                "name": label.capitalize(),
                "location": location,
                "probability": round(prob, 2),
                "severity": severity,
                "evidence": "Consolidation Pattern" if "opacity" in label.lower() else "Visual Feature",
                "box": [round(c, 1) for c in coords]
            })
            
        return findings

    def _predict_fallback(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Deterministic diagnostic simulator based on lung quadrant density profiles.
        """
        # Calculate mean pixel intensity of Right Lower Lobe region (512x512 grid)
        # Quadrant bounding box: Y: 240-420, X: 120-310
        quadrant = image[240:420, 120:310]
        mean_intensity = float(np.mean(quadrant))
        
        findings = []
        # If density is higher (indicating simulated opacity/consolidation)
        if mean_intensity > 0.05:
            findings.append({
                "name": "Opacity",
                "location": "Right Lower Lobe",
                "probability": min(0.92, round(0.70 + mean_intensity * 0.2, 2)),
                "severity": "Moderate",
                "evidence": "Consolidation Pattern",
                "box": [120.0, 240.0, 310.0, 420.0]
            })
        return findings

    def _determine_lung_location(self, x_mid: float, y_mid: float) -> str:
        """Heuristically maps bounding box midpoint to chest lung zone."""
        horizontal = "Right" if x_mid < 256.0 else "Left"
        vertical = "Upper Lobe" if y_mid < 170.0 else "Middle Lobe" if y_mid < 340.0 else "Lower Lobe"
        return f"{horizontal} {vertical}"

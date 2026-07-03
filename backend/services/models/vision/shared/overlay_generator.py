from pathlib import Path
from typing import List, Dict, Any
import numpy as np
import cv2

from backend.core.config.config import settings

class OverlayGenerator:
    """
    Generates visual overlay annotations (bounding boxes, segmentation contours,
    semi-transparent masks) on top of preprocessed 2D medical scans.
    """

    def generate_and_save(
        self,
        image: np.ndarray,
        findings: List[Dict[str, Any]],
        modality: str,
        case_id: str
    ) -> Path:
        """
        Draws annotations based on findings and modality, saving the file to storage.
        
        Args:
            image: 2D normalized float32 numpy array.
            findings: List of dictionary findings.
            modality: Detected modality ('chest_xray' or 'brain_mri').
            case_id: Unique case identifier.
            
        Returns:
            The Path where the generated overlay image was saved.
        """
        # 1. Convert normalized float32 grayscale image to 8-bit BGR color
        uint8_img = (image * 255.0).astype(np.uint8)
        bgr_img = cv2.cvtColor(uint8_img, cv2.COLOR_GRAY2BGR)
        
        # 2. Add visual annotations
        if modality == "chest_xray":
            self._annotate_chest_xray(bgr_img, findings)
        elif modality == "brain_mri":
            self._annotate_brain_mri(bgr_img, findings)
            
        # 3. Save to storage
        output_path = settings.OVERLAY_DIR / f"{case_id}_overlay.png"
        cv2.imwrite(str(output_path), bgr_img)
        
        return output_path

    def _annotate_chest_xray(self, img: np.ndarray, findings: List[Dict[str, Any]]) -> None:
        """Draws bounding boxes and labels for Chest X-Ray findings."""
        for f in findings:
            box = f.get("box")
            if not box or len(box) != 4:
                continue
                
            x1, y1, x2, y2 = [int(coord) for coord in box]
            prob_pct = int(f.get("probability", 0.0) * 100)
            label = f"{f.get('name', 'Finding')} ({prob_pct}%)"
            
            # Red box for visual opacity findings (BGR: [0, 0, 255])
            color = (0, 0, 255)
            cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
            
            # Draw semi-transparent background fill for label text
            text_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)[0]
            cv2.rectangle(img, (x1, y1 - 20), (x1 + text_size[0] + 10, y1), color, -1)
            
            # Text inside box
            cv2.putText(
                img, label, (x1 + 5, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA
            )

    def _annotate_brain_mri(self, img: np.ndarray, findings: List[Dict[str, Any]]) -> None:
        """Applies semi-transparent masks and contours for brain MRI lesions."""
        overlay = img.copy()
        
        # Color: Purple/Teal representing lesion highlight
        color = (255, 0, 128)  # Deep Pink
        
        for f in findings:
            box = f.get("box")
            if not box or len(box) != 4:
                continue
                
            x1, y1, x2, y2 = [int(coord) for coord in box]
            
            # Draw a filled circle/ellipse representing a segmentation mask inside bounding area
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2
            rx = (x2 - x1) // 2
            ry = (y2 - y1) // 2
            
            cv2.ellipse(overlay, (cx, cy), (rx, ry), 0, 0, 360, color, -1)
            cv2.ellipse(img, (cx, cy), (rx, ry), 0, 0, 360, color, 2)
            
            # Annotate text
            prob_pct = int(f.get("probability", 0.0) * 100)
            label = f"{f.get('name', 'Lesion')} ({prob_pct}%)"
            
            cv2.putText(
                img, label, (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA
            )
            
        # Blend overlay (alpha blend 35% transparency)
        cv2.addWeighted(overlay, 0.35, img, 0.65, 0, img)

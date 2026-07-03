import pytest
import numpy as np
from backend.services.models.vision.xray.chest_yolo import ChestXRayYoloModel
from backend.services.models.vision.mri.brain_unet import BrainMriMonaiModel
from backend.services.models.vision.shared.overlay_generator import OverlayGenerator
from backend.core.config.config import settings

def test_chest_yolo_fallback() -> None:
    """Tests the Chest X-Ray YOLO model fallback heuristics."""
    model = ChestXRayYoloModel()
    
    # 1. Image with zero intensity (normal lungs/empty background) -> should return no findings
    empty_image = np.zeros((512, 512), dtype=np.float32)
    findings = model.predict(empty_image, {})
    assert len(findings) == 0
    
    # 2. Image with simulated consolidation in the right lower quadrant -> should trigger finding
    consolidation_image = np.zeros((512, 512), dtype=np.float32)
    consolidation_image[240:420, 120:310] = 0.8  # Set dense pixels
    findings = model.predict(consolidation_image, {})
    assert len(findings) == 1
    assert findings[0]["name"] == "Opacity"
    assert findings[0]["location"] == "Right Lower Lobe"
    assert findings[0]["box"] == [120.0, 240.0, 310.0, 420.0]

def test_brain_unet_fallback() -> None:
    """Tests the Brain MRI MONAI model fallback segmenter."""
    model = BrainMriMonaiModel()
    
    # 1. Clean image -> should fall back to circular lesion mock
    clean_image = np.zeros((512, 512), dtype=np.float32)
    findings = model.predict(clean_image, {})
    assert len(findings) == 1
    assert findings[0]["name"] == "Hyperintensity"
    assert findings[0]["box"] == [200.0, 150.0, 281.0, 231.0]
    
    # 2. Image with high intensity lesion spot -> should detect contour around it
    lesion_image = np.zeros((512, 512), dtype=np.float32)
    cv2 = pytest.importorskip("cv2")
    cv2.circle(lesion_image, (300, 300), 20, 0.9, -1)  # Draw bright spot at (300, 300)
    findings = model.predict(lesion_image, {})
    assert len(findings) == 1
    assert findings[0]["name"] == "Hyperintensity"
    # Centroid of (300, 300) should place it in the Left Temporal or Occipital
    assert "Left" in findings[0]["location"]

def test_overlay_generator() -> None:
    """Tests overlay generator creates annotated scan files."""
    generator = OverlayGenerator()
    image = np.zeros((512, 512), dtype=np.float32)
    
    # Mock chest findings
    findings = [{
        "name": "Opacity",
        "location": "Right Lower Lobe",
        "probability": 0.92,
        "severity": "Moderate",
        "evidence": "Consolidation Pattern",
        "box": [120.0, 240.0, 310.0, 420.0]
    }]
    
    case_id = "test-case-overlay"
    output_path = generator.annotate_and_save = generator.generate_and_save(
        image, findings, "chest_xray", case_id
    )
    
    assert output_path.exists()
    assert output_path.suffix == ".png"
    
    # Cleanup test output
    import os
    if output_path.exists():
        os.remove(output_path)

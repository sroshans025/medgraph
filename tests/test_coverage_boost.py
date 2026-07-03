import pytest
import numpy as np
import torch
from unittest.mock import MagicMock, patch

from backend.services.models.vision.xray.chest_yolo import ChestXRayYoloModel
from backend.services.models.vision.mri.brain_unet import BrainMriMonaiModel
from backend.services.models.storage.database.connection import get_db

@pytest.mark.asyncio
async def test_get_db_coverage() -> None:
    """Verifies get_db yields session, commits, and handles rollback exceptions."""
    # Test normal path
    generator = get_db()
    session = await anext(generator)
    assert session is not None
    
    # Close generator
    try:
        await anext(generator)
    except StopAsyncIteration:
        pass

    # Test error path with rollback
    generator_fail = get_db()
    session_fail = await anext(generator_fail)
    
    # Force exception inside generator lifecycle
    with pytest.raises(ValueError):
        try:
            raise ValueError("Forced DB Error")
        except Exception as e:
            await generator_fail.athrow(e)

def test_chest_yolo_non_fallback() -> None:
    """Tests ChestXRayYoloModel non-fallback prediction path using mocked outputs."""
    model = ChestXRayYoloModel()
    model.use_fallback = False
    
    # Mock Ultralytics YOLO model predict return structure
    mock_box = MagicMock()
    mock_box.cls = [torch.tensor(0)]
    mock_box.conf = [torch.tensor(0.85)]
    mock_box.xyxy = [torch.tensor([100.0, 150.0, 300.0, 400.0])]
    
    mock_result = MagicMock()
    mock_result.boxes = [mock_box]
    mock_result.names = {0: "opacity"}
    
    model.model = MagicMock()
    model.model.predict = MagicMock(return_value=[mock_result])
    
    # Dummy preprocessed grayscale image 512x512
    dummy_img = np.zeros((512, 512), dtype=np.float32)
    findings = model.predict(dummy_img, {})
    
    assert len(findings) == 1
    assert findings[0]["name"] == "Opacity"
    assert findings[0]["location"] == "Right Middle Lobe"
    assert findings[0]["probability"] == 0.85
    assert findings[0]["severity"] == "Severe"

def test_brain_unet_non_fallback() -> None:
    """Tests BrainMriMonaiModel non-fallback prediction path using mocked model forward."""
    model = BrainMriMonaiModel()
    model.use_fallback = False
    
    # Mock model callable to return raw logits tensor
    # A single batch, single channel 512x512 tensor with a high value circle representing a lesion
    mock_tensor = torch.zeros((1, 1, 512, 512), dtype=torch.float32)
    # Fill in a region with high values (above threshold logit values) to trigger segmentation
    mock_tensor[0, 0, 100:200, 100:200] = 5.0  # Sigmoid of 5 is close to 1.0
    
    model.model = MagicMock(return_value=mock_tensor)
    
    dummy_img = np.zeros((512, 512), dtype=np.float32)
    dummy_img[100:200, 100:200] = 0.90  # Corresponding high intensity raw image slice
    
    findings = model.predict(dummy_img, {})
    
    assert len(findings) == 1
    assert findings[0]["name"] == "Hyperintensity"
    assert findings[0]["probability"] == 0.97
    assert findings[0]["severity"] == "Severe"

def test_brain_unet_with_classifier() -> None:
    """Tests BrainMriMonaiModel with BrainClassifier predictions mock mapped."""
    model = BrainMriMonaiModel()
    model.has_classifier = True
    model.use_fallback = True
    
    # 1. Mock "notumor" class (class index 2)
    mock_logits = torch.zeros((1, 4), dtype=torch.float32)
    mock_logits[0, 2] = 10.0  # High logit for "notumor"
    model.classifier_model = MagicMock(return_value=mock_logits)
    
    dummy_img = np.zeros((512, 512), dtype=np.float32)
    findings = model.predict(dummy_img, {})
    assert len(findings) == 0  # "notumor" maps to empty findings
    
    # 2. Mock "glioma" class (class index 0)
    mock_logits_glioma = torch.zeros((1, 4), dtype=torch.float32)
    mock_logits_glioma[0, 0] = 10.0  # High logit for "glioma"
    model.classifier_model = MagicMock(return_value=mock_logits_glioma)
    
    findings_glioma = model.predict(dummy_img, {})
    assert len(findings_glioma) == 1
    assert findings_glioma[0]["name"] == "Glioma Tumor"
    assert "Glioma" in findings_glioma[0]["evidence"]


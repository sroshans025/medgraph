import pytest
import numpy as np
from backend.services.preprocessor import MedicalImagePreprocessor

def test_preprocess_standard_image(mock_png_bytes: bytes) -> None:
    """Tests standard PNG preprocessing."""
    preprocessor = MedicalImagePreprocessor(target_size=(256, 256))
    img, metadata = preprocessor.preprocess(mock_png_bytes, "chest_xray.png")
    
    assert img.shape == (256, 256)
    assert img.dtype == np.float32
    assert img.max() <= 1.0
    assert img.min() >= 0.0
    assert metadata["format"] == "PNG"
    assert metadata["original_width"] == 100
    assert metadata["original_height"] == 100

def test_preprocess_dicom(mock_dicom_bytes: bytes) -> None:
    """Tests DICOM image preprocessing and tag extraction."""
    preprocessor = MedicalImagePreprocessor(target_size=(256, 256))
    img, metadata = preprocessor.preprocess(mock_dicom_bytes, "scan.dcm")
    
    assert img.shape == (256, 256)
    assert img.dtype == np.float32
    assert img.max() <= 1.0
    assert metadata["format"] == "DICOM"
    assert metadata["patient_id"] == "PT-12345"
    assert metadata["patient_age"] == "045Y"
    assert metadata["patient_sex"] == "M"
    assert metadata["modality"] == "MR"

def test_preprocess_nifti(mock_nifti_bytes: bytes) -> None:
    """Tests NIfTI volumetric slice extraction and reorientation."""
    preprocessor = MedicalImagePreprocessor(target_size=(128, 128))
    img, metadata = preprocessor.preprocess(mock_nifti_bytes, "brain.nii.gz")
    
    assert img.shape == (128, 128)
    assert img.dtype == np.float32
    assert metadata["format"] == "NIfTI"
    assert metadata["volume_shape"] == [32, 32, 32]
    assert metadata["extracted_slice_index"] == 16

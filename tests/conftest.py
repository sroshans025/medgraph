import io
import tempfile
import pytest
import numpy as np
import cv2
import pydicom
from pydicom.dataset import Dataset, FileMetaDataset
import nibabel as nib

@pytest.fixture
def mock_png_bytes() -> bytes:
    """Generates valid 100x100 grayscale PNG file bytes."""
    img = np.zeros((100, 100), dtype=np.uint8)
    cv2.circle(img, (50, 50), 30, 255, -1)
    _, encoded = cv2.imencode(".png", img)
    return encoded.tobytes()

@pytest.fixture
def mock_dicom_bytes() -> bytes:
    """Generates valid minimal DICOM file bytes containing metadata tags."""
    # Create File Meta
    file_meta = FileMetaDataset()
    file_meta.FileMetaInformationGroupLength = 0
    file_meta.FileMetaInformationVersion = b"\x00\x01"
    file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.7"
    file_meta.MediaStorageSOPInstanceUID = "1.2.3"
    file_meta.ImplementationClassUID = "1.2.3.4"
    file_meta.TransferSyntaxUID = "1.2.840.10008.1.2.1"  # Explicit VR Little Endian

    # Create Dataset
    ds = Dataset()
    ds.file_meta = file_meta
    ds.is_little_endian = True
    ds.is_implicit_VR = False

    # Standard clinical metadata
    ds.PatientID = "PT-12345"
    ds.PatientAge = "045Y"
    ds.PatientSex = "M"
    ds.Modality = "MR"
    ds.BodyPartExamined = "BRAIN"
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.Rows = 64
    ds.Columns = 64
    ds.BitsAllocated = 16
    ds.BitsStored = 12
    ds.HighBit = 11
    ds.PixelRepresentation = 0
    ds.SamplesPerPixel = 1

    # Create dummy pixel array
    pixel_array = np.zeros((64, 64), dtype=np.uint16)
    cv2.circle(pixel_array, (32, 32), 15, 1000, -1)
    ds.PixelData = pixel_array.tobytes()

    # Save to byte buffer using standard enforce_file_format
    buffer = io.BytesIO()
    pydicom.dcmwrite(buffer, ds, enforce_file_format=True)
    
    return buffer.getvalue()

@pytest.fixture
def mock_nifti_bytes() -> bytes:
    """Generates valid 3D NIfTI file bytes."""
    # Create a 3D volume
    data = np.zeros((32, 32, 32), dtype=np.float32)
    slice_2d = np.zeros((32, 32), dtype=np.float32)
    cv2.circle(slice_2d, (16, 16), 8, 1.0, -1)
    data[:, :, 16] = slice_2d
    
    # Create NIfTI image representation
    img = nib.Nifti1Image(data, affine=np.eye(4))
    
    # Save to temp path, read bytes, clean up
    with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as temp_file:
        temp_path = temp_file.name
        
    try:
        nib.save(img, temp_path)
        with open(temp_path, "rb") as f:
            content = f.read()
        return content
    finally:
        import os
        if os.path.exists(temp_path):
            os.remove(temp_path)

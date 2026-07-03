import io
import os
import tempfile
from typing import Dict, Any, Tuple, Optional
import cv2
import numpy as np
import nibabel as nib
import pydicom

class MedicalImagePreprocessor:
    """
    Handles preprocessing (resizing, normalization, orientation correction) 
    and metadata extraction for PNG, JPEG, DICOM, and NIfTI medical files.
    """

    def __init__(self, target_size: Tuple[int, int] = (512, 512)) -> None:
        """
        Initializes preprocessor with target resolution.
        """
        self.target_size = target_size

    def preprocess(self, file_bytes: bytes, filename: str) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Main entry point to preprocess file bytes based on file format.
        
        Args:
            file_bytes: Raw binary content of the file.
            filename: Original file name to determine fallback types.
            
        Returns:
            A tuple containing:
                - preprocessed_image: Normalized and resized 2D float32 numpy array.
                - metadata: Extracted DICOM/NIfTI/Image metadata.
        """
        ext = filename.lower()
        
        # Check DICOM file signature
        if file_bytes[128:132] == b"DICM" or ext.endswith((".dcm", ".dicom")):
            return self._preprocess_dicom(file_bytes)
        
        # Check NIfTI
        elif ext.endswith((".nii", ".nii.gz")):
            return self._preprocess_nifti(file_bytes)
        
        # Standard images
        else:
            return self._preprocess_standard_image(file_bytes, filename)

    def _preprocess_standard_image(self, file_bytes: bytes, filename: str) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Preprocesses standard PNG/JPEG scans.
        """
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        
        if img is None:
            raise ValueError(f"Failed to decode image from bytes for file: {filename}")
            
        original_shape = img.shape
        resized_img = cv2.resize(img, self.target_size, interpolation=cv2.INTER_AREA)
        
        # Normalize to [0.0, 1.0]
        normalized_img = resized_img.astype(np.float32) / 255.0
        
        metadata = {
            "format": filename.split(".")[-1].upper(),
            "original_width": original_shape[1],
            "original_height": original_shape[0],
            "channels": 1,
            "patient_age": "Unknown",
            "patient_sex": "Unknown",
        }
        
        return normalized_img, metadata

    def _preprocess_dicom(self, file_bytes: bytes) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Preprocesses DICOM files, handles inversions, normalization, and tag extraction.
        """
        # Load DICOM dataset from bytes
        dicom_stream = io.BytesIO(file_bytes)
        ds = pydicom.dcmread(dicom_stream)
        
        pixel_array = ds.pixel_array
        original_shape = pixel_array.shape
        
        # Extract metadata tags
        metadata = {
            "format": "DICOM",
            "patient_id": getattr(ds, "PatientID", "Unknown"),
            "patient_age": getattr(ds, "PatientAge", "Unknown"),
            "patient_sex": getattr(ds, "PatientSex", "Unknown"),
            "study_date": getattr(ds, "StudyDate", "Unknown"),
            "modality": getattr(ds, "Modality", "Unknown"),
            "body_part": getattr(ds, "BodyPartExamined", "Unknown"),
            "manufacturer": getattr(ds, "Manufacturer", "Unknown"),
            "original_width": original_shape[1] if len(original_shape) > 1 else original_shape[0],
            "original_height": original_shape[0],
            "channels": 1,
        }
        
        # Invert if photometric interpretation is MONOCHROME1 (black is white)
        photometric = getattr(ds, "PhotometricInterpretation", "MONOCHROME2")
        if photometric == "MONOCHROME1":
            pixel_array = np.max(pixel_array) - pixel_array
            
        # Rescale slope and intercept if present
        rescale_slope = getattr(ds, "RescaleSlope", 1)
        rescale_intercept = getattr(ds, "RescaleIntercept", 0)
        pixel_array = pixel_array.astype(np.float32) * rescale_slope + rescale_intercept
        
        # Normalize to [0.0, 1.0]
        min_val = np.min(pixel_array)
        max_val = np.max(pixel_array)
        if max_val > min_val:
            normalized_img = (pixel_array - min_val) / (max_val - min_val)
        else:
            normalized_img = np.zeros_like(pixel_array, dtype=np.float32)
            
        # Resize to target shape
        resized_img = cv2.resize(normalized_img, self.target_size, interpolation=cv2.INTER_AREA)
        
        return resized_img, metadata

    def _preprocess_nifti(self, file_bytes: bytes) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Preprocesses NIfTI files. Since NIfTI contains 3D volumes, this extracts 
        the representative middle axial slice and normalizes it.
        """
        # Save NIfTI bytes to a temp file because nibabel needs a path or file-like pointer
        with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as temp_file:
            temp_file.write(file_bytes)
            temp_path = temp_file.name
            
        try:
            img = nib.load(temp_path)
            # Reorient to closest canonical (standard RAS coordinates)
            img_canonical = nib.as_closest_canonical(img)
            volume = img_canonical.get_fdata(dtype=np.float32)
            
            shape = volume.shape
            affine = img_canonical.affine
            zooms = img_canonical.header.get_zooms()
            
            # Slice extraction (Extract middle axial slice)
            # Axial is typically the 3rd dimension (Z-axis) in RAS
            mid_z = shape[2] // 2
            slice_data = volume[:, :, mid_z]
            
            # Rotate slice to align upright (often 90 degrees CCW depending on canonical orientation)
            slice_data = np.rot90(slice_data)
            
            # Normalize slice to [0.0, 1.0]
            min_val = np.min(slice_data)
            max_val = np.max(slice_data)
            if max_val > min_val:
                normalized_slice = (slice_data - min_val) / (max_val - min_val)
            else:
                normalized_slice = np.zeros_like(slice_data, dtype=np.float32)
                
            resized_slice = cv2.resize(normalized_slice, self.target_size, interpolation=cv2.INTER_AREA)
            
            metadata = {
                "format": "NIfTI",
                "volume_shape": list(shape),
                "voxel_spacing": [float(z) for z in zooms],
                "affine": affine.tolist(),
                "extracted_slice_index": mid_z,
                "original_width": shape[0],
                "original_height": shape[1],
                "patient_age": "Unknown",
                "patient_sex": "Unknown",
            }
            
            return resized_slice, metadata
            
        finally:
            # Clean up temp file safely
            if os.path.exists(temp_path):
                os.remove(temp_path)

from typing import Dict, Any

class ModalityDetector:
    """
    Detects clinical scan modality (chest_xray, brain_mri, or unknown) 
    using file metadata, signatures, and string heuristics.
    """

    def detect_modality(self, filename: str, metadata: Dict[str, Any]) -> str:
        """
        Detects modality based on filename extension and extracted metadata.
        
        Args:
            filename: The original upload file name.
            metadata: Metadata dictionary extracted from the file preprocessor.
            
        Returns:
            A string indicating modality: 'chest_xray', 'brain_mri', or 'unknown'.
        """
        # 1. NIfTI volumes are universally Brain MRIs in this system setup
        file_format = metadata.get("format", "").upper()
        if file_format == "NIFTI" or filename.lower().endswith((".nii", ".nii.gz")):
            return "brain_mri"
            
        # 2. DICOM tag analysis
        if file_format == "DICOM":
            dicom_modality = str(metadata.get("modality", "")).upper()
            body_part = str(metadata.get("body_part", "")).upper()
            
            if dicom_modality in ("MR", "MRI") or "BRAIN" in body_part or "HEAD" in body_part:
                return "brain_mri"
            elif dicom_modality in ("DX", "CR", "PX", "XA") or "CHEST" in body_part or "THORAX" in body_part:
                return "chest_xray"
                
        # 3. Filename keyword fallback (for standard PNG/JPEG datasets like RSNA or BraTS slices)
        fn_lower = filename.lower()
        
        # Brain MRI indicators
        mri_keywords = ["mri", "brain", "brats", "t1", "t2", "flair", "dwi", "adc", "sagittal", "coronal", "axial"]
        if any(keyword in fn_lower for keyword in mri_keywords):
            return "brain_mri"
            
        # Chest X-Ray indicators
        xray_keywords = ["chest", "xray", "x-ray", "cxr", "pneumonia", "nih", "lung", "rsna"]
        if any(keyword in fn_lower for keyword in xray_keywords):
            return "chest_xray"
            
        # 4. Unknown fallback
        return "unknown"

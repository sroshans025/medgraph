from backend.services.detector import ModalityDetector

def test_detect_modality_nifti() -> None:
    """Tests that NIfTI format is always brain_mri."""
    detector = ModalityDetector()
    metadata = {"format": "NIfTI", "volume_shape": [256, 256, 120]}
    
    assert detector.detect_modality("scan.nii", metadata) == "brain_mri"
    assert detector.detect_modality("scan.nii.gz", {}) == "brain_mri"

def test_detect_modality_dicom_mr() -> None:
    """Tests that DICOM with MR modality/body tags is brain_mri."""
    detector = ModalityDetector()
    metadata_mr = {"format": "DICOM", "modality": "MR", "body_part": "BRAIN"}
    metadata_head = {"format": "DICOM", "modality": "OT", "body_part": "HEAD"}
    
    assert detector.detect_modality("scan.dcm", metadata_mr) == "brain_mri"
    assert detector.detect_modality("scan.dcm", metadata_head) == "brain_mri"

def test_detect_modality_dicom_xray() -> None:
    """Tests that DICOM with DX/CR/CHEST tags is chest_xray."""
    detector = ModalityDetector()
    metadata_dx = {"format": "DICOM", "modality": "DX", "body_part": "CHEST"}
    metadata_cr = {"format": "DICOM", "modality": "CR", "body_part": "THORAX"}
    
    assert detector.detect_modality("scan.dcm", metadata_dx) == "chest_xray"
    assert detector.detect_modality("scan.dcm", metadata_cr) == "chest_xray"

def test_detect_modality_filename_heuristics() -> None:
    """Tests standard image classification from keywords in filenames."""
    detector = ModalityDetector()
    
    assert detector.detect_modality("patient_chest_xray_01.png", {"format": "PNG"}) == "chest_xray"
    assert detector.detect_modality("nih_lung_scan.jpg", {"format": "JPEG"}) == "chest_xray"
    
    assert detector.detect_modality("brats_brain_mri_333.png", {"format": "PNG"}) == "brain_mri"
    assert detector.detect_modality("axial_t2_sequence.jpg", {"format": "JPEG"}) == "brain_mri"

def test_detect_modality_unknown() -> None:
    """Tests fallback to unknown for unclassified items."""
    detector = ModalityDetector()
    
    assert detector.detect_modality("random_file.png", {"format": "PNG"}) == "unknown"

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class FindingSchema(BaseModel):
    """
    Represents an individual clinical finding extracted from the vision model.
    """
    name: str = Field(..., description="Name of the finding (e.g. Opacity, Lesion)")
    location: str = Field(..., description="Anatomical location of the finding")
    probability: float = Field(..., description="Confidence probability of the finding (0.0 to 1.0)")
    severity: str = Field(..., description="Graded severity of this finding (e.g., Mild, Moderate)")
    evidence: str = Field(..., description="Supporting clinical visual features or pattern")
    box: Optional[List[float]] = Field(None, description="Bounding box [x_min, y_min, x_max, y_max] or segment contour coordinates")

class EvidenceSchema(BaseModel):
    """
    Clinical evidence backing a specific finding.
    """
    finding_name: str = Field(..., description="Name of the associated finding")
    reason: str = Field(..., description="Reasoning or description of visual cues")
    measurement: Optional[str] = Field(None, description="Physical size or volume measurement (e.g., 2.1cm)")
    confidence: float = Field(..., description="Calculated calibration confidence score")
    supporting_region: Optional[List[float]] = Field(None, description="Bounding box or region coordinates")
    visualization_path: Optional[str] = Field(None, description="URL or filepath to overlay visualization")

class ConfidenceSchema(BaseModel):
    """
    Calibrated prediction confidence and reliability scores.
    """
    confidence_score: float = Field(..., description="Overall confidence level (0.0 to 1.0)")
    confidence_band: str = Field(..., description="Calibrated band (e.g. High Confidence, Low Confidence)")
    evidence_score: float = Field(..., description="Clinical evidence alignment score")
    model_stability: float = Field(..., description="Vision model output consistency score")
    prediction_reliability: float = Field(..., description="Standardized prediction reliability score")

class GraphNode(BaseModel):
    """
    Node in the clinical reasoning knowledge graph.
    """
    id: str = Field(..., description="Unique identifier for the node")
    label: str = Field(..., description="Display label for the node")
    type: str = Field(..., description="Node category (e.g. Disease, Finding, Location, severity, recommendation)")

class GraphEdge(BaseModel):
    """
    Directed edge in the clinical reasoning knowledge graph.
    """
    source: str = Field(..., description="ID of source node")
    target: str = Field(..., description="ID of target node")
    relation: str = Field(..., description="Type of relationship (e.g., LOCATED_IN, HAS_FINDING, LEADS_TO)")

class GraphSchema(BaseModel):
    """
    NetworkX-based clinical knowledge graph representation.
    """
    nodes: List[GraphNode] = Field(..., description="List of clinical graph nodes")
    edges: List[GraphEdge] = Field(..., description="List of clinical graph edges")

class ReportSchema(BaseModel):
    """
    Grounded, structured clinical report.
    """
    patient_summary: str = Field(..., description="High-level patient scan summary")
    imaging_findings: str = Field(..., description="Granular clinical findings detailed by region")
    evidence_summary: str = Field(..., description="Evidence and measurements backing findings")
    clinical_interpretation: str = Field(..., description="Clinical impression and reasoning paths")
    severity_level: str = Field(..., description="Calibrated case-level severity classification")
    recommendations: List[str] = Field(..., description="Actionable follow-up guidelines based on graph recommendations")
    limitations: str = Field(..., description="Explicit limitations of AI scan analysis")
    physician_review_required: bool = Field(True, description="Safety flag confirming doctor review is mandatory")

class ScanRequest(BaseModel):
    """
    Input schema for scan analysis requests.
    """
    patient_id: str = Field(..., description="Unique ID of the patient")
    modality_override: Optional[str] = Field(None, description="Explicitly override modality detection ('chest_xray' or 'brain_mri')")

class DiagnosticResult(BaseModel):
    """
    Unified API response for scan diagnostic analyses.
    """
    case_id: str = Field(..., description="Unique case identifier")
    modality: str = Field(..., description="Detected or overridden modality ('chest_xray', 'brain_mri', 'unknown')")
    metadata: Dict[str, Any] = Field(..., description="Extracted scanner/file metadata")
    findings: List[FindingSchema] = Field(..., description="List of extracted structured findings")
    evidence: List[EvidenceSchema] = Field(..., description="List of supporting evidence details")
    knowledge_graph: GraphSchema = Field(..., description="Clinical knowledge graph mapping findings to recommendations")
    severity: str = Field(..., description="System-level severity grading (Minimal, Mild, Moderate, Severe, Critical)")
    confidence: ConfidenceSchema = Field(..., description="Calibrated confidence statistics")
    overlay_url: str = Field(..., description="Link to the annotated scan visualization")
    report: ReportSchema = Field(..., description="AI-generated clinician draft report")

class ReportEditRequest(BaseModel):
    """
    Request schema to update a report draft.
    """
    edited_report: ReportSchema = Field(..., description="Modified version of the clinical report")
    doctor_notes: Optional[str] = Field(None, description="Optional clinical commentary or audit notes")

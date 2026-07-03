from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy import Column, String, Float, Boolean, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.services.models.storage.database.connection import Base

class CaseModel(Base):
    """
    Case table storing top-level medical scan details and metadata.
    """
    __tablename__ = "cases"

    id = Column(String(36), primary_key=True, index=True)
    patient_id = Column(String(50), nullable=False, index=True)
    modality = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    metadata_json = Column(JSON, name="metadata", nullable=False)
    overlay_url = Column(String(255), nullable=True)
    severity = Column(String(20), nullable=False)
    confidence_score = Column(Float, nullable=False)

    # Relationships
    findings = relationship("FindingModel", back_populates="case", cascade="all, delete-orphan")
    evidence = relationship("EvidenceModel", back_populates="case", cascade="all, delete-orphan")
    knowledge_graph = relationship("KnowledgeGraphModel", back_populates="case", uselist=False, cascade="all, delete-orphan")
    reports = relationship("ReportModel", back_populates="case", cascade="all, delete-orphan")
    edits = relationship("EditModel", back_populates="case", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLogModel", back_populates="case", cascade="all, delete-orphan")

class ModelRegistryModel(Base):
    """
    Registry for machine learning model metadata.
    """
    __tablename__ = "models"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    version = Column(String(20), nullable=False)
    task = Column(String(50), nullable=False)
    input_resolution = Column(JSON, nullable=False)  # e.g., [512, 512]

class ReportModel(Base):
    """
    Report drafts and doctor-approved versions.
    """
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, index=True)
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_summary = Column(String(500), nullable=False)
    imaging_findings = Column(String(1000), nullable=False)
    evidence_summary = Column(String(1000), nullable=False)
    clinical_interpretation = Column(String(1000), nullable=False)
    severity_level = Column(String(20), nullable=False)
    recommendations = Column(JSON, nullable=False)  # List of follow-up tasks
    limitations = Column(String(500), nullable=False)
    physician_review_required = Column(Boolean, default=True, nullable=False)
    is_draft = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    case = relationship("CaseModel", back_populates="reports")
    edits = relationship("EditModel", back_populates="report", cascade="all, delete-orphan")

class EditModel(Base):
    """
    Audit log of doctor-made edits to reports.
    """
    __tablename__ = "edits"

    id = Column(String(36), primary_key=True, index=True)
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    report_id = Column(String(36), ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, index=True)
    editor_id = Column(String(50), nullable=False)  # Doctor's identifier
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    original_content = Column(JSON, nullable=False)  # Serialized ReportSchema
    edited_content = Column(JSON, nullable=False)    # Serialized ReportSchema
    doctor_notes = Column(String(500), nullable=True)

    case = relationship("CaseModel", back_populates="edits")
    report = relationship("ReportModel", back_populates="edits")

class FindingModel(Base):
    """
    Vision model structured clinical finding predictions.
    """
    __tablename__ = "findings"

    id = Column(String(36), primary_key=True, index=True)
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(100), nullable=False)
    probability = Column(Float, nullable=False)
    severity = Column(String(20), nullable=False)
    evidence = Column(String(200), nullable=False)
    box = Column(JSON, nullable=True)  # Bounding box or contour

    case = relationship("CaseModel", back_populates="findings")

class EvidenceModel(Base):
    """
    Clinical visual evidence and measurements backing a finding.
    """
    __tablename__ = "evidence"

    id = Column(String(36), primary_key=True, index=True)
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    finding_name = Column(String(100), nullable=False)
    reason = Column(String(500), nullable=False)
    measurement = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=False)
    supporting_region = Column(JSON, nullable=True)
    visualization_path = Column(String(255), nullable=True)

    case = relationship("CaseModel", back_populates="evidence")

class KnowledgeGraphModel(Base):
    """
    Serialized clinical graph (NetworkX schema export) linking cases to diagnoses/recs.
    """
    __tablename__ = "knowledge_graphs"

    id = Column(String(36), primary_key=True, index=True)
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, unique=True)
    nodes = Column(JSON, nullable=False)
    edges = Column(JSON, nullable=False)

    case = relationship("CaseModel", back_populates="knowledge_graph")

class AuditLogModel(Base):
    """
    Detailed audit log tracking ML execution characteristics.
    """
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, index=True)
    case_id = Column(String(36), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    model_version = Column(String(50), nullable=False)
    runtime_ms = Column(Integer, nullable=False)
    input_metadata = Column(JSON, nullable=False)
    output = Column(JSON, nullable=False)
    confidence = Column(JSON, nullable=False)
    severity = Column(String(20), nullable=False)

    case = relationship("CaseModel", back_populates="audit_logs")

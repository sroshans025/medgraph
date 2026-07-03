import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from backend.api.schemas.schemas import (
    DiagnosticResult,
    FindingSchema,
    EvidenceSchema,
    ConfidenceSchema,
    GraphSchema,
    GraphNode,
    GraphEdge,
    ReportSchema,
)
from backend.services.models.storage.database.models import (
    CaseModel,
    FindingModel,
    EvidenceModel,
    KnowledgeGraphModel,
    ReportModel,
)

class CaseManager:
    """
    Manages database CRUD operations for Case diagnostics, joining findings,
    evidence, knowledge graphs, and report history.
    """

    def __init__(self, db: AsyncSession) -> None:
        """
        Initializes the repository with a database session.
        """
        self.db = db

    async def create_case(self, result: DiagnosticResult) -> CaseModel:
        """
        Inserts a new Case along with findings, evidence, knowledge graph, and reports.
        """
        # 1. Create Top Level Case
        db_case = CaseModel(
            id=result.case_id,
            patient_id=result.metadata.get("patient_id", "Unknown"),
            modality=result.modality,
            metadata_json=result.metadata,
            overlay_url=result.overlay_url,
            severity=result.severity,
            confidence_score=result.confidence.confidence_score,
        )
        self.db.add(db_case)

        # 2. Insert Findings
        for f in result.findings:
            db_finding = FindingModel(
                id=str(uuid.uuid4()),
                case_id=result.case_id,
                name=f.name,
                location=f.location,
                probability=f.probability,
                severity=f.severity,
                evidence=f.evidence,
                box=f.box
            )
            self.db.add(db_finding)

        # 3. Insert Evidence
        for e in result.evidence:
            db_evidence = EvidenceModel(
                id=str(uuid.uuid4()),
                case_id=result.case_id,
                finding_name=e.finding_name,
                reason=e.reason,
                measurement=e.measurement,
                confidence=e.confidence,
                supporting_region=e.supporting_region,
                visualization_path=e.visualization_path
            )
            self.db.add(db_evidence)

        # 4. Insert Knowledge Graph
        db_kg = KnowledgeGraphModel(
            id=str(uuid.uuid4()),
            case_id=result.case_id,
            nodes=[node.model_dump() for node in result.knowledge_graph.nodes],
            edges=[edge.model_dump() for edge in result.knowledge_graph.edges]
        )
        self.db.add(db_kg)

        # 5. Insert Draft Report
        db_report = ReportModel(
            id=str(uuid.uuid4()),
            case_id=result.case_id,
            patient_summary=result.report.patient_summary,
            imaging_findings=result.report.imaging_findings,
            evidence_summary=result.report.evidence_summary,
            clinical_interpretation=result.report.clinical_interpretation,
            severity_level=result.report.severity_level,
            recommendations=result.report.recommendations,
            limitations=result.report.limitations,
            physician_review_required=result.report.physician_review_required,
            is_draft=True
        )
        self.db.add(db_report)

        await self.db.flush()
        return db_case

    async def get_case(self, case_id: str) -> Optional[DiagnosticResult]:
        """
        Retrieves a Case from database by UUID, converting it to DiagnosticResult.
        """
        stmt = (
            select(CaseModel)
            .where(CaseModel.id == case_id)
            .options(
                selectinload(CaseModel.findings),
                selectinload(CaseModel.evidence),
                selectinload(CaseModel.knowledge_graph),
                selectinload(CaseModel.reports),
            )
        )
        query_result = await self.db.execute(stmt)
        case = query_result.scalar_one_or_none()
        
        if not case:
            return None

        # Resolve current active report (latest created)
        latest_report = sorted(case.reports, key=lambda r: r.created_at)[-1]
        
        return self._to_schema(case, latest_report)

    async def list_cases(self) -> List[DiagnosticResult]:
        """
        Lists all cases in the database.
        """
        stmt = (
            select(CaseModel)
            .options(
                selectinload(CaseModel.findings),
                selectinload(CaseModel.evidence),
                selectinload(CaseModel.knowledge_graph),
                selectinload(CaseModel.reports),
            )
            .order_by(CaseModel.created_at.desc())
        )
        query_result = await self.db.execute(stmt)
        cases = query_result.scalars().all()
        
        results = []
        for case in cases:
            if not case.reports:
                continue
            latest_report = sorted(case.reports, key=lambda r: r.created_at)[-1]
            results.append(self._to_schema(case, latest_report))
            
        return results

    def _to_schema(self, case: CaseModel, report: ReportModel) -> DiagnosticResult:
        """
        Maps SQLAlchemy models to DiagnosticResult schema.
        """
        findings = [
            FindingSchema(
                name=f.name,
                location=f.location,
                probability=f.probability,
                severity=f.severity,
                evidence=f.evidence,
                box=f.box
            ) for f in case.findings
        ]

        evidence = [
            EvidenceSchema(
                finding_name=e.finding_name,
                reason=e.reason,
                measurement=e.measurement,
                confidence=e.confidence,
                supporting_region=e.supporting_region,
                visualization_path=e.visualization_path
            ) for e in case.evidence
        ]

        # Re-construct Knowledge Graph
        nodes = [GraphNode(**n) for n in case.knowledge_graph.nodes]
        edges = [GraphEdge(**e) for e in case.knowledge_graph.edges]
        kg = GraphSchema(nodes=nodes, edges=edges)

        # Calibrated confidence mock representation mapping back
        # For MVP, we reconstruct confidence based on top-level metrics
        confidence = ConfidenceSchema(
            confidence_score=case.confidence_score,
            confidence_band="High Confidence" if case.confidence_score >= 0.85 else "Moderate Confidence",
            evidence_score=case.confidence_score - 0.02,
            model_stability=case.confidence_score + 0.03 if case.confidence_score < 0.97 else 0.99,
            prediction_reliability=case.confidence_score
        )

        report_schema = ReportSchema(
            patient_summary=report.patient_summary,
            imaging_findings=report.imaging_findings,
            evidence_summary=report.evidence_summary,
            clinical_interpretation=report.clinical_interpretation,
            severity_level=report.severity_level,
            recommendations=report.recommendations,
            limitations=report.limitations,
            physician_review_required=report.physician_review_required
        )

        return DiagnosticResult(
            case_id=case.id,
            modality=case.modality,
            metadata=case.metadata_json,
            findings=findings,
            evidence=evidence,
            knowledge_graph=kg,
            severity=case.severity,
            confidence=confidence,
            overlay_url=case.overlay_url,
            report=report_schema
        )

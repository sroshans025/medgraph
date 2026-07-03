import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.api.schemas.schemas import ReportSchema
from backend.services.models.storage.database.models import (
    AuditLogModel,
    EditModel,
    ReportModel,
    CaseModel,
)

class AuditManager:
    """
    Manages audit logging, report edits, versioning, and physician feedback loops.
    """

    def __init__(self, db: AsyncSession) -> None:
        """
        Initializes the repository with a database session.
        """
        self.db = db

    async def log_inference_audit(
        self,
        case_id: str,
        model_version: str,
        runtime_ms: int,
        input_metadata: dict,
        output_data: dict,
        confidence_data: dict,
        severity: str
    ) -> AuditLogModel:
        """
        Logs a machine learning diagnostic execution trace.
        """
        audit_log = AuditLogModel(
            id=str(uuid.uuid4()),
            case_id=case_id,
            model_version=model_version,
            runtime_ms=runtime_ms,
            input_metadata=input_metadata,
            output=output_data,
            confidence=confidence_data,
            severity=severity
        )
        self.db.add(audit_log)
        await self.db.flush()
        return audit_log

    async def log_report_edit(
        self,
        case_id: str,
        editor_id: str,
        original_report_schema: ReportSchema,
        edited_report_schema: ReportSchema,
        doctor_notes: Optional[str] = None
    ) -> ReportModel:
        """
        Saves modifications made by a clinician to a report draft.
        Inserts an audit edit record and a new active report version.
        """
        # 1. Verify case exists
        case_stmt = select(CaseModel).where(CaseModel.id == case_id)
        case_result = await self.db.execute(case_stmt)
        case = case_result.scalar_one_or_none()
        if not case:
            raise ValueError(f"Case with ID {case_id} not found")

        # 2. Add New Report Version (Doctor approved)
        new_report = ReportModel(
            id=str(uuid.uuid4()),
            case_id=case_id,
            patient_summary=edited_report_schema.patient_summary,
            imaging_findings=edited_report_schema.imaging_findings,
            evidence_summary=edited_report_schema.evidence_summary,
            clinical_interpretation=edited_report_schema.clinical_interpretation,
            severity_level=edited_report_schema.severity_level,
            recommendations=edited_report_schema.recommendations,
            limitations=edited_report_schema.limitations,
            physician_review_required=edited_report_schema.physician_review_required,
            is_draft=False  # Doctor version
        )
        self.db.add(new_report)

        # 3. Add Audit Edit Record
        audit_edit = EditModel(
            id=str(uuid.uuid4()),
            case_id=case_id,
            report_id=new_report.id,
            editor_id=editor_id,
            original_content=original_report_schema.model_dump(),
            edited_content=edited_report_schema.model_dump(),
            doctor_notes=doctor_notes
        )
        self.db.add(audit_edit)

        # 4. Update case-level severity if clinician modified it
        if case.severity != edited_report_schema.severity_level:
            case.severity = edited_report_schema.severity_level

        await self.db.flush()
        return new_report

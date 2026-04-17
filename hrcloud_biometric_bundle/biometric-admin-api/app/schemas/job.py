from pydantic import BaseModel, Field

from app.models.enums import JobStatus, SyncJobType, TransferMode


class TransferRequest(BaseModel):
    tenant_id: str
    source_device_id: str
    target_device_id: str
    employee_ids: list[str] = Field(default_factory=list)
    mode: TransferMode
    created_by: str


class PullUsersRequest(BaseModel):
    tenant_id: str
    device_id: str
    created_by: str


class ReconciliationRequest(BaseModel):
    tenant_id: str
    device_id: str
    created_by: str


class SyncJobResponse(BaseModel):
    id: str
    tenant_id: str
    job_type: SyncJobType
    status: JobStatus
    summary: dict

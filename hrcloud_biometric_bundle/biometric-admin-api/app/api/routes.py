from fastapi import APIRouter, HTTPException, Query

from app.schemas.job import PullUsersRequest, ReconciliationRequest, TransferRequest
from app.services.device_service import device_service
from app.services.job_service import job_service
from app.services.reconciliation_service import reconciliation_service

router = APIRouter()


@router.get("/docs-notes")
def docs_notes() -> dict:
    return {
        "message": "Usar /openapi.json o /docs al ejecutar localmente."
    }


@router.get("/biometric/devices")
async def list_devices(
    tenant_id: str = Query(...),
    include_inactive: bool = Query(False),
):
    return await device_service.list_devices(
        tenant_id=tenant_id,
        include_inactive=include_inactive,
    )


@router.get("/biometric/devices/{device_id}/health")
async def device_health(device_id: str):
    try:
        return await device_service.health_check(device_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/biometric/devices/{device_id}/users")
async def device_users(device_id: str):
    try:
        return await device_service.list_device_users(device_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/biometric/jobs/pull-users")
async def create_pull_users_job(payload: PullUsersRequest):
    try:
        return await job_service.create_pull_users_job(payload.tenant_id, payload.device_id, payload.created_by)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/biometric/jobs/transfer")
async def create_transfer_job(payload: TransferRequest):
    try:
        return await job_service.create_transfer_job(
            tenant_id=payload.tenant_id,
            source_device_id=payload.source_device_id,
            target_device_id=payload.target_device_id,
            employee_ids=payload.employee_ids,
            mode=payload.mode,
            created_by=payload.created_by,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/biometric/jobs/reconciliation")
async def create_reconciliation_job(payload: ReconciliationRequest):
    try:
        return await reconciliation_service.run(payload.tenant_id, payload.device_id, payload.created_by)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/biometric/jobs/{job_id}")
async def get_job(job_id: str):
    job = await job_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return job


@router.get("/biometric/jobs/{job_id}/items")
async def get_job_items(job_id: str):
    return await job_service.get_job_items(job_id)
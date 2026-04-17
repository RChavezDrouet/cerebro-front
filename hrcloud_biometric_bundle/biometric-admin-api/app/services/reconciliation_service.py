from __future__ import annotations

from datetime import datetime, timezone

from app.repositories.audit_repository import audit_repository
from app.repositories.device_repository import device_repository
from app.repositories.job_repository import job_repository
from app.models.enums import JobStatus, SyncJobType
from app.providers.zkteco_provider import ZKTecoProvider


class ReconciliationService:
    def __init__(self) -> None:
        self.provider = ZKTecoProvider()

    async def run(self, tenant_id: str, device_id: str, created_by: str) -> dict:
        device = await device_repository.get_by_id(device_id)
        if not device:
            raise ValueError("device_id inválido")

        job = await job_repository.create_job({
            "tenant_id": tenant_id,
            "job_type": SyncJobType.reconciliation.value,
            "status": JobStatus.running.value,
            "source_device_id": device_id,
            "created_by": created_by,
            "summary": {"step": "reconciliation_started"},
        })

        users = await self.provider.list_users(device)
        items = []
        for user in users:
            items.append({
                "job_id": job["id"],
                "employee_id": None,
                "biometric_user_code": user["biometric_user_code"],
                "requested_action": "reconcile",
                "result_status": "review",
                "result_message": "Pendiente de comparar contra employees y biometric_device_users",
                "payload_response": user,
            })
        if items:
            await job_repository.create_job_items(items)

        await job_repository.update_job(job["id"], {
            "status": JobStatus.completed.value,
            "summary": {"users_checked": len(users), "note": "Implementar reglas de conciliación específicas"},
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

        await audit_repository.write({
            "tenant_id": tenant_id,
            "action": "reconciliation_run",
            "device_id": device_id,
            "severity": "info",
            "details": {"job_id": job["id"], "users_checked": len(users)},
            "created_by": created_by,
        })

        return await job_repository.get_job(job["id"])


reconciliation_service = ReconciliationService()

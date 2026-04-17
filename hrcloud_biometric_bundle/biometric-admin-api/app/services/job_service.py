from __future__ import annotations

from datetime import datetime, timezone

from app.core.logging import get_logger
from app.models.enums import JobStatus, SyncJobType, TransferMode
from app.providers.zkteco_provider import ZKTecoProvider
from app.repositories.audit_repository import audit_repository
from app.repositories.device_repository import device_repository
from app.repositories.job_repository import job_repository

logger = get_logger("JobService")


class JobService:
    def __init__(self) -> None:
        self.provider = ZKTecoProvider()

    async def create_pull_users_job(self, tenant_id: str, device_id: str, created_by: str) -> dict:
        device = await device_repository.get_by_id(device_id)
        if not device:
            raise ValueError("device_id inválido")

        job = await job_repository.create_job({
            "tenant_id": tenant_id,
            "job_type": SyncJobType.pull_users.value,
            "status": JobStatus.running.value,
            "source_device_id": device_id,
            "created_by": created_by,
            "summary": {"step": "listing_users"},
        })

        try:
            users = await self.provider.list_users(device)
            items = [
                {
                    "job_id": job["id"],
                    "employee_id": None,
                    "biometric_user_code": item["biometric_user_code"],
                    "requested_action": "pull_user",
                    "result_status": "success",
                    "result_message": "Usuario leído desde el dispositivo",
                    "payload_response": item,
                }
                for item in users
            ]
            if items:
                await job_repository.create_job_items(items)
            await job_repository.update_job(job["id"], {
                "status": JobStatus.completed.value,
                "summary": {"users_found": len(users)},
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })
            return await job_repository.get_job(job["id"])
        except Exception as exc:
            await job_repository.update_job(job["id"], {
                "status": JobStatus.failed.value,
                "summary": {"error": str(exc)},
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })
            raise

    async def create_transfer_job(
        self,
        tenant_id: str,
        source_device_id: str,
        target_device_id: str,
        employee_ids: list[str],
        mode: TransferMode,
        created_by: str,
    ) -> dict:
        source = await device_repository.get_by_id(source_device_id)
        target = await device_repository.get_by_id(target_device_id)
        if not source or not target:
            raise ValueError("source_device_id o target_device_id inválido")

        job = await job_repository.create_job({
            "tenant_id": tenant_id,
            "job_type": SyncJobType.transfer_users.value,
            "status": JobStatus.running.value,
            "source_device_id": source_device_id,
            "target_device_id": target_device_id,
            "created_by": created_by,
            "summary": {"mode": mode.value, "requested_users": len(employee_ids)},
        })

        items: list[dict] = []
        success = 0
        partial = 0
        failed = 0

        for employee_id in employee_ids:
            biometric_code = f"EMP-{employee_id[:8]}"
            target_result = await self.provider.create_or_update_user(target, {
                "employee_id": employee_id,
                "biometric_user_code": biometric_code,
            })
            source_deleted = False
            result_status = "success"
            result_message = "Replicado correctamente"

            if mode == TransferMode.exclusive:
                delete_result = await self.provider.delete_user(source, biometric_code)
                source_deleted = bool(delete_result.get("ok"))
                if not source_deleted:
                    result_status = "partial"
                    result_message = "Copiado al destino, pero no se pudo borrar del origen"
                    partial += 1
                else:
                    result_message = "Traslado excluyente completado"
            success += 1

            items.append({
                "job_id": job["id"],
                "employee_id": employee_id,
                "biometric_user_code": biometric_code,
                "requested_action": f"transfer_{mode.value}",
                "result_status": result_status,
                "result_message": result_message,
                "source_deleted": source_deleted,
                "payload_request": {"employee_id": employee_id, "mode": mode.value},
                "payload_response": {"target_result": target_result},
            })

        if items:
            await job_repository.create_job_items(items)

        final_status = JobStatus.completed.value if failed == 0 and partial == 0 else JobStatus.partial.value
        await job_repository.update_job(job["id"], {
            "status": final_status,
            "summary": {
                "mode": mode.value,
                "requested_users": len(employee_ids),
                "success": success,
                "partial": partial,
                "failed": failed,
            },
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })

        await audit_repository.write({
            "tenant_id": tenant_id,
            "action": f"transfer_{mode.value}",
            "device_id": target_device_id,
            "severity": "info",
            "details": {
                "source_device_id": source_device_id,
                "target_device_id": target_device_id,
                "job_id": job["id"],
                "employee_ids": employee_ids,
            },
            "created_by": created_by,
        })

        return await job_repository.get_job(job["id"])

    async def get_job(self, job_id: str) -> dict | None:
        return await job_repository.get_job(job_id)

    async def get_job_items(self, job_id: str) -> list[dict]:
        return await job_repository.list_job_items(job_id)


job_service = JobService()

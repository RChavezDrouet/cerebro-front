from __future__ import annotations

from app.db.supabase_client import supabase_rest_client


class JobRepository:
    async def create_job(self, payload: dict) -> dict:
        rows = await supabase_rest_client.post("biometric_sync_jobs", payload)
        return rows[0]

    async def create_job_items(self, payload: list[dict]) -> list[dict]:
        return await supabase_rest_client.post("biometric_sync_job_items", payload)

    async def get_job(self, job_id: str) -> dict | None:
        params = {"select": "*", "id": f"eq.{job_id}", "limit": "1"}
        rows = await supabase_rest_client.get("biometric_sync_jobs", params=params)
        return rows[0] if rows else None

    async def list_job_items(self, job_id: str) -> list[dict]:
        params = {"select": "*", "job_id": f"eq.{job_id}", "order": "created_at.asc"}
        return await supabase_rest_client.get("biometric_sync_job_items", params=params)

    async def update_job(self, job_id: str, payload: dict) -> None:
        await supabase_rest_client.patch("biometric_sync_jobs", payload, params={"id": f"eq.{job_id}"})


job_repository = JobRepository()

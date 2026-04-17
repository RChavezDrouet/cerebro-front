from __future__ import annotations

from app.db.supabase_client import supabase_rest_client


class AuditRepository:
    async def write(self, payload: dict) -> dict:
        rows = await supabase_rest_client.post("biometric_audit_log", payload)
        return rows[0]


audit_repository = AuditRepository()

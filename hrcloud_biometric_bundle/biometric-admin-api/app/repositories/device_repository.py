from __future__ import annotations

from app.db.supabase_client import supabase_rest_client


class DeviceRepository:
    async def list_by_tenant(self, tenant_id: str, include_inactive: bool = False) -> list[dict]:
        params = {
            "select": "id,tenant_id,alias,serial_no,vendor,model,firmware_version,connection_mode,is_active,last_seen_at,name",
            "tenant_id": f"eq.{tenant_id}",
            "order": "alias.asc",
        }

        if not include_inactive:
            params["is_active"] = "eq.true"

        return await supabase_rest_client.get("biometric_devices", params=params)

    async def get_by_id(self, device_id: str) -> dict | None:
        params = {
            "select": "id,tenant_id,alias,serial_no,vendor,model,firmware_version,connection_mode,is_active,last_seen_at,name",
            "id": f"eq.{device_id}",
            "limit": "1",
        }
        rows = await supabase_rest_client.get("biometric_devices", params=params)
        return rows[0] if rows else None


device_repository = DeviceRepository()
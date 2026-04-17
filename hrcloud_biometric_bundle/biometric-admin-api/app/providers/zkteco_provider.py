from __future__ import annotations

from app.core.config import settings
from app.core.logging import get_logger
from app.providers.base import BiometricProvider

logger = get_logger("ZKTecoProvider")


class ZKTecoProvider(BiometricProvider):
    async def health_check(self, device: dict) -> dict:
        notes: list[str] = []
        if device.get("connection_mode") == "adms_push":
            notes.append("Modo ADMS detectado. Validar last_seen_at y heartbeat del gateway.")
        else:
            notes.append("Modo no ADMS. Validar API/SDK real del equipo.")
        return {
            "ok": True,
            "device_id": device["id"],
            "alias": device.get("alias") or device.get("name") or "SIN_ALIAS",
            "vendor": device.get("vendor"),
            "model": device.get("model"),
            "connection_mode": device.get("connection_mode"),
            "notes": notes,
        }

    async def list_users(self, device: dict) -> list[dict]:
        if settings.enable_mock_provider:
            return [
                {
                    "biometric_user_code": "1001",
                    "display_name": "COLABORADOR DEMO",
                    "has_face": True,
                    "has_fingerprint": True,
                    "has_pin": False,
                    "source_status": "active",
                }
            ]
        logger.warning("Proveedor real ZKTeco aún no implementado para list_users.")
        return []

    async def create_or_update_user(self, device: dict, employee_payload: dict) -> dict:
        if settings.enable_mock_provider:
            return {
                "ok": True,
                "action": "create_or_update_user",
                "device_id": device["id"],
                "biometric_user_code": employee_payload.get("biometric_user_code"),
            }
        raise NotImplementedError("Implementar aquí SDK/API real de ZKTeco para alta/actualización")

    async def delete_user(self, device: dict, biometric_user_code: str) -> dict:
        if settings.enable_mock_provider:
            return {
                "ok": True,
                "action": "delete_user",
                "device_id": device["id"],
                "biometric_user_code": biometric_user_code,
            }
        raise NotImplementedError("Implementar aquí SDK/API real de ZKTeco para borrado")

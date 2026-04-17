from __future__ import annotations

from app.providers.zkteco_provider import ZKTecoProvider
from app.repositories.device_repository import device_repository


class DeviceService:
    def __init__(self) -> None:
        self.provider = ZKTecoProvider()

    async def list_devices(self, tenant_id: str, include_inactive: bool = False) -> list[dict]:
        return await device_repository.list_by_tenant(
            tenant_id=tenant_id,
            include_inactive=include_inactive,
        )

    async def get_device_or_raise(self, device_id: str) -> dict:
        device = await device_repository.get_by_id(device_id)
        if not device:
            raise ValueError(f"No existe biometric_devices.id={device_id}")
        return device

    async def health_check(self, device_id: str) -> dict:
        device = await self.get_device_or_raise(device_id)
        return await self.provider.health_check(device)

    async def list_device_users(self, device_id: str) -> list[dict]:
        device = await self.get_device_or_raise(device_id)
        return await self.provider.list_users(device)


device_service = DeviceService()
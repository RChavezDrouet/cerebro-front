from __future__ import annotations

from abc import ABC, abstractmethod


class BiometricProvider(ABC):
    @abstractmethod
    async def health_check(self, device: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    async def list_users(self, device: dict) -> list[dict]:
        raise NotImplementedError

    @abstractmethod
    async def create_or_update_user(self, device: dict, employee_payload: dict) -> dict:
        raise NotImplementedError

    @abstractmethod
    async def delete_user(self, device: dict, biometric_user_code: str) -> dict:
        raise NotImplementedError

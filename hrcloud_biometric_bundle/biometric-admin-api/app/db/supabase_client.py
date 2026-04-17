from __future__ import annotations

import httpx

from app.core.config import settings


class SupabaseRestClient:
    def __init__(self) -> None:
        self.base_url = settings.supabase_url.rstrip("/")
        self.schema = settings.supabase_schema
        self.timeout = settings.sb_timeout
        self.service_role_key = settings.supabase_service_role_key

    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Content-Profile": self.schema,
            "Accept-Profile": self.schema,
            "Prefer": "return=representation",
        }

    async def get(self, path: str, params: dict | None = None) -> list[dict]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(f"{self.base_url}/rest/v1/{path}", headers=self.headers(), params=params)
            response.raise_for_status()
            return response.json()

    async def post(self, path: str, payload: dict | list[dict]) -> list[dict]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}/rest/v1/{path}", headers=self.headers(), json=payload)
            response.raise_for_status()
            return response.json()

    async def patch(self, path: str, payload: dict, params: dict | None = None) -> list[dict]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.patch(f"{self.base_url}/rest/v1/{path}", headers=self.headers(), json=payload, params=params)
            response.raise_for_status()
            if response.text.strip():
                return response.json()
            return []


supabase_rest_client = SupabaseRestClient()

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

    def _url(self, path: str) -> str:
        return f"{self.base_url}/rest/v1/{path}"

    def _raise_with_detail(self, method: str, path: str, response: httpx.Response) -> None:
        body = response.text
        raise Exception(
            f"Supabase {method} error | "
            f"status={response.status_code} | "
            f"path={path} | "
            f"schema={self.schema} | "
            f"body={body}"
        )

    async def get(self, path: str, params: dict | None = None) -> list[dict]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                self._url(path),
                headers=self.headers(),
                params=params,
            )
            if response.status_code >= 400:
                self._raise_with_detail("GET", path, response)
            return response.json()

    async def post(self, path: str, payload: dict | list[dict]) -> list[dict]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                self._url(path),
                headers=self.headers(),
                json=payload,
            )
            if response.status_code >= 400:
                self._raise_with_detail("POST", path, response)
            if response.text.strip():
                return response.json()
            return []

    async def patch(self, path: str, payload: dict, params: dict | None = None) -> list[dict]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.patch(
                self._url(path),
                headers=self.headers(),
                json=payload,
                params=params,
            )
            if response.status_code >= 400:
                self._raise_with_detail("PATCH", path, response)
            if response.text.strip():
                return response.json()
            return []


supabase_rest_client = SupabaseRestClient()

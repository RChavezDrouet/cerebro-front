from pydantic import BaseModel

from app.models.enums import DeviceConnectionMode


class DeviceSummary(BaseModel):
    id: str
    tenant_id: str
    alias: str
    serial_no: str | None = None
    vendor: str | None = None
    model: str | None = None
    firmware_version: str | None = None
    connection_mode: DeviceConnectionMode | None = None
    is_active: bool = True
    last_seen_at: str | None = None


class DeviceHealthResponse(BaseModel):
    ok: bool
    device_id: str
    alias: str
    vendor: str | None = None
    model: str | None = None
    connection_mode: str | None = None
    notes: list[str]

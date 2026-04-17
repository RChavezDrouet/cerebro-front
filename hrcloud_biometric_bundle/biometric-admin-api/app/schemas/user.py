from pydantic import BaseModel


class DeviceUserResponse(BaseModel):
    biometric_user_code: str
    display_name: str | None = None
    has_face: bool = False
    has_fingerprint: bool = False
    has_pin: bool = False
    source_status: str = "active"

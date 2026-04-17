from enum import Enum


class DeviceConnectionMode(str, Enum):
    adms_push = "adms_push"
    api_rest = "api_rest"
    sdk_pull = "sdk_pull"
    usb_manual = "usb_manual"


class SyncJobType(str, Enum):
    import_users = "import_users"
    export_users = "export_users"
    transfer_users = "transfer_users"
    reconciliation = "reconciliation"
    pull_users = "pull_users"


class TransferMode(str, Enum):
    replica = "replica"
    exclusive = "exclusive"


class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    partial = "partial"

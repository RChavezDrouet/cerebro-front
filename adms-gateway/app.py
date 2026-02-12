import os
import json
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import requests
from flask import Flask, request, Response, jsonify
from flask_cors import CORS

"""
HRCloud - ADMS Gateway (Python Only)
- Recibe iClock (ZKTeco) en /iclock/cdata y /iclock/getrequest
- Guarda RAW + Punches directamente en Supabase (schema attendance)
- Compatible con DigitalOcean App Platform:
  - NO ssl_context='adhoc' (TLS lo termina DO)
  - Usa PORT dinámico: os.environ["PORT"]
"""

# -----------------------
# Flask
# -----------------------
app = Flask(__name__)
CORS(app)

# -----------------------
# Config ENV (obligatorio en DO)
# -----------------------
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

DEVICE_TZ_DEFAULT = os.environ.get("DEVICE_TIMEZONE", "America/Guayaquil")
REJECT_UNKNOWN_SN = os.environ.get("REJECT_UNKNOWN_SN", "1").strip() in ("1", "true", "TRUE", "yes", "YES", "on", "ON")
DEFAULT_TENANT_ID = os.environ.get("DEFAULT_TENANT_ID", "").strip() or None

# Timeouts
SB_TIMEOUT = float(os.environ.get("SB_TIMEOUT", "7"))
MAX_BODY_KB = int(os.environ.get("MAX_BODY_KB", "256"))

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("ADMS-Gateway-PY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.warning("⚠️ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados. En DO son obligatorios.")

SB_REST = f"{SUPABASE_URL}/rest/v1"

def sb_headers(profile: str = "attendance"):
    # PostgREST schema routing: Content-Profile / Accept-Profile
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Profile": profile,
        "Accept-Profile": profile,
        "Prefer": "return=representation"
    }

def client_ip():
    # Si DO está delante, X-Forwarded-For suele venir
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.remote_addr

def safe_json_dumps(obj) -> str:
    try:
        return json.dumps(obj if obj is not None else {})
    except Exception:
        return "{}"

def parse_local_datetime_to_utc_iso(dt_str: str, tz_name: str) -> str | None:
    if not dt_str:
        return None
    s = str(dt_str).strip().replace("T", " ")
    try:
        # Formato típico iClock: "YYYY-MM-DD HH:MM:SS"
        local_naive = datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
        tz = ZoneInfo(tz_name)
        local_aware = local_naive.replace(tzinfo=tz)
        utc_dt = local_aware.astimezone(timezone.utc)
        # ISO compatible con timestamptz
        return utc_dt.isoformat()
    except Exception:
        # fallback: intenta parse ISO estándar
        try:
            d = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            if d.tzinfo is None:
                # asume timezone local del dispositivo
                tz = ZoneInfo(tz_name)
                d = d.replace(tzinfo=tz)
            return d.astimezone(timezone.utc).isoformat()
        except Exception:
            return None

# -----------------------
# Supabase operations
# -----------------------
def sb_get_device_by_sn(sn: str):
    if not sn:
        return None, None
    url = f"{SB_REST}/biometric_devices"
    params = {
        "select": "id,tenant_id,serial_no,device_timezone,is_active",
        "serial_no": f"eq.{sn}",
        "limit": "1"
    }
    r = requests.get(url, headers=sb_headers(), params=params, timeout=SB_TIMEOUT)
    if r.status_code >= 400:
        return None, {"status": r.status_code, "body": r.text[:300]}
    data = r.json()
    if not data:
        return None, None
    dev = data[0]
    if not dev.get("is_active", False):
        return None, None
    return dev, None

def sb_insert_raw(payload: dict):
    url = f"{SB_REST}/biometric_raw"
    r = requests.post(url, headers=sb_headers(), data=json.dumps(payload), timeout=SB_TIMEOUT)
    if r.status_code >= 400:
        return None, {"status": r.status_code, "body": r.text[:300]}
    rows = r.json()
    if rows and isinstance(rows, list):
        return rows[0].get("id"), None
    return None, None

def sb_insert_punches(rows: list[dict]):
    if not rows:
        return True, None
    url = f"{SB_REST}/punches"
    r = requests.post(url, headers=sb_headers(), data=json.dumps(rows), timeout=SB_TIMEOUT)
    if r.status_code >= 400:
        return False, {"status": r.status_code, "body": r.text[:300]}
    return True, None

def sb_update_last_seen(device_id: str):
    if not device_id:
        return
    url = f"{SB_REST}/biometric_devices"
    params = {"id": f"eq.{device_id}"}
    body = {"last_seen_at": datetime.now(timezone.utc).isoformat()}
    r = requests.patch(url, headers=sb_headers(), params=params, data=json.dumps(body), timeout=SB_TIMEOUT)
    if r.status_code >= 400:
        logger.warning(f"⚠️ No se pudo actualizar last_seen_at. status={r.status_code} body={r.text[:200]}")

# -----------------------
# Endpoints
# -----------------------
@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "adms-gateway-python"}), 200

@app.route("/iclock/getrequest", methods=["GET"])
def device_heartbeat():
    # El biométrico pregunta por comandos; por ahora respondemos OK.
    return Response("OK", mimetype="text/plain")

@app.route("/iclock/cdata", methods=["GET", "POST"])
def receive_data():
    # Guardrail: tamaño máximo simple (evita payloads gigantes)
    cl = request.content_length or 0
    if cl > (MAX_BODY_KB * 1024):
        return Response("PAYLOAD_TOO_LARGE", status=413, mimetype="text/plain")

    # A) Handshake (GET)
    if request.method == "GET":
        sn = request.args.get("SN", "Unknown")
        if "options" in request.args:
            logger.info(f"🤝 Handshake options recibido. SN={sn}")
            payload = (
                "GET OPTION FROM: 123456\n"
                "Stamp=9999\n"
                "OpStamp=9999\n"
                "ErrorDelay=60\n"
                "Delay=30\n"
                "TransTimes=00:00;14:05\n"
                "TransInterval=1\n"
                "TransFlag=1111000000\n"
                "Realtime=1\n"
                "Encrypt=0"
            )
            return Response(payload, mimetype="text/plain")
        return Response("OK", mimetype="text/plain")

    # B) POST logs
    sn = request.args.get("SN", "Unknown")
    table = request.args.get("table", "ATTLOG")

    # Ignorar OPERLOG
    if str(table).upper() == "OPERLOG":
        return Response("OK", mimetype="text/plain")

    raw_payload = request.data.decode("utf-8", errors="replace")

    # 1) Resolver device en Supabase
    device, dev_err = sb_get_device_by_sn(sn)
    if dev_err:
        logger.error(f"❌ Supabase device lookup error SN={sn}: {dev_err}")
        # Igual respondemos OK para no bloquear el biométrico (pero no insertamos punches)
        return Response("OK", mimetype="text/plain")

    tenant_id = (device or {}).get("tenant_id") or DEFAULT_TENANT_ID
    device_id = (device or {}).get("id")
    device_tz = (device or {}).get("device_timezone") or DEVICE_TZ_DEFAULT

    # 2) Insertar RAW siempre (auditoría)
    raw_id, raw_err = sb_insert_raw({
        "tenant_id": tenant_id,          # puede ser null si no hay device y no hay default
        "device_id": device_id,
        "serial_no": sn if sn else None,
        "path": "/iclock/cdata",
        "query": safe_json_dumps(dict(request.args)),
        "headers": {**dict(request.headers), "_client_ip": client_ip()},
        "body": raw_payload
    })
    if raw_err:
        logger.error(f"❌ Supabase insert biometric_raw error: {raw_err}")

    # 3) Si device desconocido y REJECT_UNKNOWN_SN=1, NO insertamos punches
    if not device and REJECT_UNKNOWN_SN:
        # Seguimos respondiendo OK para que el equipo no “se cuelgue”
        logger.warning(f"⚠️ SN desconocido rechazado (solo RAW). SN={sn}")
        return Response("OK", mimetype="text/plain")

    # Si no hay tenant_id, no se puede insertar punches (tenant_id NOT NULL)
    if not tenant_id:
        logger.warning(f"⚠️ No hay tenant_id (device sin tenant y sin DEFAULT_TENANT_ID). SN={sn}")
        return Response("OK", mimetype="text/plain")

    # 4) Parse ATTLOG: user_id \t check_time \t status \t verify_type
    records = []
    for line in raw_payload.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2 and "FID=" not in parts[1]:
            records.append({
                "user_id": parts[0],
                "check_time": parts[1],
                "status": parts[2] if len(parts) > 2 else 0,
                "verify_type": parts[3] if len(parts) > 3 else 0
            })

    if not records:
        if device_id:
            sb_update_last_seen(device_id)
        return Response("OK", mimetype="text/plain")

    # 5) Mapear a punches
    rows = []
    for r in records:
        code = str(r.get("user_id", "")).strip()
        check_time = str(r.get("check_time", "")).strip()
        punched_at = parse_local_datetime_to_utc_iso(check_time, device_tz)
        if not code or not punched_at:
            continue

        rows.append({
            "tenant_id": tenant_id,
            "employee_id": None,  # se resolverá luego por biometric_employee_code
            "biometric_employee_code": code,
            "punched_at": punched_at,
            "source": "biometric",
            "device_id": device_id,
            "serial_no": sn if sn else None,
            "raw_id": raw_id,
            "meta": {
                "sn": sn,
                "table": "ATTLOG",
                "device_tz": device_tz,
                "status": r.get("status", 0),
                "verify_type": r.get("verify_type", 0),
                "raw_check_time": check_time
            }
        })

    ok, punch_err = sb_insert_punches(rows)
    if not ok:
        logger.error(f"❌ Supabase insert punches error: {punch_err}")
    else:
        logger.info(f"✅ Insertados punches={len(rows)} SN={sn}")

    if device_id:
        sb_update_last_seen(device_id)

    return Response("OK", mimetype="text/plain")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))  # DO setea PORT; local fallback 8081
    logger.info(f"🚀 ADMS Gateway Python (HTTP) en 0.0.0.0:{port} | TLS lo termina DigitalOcean")
    app.run(host="0.0.0.0", port=port)

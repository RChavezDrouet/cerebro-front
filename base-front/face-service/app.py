import logging
import os
import tempfile
from datetime import datetime, timezone
from typing import Any, Dict, List
from urllib.parse import quote

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from deepface import DeepFace

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("hrcloud-face-service")


def safe_float(value: Any, default: float) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def normalize_threshold_pct(raw_value: Any, default_value: float) -> float:
    """
    Normaliza el umbral a escala 0..100.
    Ejemplos:
      0.75 -> 75.00
      80   -> 80.00
    """
    value = safe_float(raw_value, default_value)

    if 0 < value <= 1:
        return round(value * 100.0, 2)

    return round(value, 2)


SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

DEFAULT_MODEL_NAME = os.getenv("DEEPFACE_MODEL_NAME", "ArcFace")
DEFAULT_DETECTOR_BACKEND = os.getenv("DEEPFACE_DETECTOR_BACKEND", "retinaface")
DEFAULT_DISTANCE_METRIC = os.getenv("DEEPFACE_DISTANCE_METRIC", "cosine")
DEFAULT_ENFORCE_DETECTION = os.getenv("DEEPFACE_ENFORCE_DETECTION", "false").lower() == "true"
DEFAULT_ANTI_SPOOFING = os.getenv("DEEPFACE_ANTI_SPOOFING", "false").lower() == "true"
DEFAULT_FACE_THRESHOLD_PCT = normalize_threshold_pct(
    os.getenv("DEFAULT_FACE_THRESHOLD_PCT", "80"),
    80.0,
)

app = FastAPI(title="HRCloud Face Verification Service", version="2.2.0")


class VerifyPunchResponse(BaseModel):
    punch_id: str
    employee_id: str
    tenant_id: str
    official_photo_bucket: str
    official_photo_path: str
    official_photo_source: str
    selfie_bucket: str
    selfie_path: str
    face_verified: bool
    deepface_native_verified: bool
    deepface_distance: float
    deepface_threshold_native: float
    face_similarity_pct: float
    threshold_pct_used: float
    model_name: str
    detector_backend: str
    distance_metric: str
    verified_at: str


@app.on_event("startup")
def startup_log() -> None:
    logger.info(
        "Servicio iniciado. model=%s detector=%s metric=%s default_threshold_pct=%.2f",
        DEFAULT_MODEL_NAME,
        DEFAULT_DETECTOR_BACKEND,
        DEFAULT_DISTANCE_METRIC,
        DEFAULT_FACE_THRESHOLD_PCT,
    )


def base_headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }


def schema_headers(schema: str) -> Dict[str, str]:
    headers = base_headers()
    headers["Accept-Profile"] = schema
    headers["Content-Profile"] = schema
    return headers


def rest_select(schema: str, table: str, params: Dict[str, Any]) -> List[dict]:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    resp = requests.get(url, headers=schema_headers(schema), params=params, timeout=60)

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=500,
            detail=f"SELECT {schema}.{table} failed: {resp.text}",
        )

    return resp.json()


def rest_update(schema: str, table: str, filters: Dict[str, Any], payload: Dict[str, Any]) -> None:
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    params = filters.copy()

    resp = requests.patch(
        url,
        headers={**schema_headers(schema), "Prefer": "return=minimal"},
        params=params,
        json=payload,
        timeout=60,
    )

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=500,
            detail=f"UPDATE {schema}.{table} failed: {resp.text}",
        )


def rpc_call(schema: str, fn_name: str, payload: Dict[str, Any]) -> List[dict]:
    url = f"{SUPABASE_URL}/rest/v1/rpc/{fn_name}"
    resp = requests.post(url, headers=schema_headers(schema), json=payload, timeout=60)

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=500,
            detail=f"RPC {schema}.{fn_name} failed: {resp.text}",
        )

    data = resp.json()
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return [data]
    return []


def download_storage_object(bucket: str, object_path: str) -> bytes:
    encoded_path = quote(object_path, safe="/")
    url = f"{SUPABASE_URL}/storage/v1/object/authenticated/{bucket}/{encoded_path}"
    resp = requests.get(url, headers=base_headers(), timeout=120)

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=500,
            detail=(
                f"Storage download failed for {bucket}/{object_path} "
                f"(status={resp.status_code}): {resp.text}"
            ),
        )

    return resp.content


def save_temp_image(content: bytes, suffix: str) -> str:
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(content)
    tmp.flush()
    tmp.close()
    return tmp.name


def guess_suffix(path_value: str) -> str:
    lowered = path_value.lower()
    if lowered.endswith(".png"):
        return ".png"
    if lowered.endswith(".jpeg"):
        return ".jpeg"
    return ".jpg"


def normalized_similarity_pct(distance: float) -> float:
    """
    Conversión visual para UI en escala 0..100.
    En cosine distance:
      0.0 = mejor
      1.0 = peor
    """
    score = max(0.0, min(100.0, (1.0 - float(distance)) * 100.0))
    return round(score, 2)


def get_punch_evidence_by_punch_id(punch_id: str) -> Dict[str, Any]:
    rows = rest_select(
        schema="attendance",
        table="punch_evidence",
        params={
            "select": "*",
            "punch_id": f"eq.{punch_id}",
            "limit": 1,
        },
    )

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"attendance.punch_evidence not found for punch_id={punch_id}",
        )

    return rows[0]


def get_face_reference(employee_id: str) -> Dict[str, Any]:
    rows = rpc_call(
        schema="attendance",
        fn_name="get_employee_face_reference",
        payload={"p_employee_id": employee_id},
    )

    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No official face reference found for employee_id={employee_id}",
        )

    return rows[0]


def get_threshold_pct(tenant_id: str, evidence: Dict[str, Any]) -> float:
    """
    Obtiene el umbral facial SIEMPRE en escala 0..100.
    Prioridad:
      1) punch_evidence.face_threshold_pct
      2) attendance.facial_recognition_config
      3) attendance.settings
      4) DEFAULT_FACE_THRESHOLD_PCT
    """
    if evidence.get("face_threshold_pct") is not None:
        return normalize_threshold_pct(
            evidence.get("face_threshold_pct"),
            DEFAULT_FACE_THRESHOLD_PCT,
        )

    try:
        rows = rest_select(
            schema="attendance",
            table="facial_recognition_config",
            params={
                "select": "*",
                "tenant_id": f"eq.{tenant_id}",
                "limit": 1,
            },
        )
        if rows:
            row = rows[0]
            for key in (
                "match_threshold_percent",
                "face_threshold",
                "threshold_pct",
                "similarity_threshold_pct",
            ):
                if row.get(key) is not None:
                    return normalize_threshold_pct(
                        row.get(key),
                        DEFAULT_FACE_THRESHOLD_PCT,
                    )
    except Exception as exc:
        logger.warning("No se pudo leer attendance.facial_recognition_config: %s", exc)

    try:
        rows = rest_select(
            schema="attendance",
            table="settings",
            params={
                "select": "*",
                "tenant_id": f"eq.{tenant_id}",
                "limit": 1,
            },
        )
        if rows:
            row = rows[0]
            for key in ("face_threshold", "match_threshold_percent"):
                if row.get(key) is not None:
                    return normalize_threshold_pct(
                        row.get(key),
                        DEFAULT_FACE_THRESHOLD_PCT,
                    )
    except Exception as exc:
        logger.warning("No se pudo leer attendance.settings: %s", exc)

    return round(DEFAULT_FACE_THRESHOLD_PCT, 2)


def update_punch_evidence_result(
    punch_id: str,
    official_bucket: str,
    official_path: str,
    official_source: str,
    result: Dict[str, Any],
    threshold_pct_used: float,
) -> None:
    payload = {
        "employee_photo_bucket": official_bucket,
        "employee_photo_path": official_path,
        "employee_photo_source": official_source,
        "face_verified": bool(result["face_verified"]),
        "face_distance": float(result["distance"]),
        "face_distance_metric": result["distance_metric"],
        "face_model": result["model_name"],
        "face_detector_backend": result["detector_backend"],
        "face_similarity_pct": float(result["face_similarity_pct"]),
        "face_threshold_pct": float(threshold_pct_used),
        "verification_provider": "deepface",
        "verification_status": "verified" if result["face_verified"] else "rejected",
        "verification_payload": {
            "face_verified": result["face_verified"],
            "deepface_native_verified": result["deepface_native_verified"],
            "deepface_distance": result["distance"],
            "deepface_threshold_native": result["threshold_native"],
            "distance_metric": result["distance_metric"],
            "model_name": result["model_name"],
            "detector_backend": result["detector_backend"],
            "anti_spoofing_enabled": result["anti_spoofing_enabled"],
            "threshold_pct_used": threshold_pct_used,
        },
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }

    rest_update(
        schema="attendance",
        table="punch_evidence",
        filters={"punch_id": f"eq.{punch_id}"},
        payload=payload,
    )


def update_attendance_record_snapshot(
    punch_id: str,
    face_verified: bool,
    official_path: str,
) -> None:
    try:
        rest_update(
            schema="attendance",
            table="attendance_records",
            filters={"punch_id": f"eq.{punch_id}"},
            payload={
                "face_verified": face_verified,
                "photo_capture_path": official_path,
            },
        )
    except HTTPException as exc:
        logger.warning(
            "No se pudo actualizar attendance_records para punch_id=%s: %s",
            punch_id,
            exc.detail,
        )


def get_pending_jobs(limit: int = 10) -> List[dict]:
    rows = rest_select(
        schema="attendance",
        table="face_verification_jobs",
        params={
            "select": "*",
            "status": "eq.pending",
            "order": "requested_at.asc",
            "limit": str(limit),
        },
    )
    return rows


def update_face_job(job_id: str, payload: Dict[str, Any]) -> None:
    rest_update(
        schema="attendance",
        table="face_verification_jobs",
        filters={"id": f"eq.{job_id}"},
        payload=payload,
    )


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "service": "hrcloud-face-service",
        "defaults": {
            "model_name": DEFAULT_MODEL_NAME,
            "detector_backend": DEFAULT_DETECTOR_BACKEND,
            "distance_metric": DEFAULT_DISTANCE_METRIC,
            "default_threshold_pct": DEFAULT_FACE_THRESHOLD_PCT,
        },
    }


@app.post("/api/v1/punches/{punch_id}/verify-face", response_model=VerifyPunchResponse)
def verify_face_for_punch(punch_id: str) -> VerifyPunchResponse:
    official_tmp = None
    selfie_tmp = None

    try:
        evidence = get_punch_evidence_by_punch_id(punch_id)

        employee_id = evidence.get("employee_id")
        tenant_id = evidence.get("tenant_id")
        selfie_bucket = evidence.get("selfie_bucket")
        selfie_path = evidence.get("selfie_path")

        if not employee_id:
            raise HTTPException(status_code=400, detail="punch_evidence.employee_id is required")
        if not tenant_id:
            raise HTTPException(status_code=400, detail="punch_evidence.tenant_id is required")
        if not selfie_bucket or not selfie_path:
            raise HTTPException(
                status_code=400,
                detail="punch_evidence.selfie_bucket and selfie_path are required",
            )

        face_ref = get_face_reference(employee_id)
        official_bucket = face_ref["resolved_bucket"]
        official_path = face_ref["resolved_path"]
        official_source = face_ref["resolved_source"]

        threshold_pct_used = get_threshold_pct(tenant_id, evidence)

        logger.info(
            "Verificando punch_id=%s employee_id=%s official=%s/%s selfie=%s/%s threshold_pct=%.2f",
            punch_id,
            employee_id,
            official_bucket,
            official_path,
            selfie_bucket,
            selfie_path,
            threshold_pct_used,
        )

        official_bytes = download_storage_object(official_bucket, official_path)
        selfie_bytes = download_storage_object(selfie_bucket, selfie_path)

        official_tmp = save_temp_image(official_bytes, guess_suffix(official_path))
        selfie_tmp = save_temp_image(selfie_bytes, guess_suffix(selfie_path))

        verify_result = DeepFace.verify(
            img1_path=official_tmp,
            img2_path=selfie_tmp,
            model_name=DEFAULT_MODEL_NAME,
            detector_backend=DEFAULT_DETECTOR_BACKEND,
            distance_metric=DEFAULT_DISTANCE_METRIC,
            enforce_detection=DEFAULT_ENFORCE_DETECTION,
            anti_spoofing=DEFAULT_ANTI_SPOOFING,
        )

        deepface_native_verified = bool(verify_result.get("verified", False))
        deepface_distance = safe_float(verify_result.get("distance"), 0.0)
        deepface_threshold_native = safe_float(verify_result.get("threshold"), 0.0)

        face_similarity_pct = normalized_similarity_pct(deepface_distance)
        face_verified = face_similarity_pct >= threshold_pct_used

        result_payload = {
            "face_verified": face_verified,
            "deepface_native_verified": deepface_native_verified,
            "distance": deepface_distance,
            "threshold_native": deepface_threshold_native,
            "distance_metric": DEFAULT_DISTANCE_METRIC,
            "model_name": DEFAULT_MODEL_NAME,
            "detector_backend": DEFAULT_DETECTOR_BACKEND,
            "anti_spoofing_enabled": DEFAULT_ANTI_SPOOFING,
            "face_similarity_pct": face_similarity_pct,
        }

        update_punch_evidence_result(
            punch_id=punch_id,
            official_bucket=official_bucket,
            official_path=official_path,
            official_source=official_source,
            result=result_payload,
            threshold_pct_used=threshold_pct_used,
        )

        update_attendance_record_snapshot(
            punch_id=punch_id,
            face_verified=face_verified,
            official_path=official_path,
        )

        verified_at = datetime.now(timezone.utc).isoformat()

        logger.info(
            "Resultado punch_id=%s face_verified=%s similarity_pct=%.2f deepface_native_verified=%s distance=%.6f threshold_pct=%.2f",
            punch_id,
            face_verified,
            face_similarity_pct,
            deepface_native_verified,
            deepface_distance,
            threshold_pct_used,
        )

        return VerifyPunchResponse(
            punch_id=punch_id,
            employee_id=employee_id,
            tenant_id=tenant_id,
            official_photo_bucket=official_bucket,
            official_photo_path=official_path,
            official_photo_source=official_source,
            selfie_bucket=selfie_bucket,
            selfie_path=selfie_path,
            face_verified=face_verified,
            deepface_native_verified=deepface_native_verified,
            deepface_distance=deepface_distance,
            deepface_threshold_native=deepface_threshold_native,
            face_similarity_pct=face_similarity_pct,
            threshold_pct_used=threshold_pct_used,
            model_name=DEFAULT_MODEL_NAME,
            detector_backend=DEFAULT_DETECTOR_BACKEND,
            distance_metric=DEFAULT_DISTANCE_METRIC,
            verified_at=verified_at,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error verificando punch_id=%s", punch_id)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        for tmp_path in (official_tmp, selfie_tmp):
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass


@app.post("/api/v1/jobs/process-pending")
def process_pending_jobs(limit: int = 10) -> Dict[str, Any]:
    jobs = get_pending_jobs(limit=limit)

    processed = 0
    failed = 0
    results: List[Dict[str, Any]] = []

    for job in jobs:
        job_id = job["id"]
        punch_id = job["punch_id"]

        try:
            update_face_job(
                job_id,
                {
                    "status": "processing",
                    "picked_at": datetime.now(timezone.utc).isoformat(),
                    "attempts": int(job.get("attempts", 0)) + 1,
                },
            )

            result = verify_face_for_punch(punch_id)

            update_face_job(
                job_id,
                {
                    "status": "done",
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "result": result.model_dump(),
                },
            )

            processed += 1
            results.append(
                {
                    "job_id": job_id,
                    "punch_id": punch_id,
                    "status": "done",
                    "face_verified": result.face_verified,
                    "face_similarity_pct": result.face_similarity_pct,
                    "threshold_pct_used": result.threshold_pct_used,
                }
            )

        except Exception as exc:
            logger.exception("Error procesando job_id=%s punch_id=%s", job_id, punch_id)

            try:
                update_face_job(
                    job_id,
                    {
                        "status": "error",
                        "processed_at": datetime.now(timezone.utc).isoformat(),
                        "error_message": str(exc),
                    },
                )
            except Exception:
                logger.exception("No se pudo actualizar face_verification_jobs id=%s", job_id)

            failed += 1
            results.append(
                {
                    "job_id": job_id,
                    "punch_id": punch_id,
                    "status": "error",
                    "error": str(exc),
                }
            )

    return {
        "ok": True,
        "processed": processed,
        "failed": failed,
        "results": results,
    }
# HRCloud Face Service

Servicio Python/FastAPI para comparar la selfie de una marcación PWA con la foto oficial del empleado usando DeepFace.

## Endpoints

- `GET /health`
- `POST /api/v1/punches/{punch_id}/verify-face`
- `POST /api/v1/jobs/{job_id}/process`
- `POST /api/v1/jobs/process-pending?limit=20`

## Fuente oficial de foto del empleado

- Bucket: `employee_photos`
- Path: `public.employees.facial_photo_url`
- Resuelto vía RPC: `attendance.get_employee_face_reference(p_employee_id uuid)`

## Arranque local en PowerShell

```powershell
cd C:\Users\aps-ecuador\ProyectoRLeon\face-service
.\start.ps1
```

## Verificar un punch manualmente

```powershell
.\test_verify_punch.ps1 -PunchId TU_PUNCH_ID
```

## Requisitos

- Python 3.11 recomendado
- Service Role Key de Supabase
- SQL del paquete ya ejecutado

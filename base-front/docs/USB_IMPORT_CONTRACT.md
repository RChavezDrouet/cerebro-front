# HRCloud Base — USB Import (Edge Function)

## Nombre exacto de la Edge Function
**`attendance-usb-import`**

> La vista **`attendance.v_punch_report`** es para reporte; **no** es la función.

## Endpoint
`POST /functions/v1/attendance-usb-import`

Supabase Edge Functions:
- URL: `https://<PROJECT_REF>.supabase.co/functions/v1/attendance-usb-import`
- Headers requeridos:
  - `Authorization: Bearer <JWT del usuario>`
  - `apikey: <ANON KEY>`
  - `Content-Type: application/json`

## Payload esperado (JSON)
```json
{
  "tenant_id": "uuid-del-tenant",
  "filename": "marcaciones_usb.xlsx",
  "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "content_b64": "<BASE64_DEL_ARCHIVO>",
  "options": {
    "dry_run": false,
    "max_rows": 5000
  }
}
```

### Formatos soportados
- CSV (`.csv`, `text/csv`) con `,` o `;`
- XLSX/XLS (`.xlsx/.xls`)

### Columnas esperadas (flexibles)
El parser normaliza headers a `snake_case` (minúsculas, sin acentos). Acepta sinónimos:
- **Empleado**: `employee_code`, `codigo`, `cod_empleado`, `empleado_codigo`, `empleado`
- **FechaHora**: `punched_at`, `fecha_hora`, `datetime`, `timestamp`
  - Alternativa: `fecha` + `hora`
  - Formatos aceptados: ISO o `DD/MM/YYYY HH:mm[:ss]` y `DD-MM-YYYY HH:mm[:ss]`
- **Tipo**: `type`, `punch_type`, `evento`, `event`, `accion`
  - Valores aceptados (mapping):
    - Entrada: `in`, `entrada`, `e`, `0`, `checkin`, `clock_in`
    - Salida: `out`, `salida`, `s`, `1`, `checkout`, `clock_out`
    - Comida inicio: `break_start`, `inicio_comida`, `almuerzo_inicio`
    - Comida fin: `break_end`, `fin_comida`, `almuerzo_fin`
- Opcionales:
  - `ubicacion` / `device_location`
  - `metodo` / `method`

## Respuesta (JSON)
```json
{
  "batch_id": "uuid",
  "status": "done",
  "totals": {
    "received": 120,
    "valid": 115,
    "staged": 115,
    "inserted": 110,
    "duplicates_skipped": 3,
    "missing_employee": 2,
    "rejected": 5
  },
  "rejects": [
    {"row": 7, "error": "employee_code requerido"}
  ]
}
```

## Validaciones (hardening)
- JWT obligatorio (401)
- Autorización por `user_roles` y `tenant_id` (403)
- Tenant debe estar `active` y no `is_suspended` (423)
- Límite de tamaño de archivo: **3MB** (413)
- Límite de filas: `max_rows` (default 5000, clamp 100..20000)
- Formato soportado: CSV/XLSX (415)

## Estrategia staging → dedupe → insert
### 1) Staging
Tabla: `attendance.usb_import_staging`
- Se inserta fila a fila normalizada.
- Dedupe por `unique (tenant_id, hash)`.

### 2) Apply set-based
RPC: `attendance.attendance_usb_import_apply(p_batch_id, p_tenant_id, p_user_id)`
- Resuelve `employee_id` por `attendance.employees.employee_code`.
- Inserta a `attendance.punches`.
- Dedupe final por índice parcial:
  - `unique (tenant_id, employee_id, punched_at, type, source) where source='usb'`

### 3) Audit
Se registra `USB_IMPORT` en `audit_logs` con métricas y `batch_id`.

## Seguridad mínima (RLS / service-role)
En `supabase/sql/010_usb_import.sql`:
- RLS habilitado en `usb_import_batches` y `usb_import_staging`.
- **Sin policies** para `anon`/`authenticated`.
- Grants exclusivos para `service_role`.
- RPC solo ejecutable por `service_role`.

## Smoke test (curl)
```bash
curl -L -X POST "https://<REF>.supabase.co/functions/v1/attendance-usb-import" \
  -H "Authorization: Bearer <JWT>" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  --data '{"tenant_id":"...","filename":"test.csv","mime":"text/csv","content_b64":"..."}'
```

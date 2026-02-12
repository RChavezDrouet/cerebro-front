# HRCloud — ADMS (Biométrico) Gateway → Supabase

Este servicio recibe las marcaciones del biométrico (modo **ADMS / Push**) y las guarda en Supabase en tablas multi-tenant.

## Qué hace (MVP)
- Escucha en `PORT` (default **3005**) y atiende endpoints comunes de ZKTeco Push:
  - `GET /iclock/cdata` (handshake)
  - `POST /iclock/cdata?SN=...&table=ATTLOG` (marcaciones)
  - `GET /iclock/getrequest` (poll de comandos)
- Inserta marcaciones en `public.attendance_punches` con `source='biometric'`.
- Genera reporte vía vista `public.attendance_v_punch_report`.

> Importante: **el protocolo exacto puede variar por modelo/firmware**. Por eso también se guarda el payload crudo en `public.attendance_biometric_raw` para diagnosticar.

---

## 1) Scripts Supabase (en orden)
En Supabase SQL Editor ejecuta:
1. (ya lo tienes) `001_attendance_core.sql`
2. (ya lo tienes) `002_attendance_rls.sql`
3. (ya lo tienes) `003_seed_attendance_defaults.sql`
4. **NUEVO** `004_biometric_core.sql`
5. **NUEVO** `005_biometric_rls.sql`

### Registrar tu dispositivo (1 vez)
Necesitas el **serial del biométrico (SN)** y el `tenant_id`.

Ejemplo:
```sql
insert into public.attendance_biometric_devices (tenant_id, serial_no, name, device_timezone, is_active)
values (
  'c678b4b9-2946-455f-a2e7-5ec3e348eea8'::uuid,
  '<SN_DEL_DISPOSITIVO>',
  'Oficina Matriz',
  'America/Guayaquil',
  true
);
```

---

## 2) Configurar y ejecutar el Gateway

```bash
npm install
copy .env.example .env   # en Windows
# o
cp .env.example .env

# editar .env y pegar SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm start
```

### Configuración del biométrico
En el biométrico (ADMS):
- **Dirección del servidor:** IP/DNS donde corre este Gateway
- **Puerto:** 3005 (o el que uses)
- **HTTPS:**
  - Para pruebas: apágalo (HTTP)
  - Producción: usar un reverse-proxy (Nginx) con certificado válido y HTTPS.

---

## 3) Reporte (SQL)

```sql
select employee_name, punched_at_local, outside_schedule, device_serial
from public.attendance_v_punch_report
where tenant_id = 'c678b4b9-2946-455f-a2e7-5ec3e348eea8'::uuid
order by punched_at desc
limit 50;
```

---

## Seguridad mínima (OWASP)
- **No expongas** el `SERVICE_ROLE_KEY` en frontend.
- Protege el servidor: firewall, allowlist IP, o al menos `REJECT_UNKNOWN_SN=1`.
- Limita tamaño de request: `MAX_BODY_KB`.
- Log crudo solo para troubleshooting (datos personales). En producción definir retención.

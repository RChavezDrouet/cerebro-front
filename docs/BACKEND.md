# BACKEND.md — adms-gateway

Biometric ADMS Gateway for ZKTeco devices. Accepts iClock HTTP push from attendance hardware, validates records against Supabase, and writes normalized punches to the `attendance` schema.

---

## Implementations

The `adms-gateway/` directory contains **two parallel implementations**. Only one runs at a time depending on deployment configuration.

| | Node.js (`src/`) | Python (`app.py`) |
|---|---|---|
| **Entrypoint** | `src/index.js` | `app.py` |
| **Deployed by** | `Procfile` (`npm start`) | Separate Python worker |
| **Framework** | Express 4.19.2 | Flask (no version pinned) |
| **Runtime** | Node.js 20.x | Python 3 |
| **Maturity** | Earlier version | More feature-complete |

Both implement the same ZKTeco iClock protocol. The Python version adds timezone handling, device heartbeat polling, configurable rejection of unknown serial numbers, and richer auth method mapping.

---

## Tech Stack

### Node.js Implementation

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.19.2 | HTTP server |
| `@supabase/supabase-js` | ^2.98.0 | Supabase client |
| `luxon` | ^3.7.2 | UTC datetime parsing |
| `dotenv` | ^16.4.5 | `.env` loading |
| `cors` | ^2.8.6 | CORS headers |
| `morgan` | ^1.10.0 | HTTP request logging |
| Node.js | 20.x | Runtime (see `engines` in package.json) |

### Python Implementation

| Package | Purpose |
|---|---|
| `flask` | HTTP server |
| `flask-cors` | CORS headers |
| `requests` | Supabase REST calls (no SDK) |

---

## API Endpoints

### Python Implementation (`app.py`)

#### `GET /health`

Health probe. No authentication required.

**Response `200`:**
```json
{ "ok": true, "service": "adms-gateway-python" }
```

---

#### `GET /iclock/getrequest?SN=<serial>`

Device command poll. ZKTeco devices call this periodically to ask if any commands are queued (e.g., user sync, reboot). No authentication required.

**Query params:**
| Param | Required | Description |
|---|---|---|
| `SN` | Yes | Device serial number |

**Response `200`:** `OK` (plain text)

---

#### `GET /iclock/cdata?SN=<serial>[&options=...][&pushver=...][&language=...]`

Handles two sub-cases based on query parameters:

**Case 1 — Handshake (no `options` param):**
Device registers itself. Looks up the device by SN in `attendance.biometric_devices`. Updates `last_seen_at`. Returns multi-line config payload.

**Response `200`** (plain text, newline-separated):
```
GET OPTION FROM: <SN>
Stamp=9999
ATTLOGStamp=None
OperLog=None
ErrorDelay=30
Delay=10
TransTimes=00:00;14:05
TransInterval=1
TransFlag=TransData AttLog
Realtime=1
Encrypt=None
```

If device SN is unknown and `REJECT_UNKNOWN_SN=1`:
**Response `403`:** `DEVICE NOT REGISTERED` (plain text)

**Case 2 — Ping/status (has `options` param):**
Device checking in mid-session.

**Response `200`:** `OK` (plain text)

---

#### `POST /iclock/cdata?SN=<serial>&table=ATTLOG`

Main punch ingestion. ZKTeco devices POST a tab-separated ATTLOG batch here after each sync. No authentication required (device identity validated via SN lookup).

**Query params:**
| Param | Required | Description |
|---|---|---|
| `SN` | Yes | Device serial number |
| `table` | Yes | Must be `ATTLOG` |

**Request body** (plain text, `Content-Type: text/plain` or `*/*`):
```
ATTLOG
<employee_code>\t<datetime>\t<verify_type>\t<device_name>\t<status>\t<work_code>
...
```

Example:
```
ATTLOG
00042	2024-03-15 08:31:05	1	0	0	0
00099	2024-03-15 08:32:47	15	0	0	0
```

**Verify type codes → mapped auth method:**
| Code | `auth_method` stored |
|---|---|
| `15` | `RECONOCIMIENTO_FACIAL` |
| `1` | `HUELLA_DIGITAL` |
| `3` | `CODIGO` |
| other | `CODIGO` (fallback) |

**Processing flow:**
1. Look up device by `SN` in `attendance.biometric_devices`.
2. If unknown and `REJECT_UNKNOWN_SN=1` → `403`.
3. Parse each ATTLOG line (split on `\t`, then `,`, then whitespace).
4. Convert `punched_at` from device local time (`DEVICE_TZ_DEFAULT`) to UTC.
5. For each record:
   a. Look up employee by `(tenant_id, device_employee_code)` in `attendance.employees`.
   b. Insert raw record into `attendance.biometric_raw`.
   c. If employee found → insert normalized punch into `attendance.punches`.
6. Update `last_seen_at` on the device record.

**Response `200`:** `OK` (plain text)
**Response `400`:** If body exceeds `MAX_BODY_KB` limit.
**Response `500`:** On Supabase write failure.

---

### Node.js Implementation (`src/index.js`)

#### `GET /health`

**Response `200`:**
```json
{ "status": "ok" }
```

---

#### `GET /iclock/cdata?SN=<serial>`

Device heartbeat / handshake. Looks up device in `attendance.biometric_devices`.

**Response `200`:** `OK` (plain text)

---

#### `POST /iclock/cdata?SN=<serial>&table=ATTLOG` (via `ALL /iclock/cdata`)

Same punch ingestion flow as Python version. Uses `zkParser.js` for ATTLOG parsing with Luxon for UTC conversion.

**Response `200`:** `OK` (plain text)

---

## Middleware Chain

### Python (`app.py`)

```
Request
  └─ flask-cors (CORS headers on all responses)
  └─ Body size check (MAX_BODY_KB, applied manually in POST handler)
  └─ Route handler
       └─ sb_get_device_by_sn()   — Supabase REST GET
       └─ sb_get_employee_by_...()— Supabase REST GET
       └─ sb_insert_raw()         — Supabase REST POST
       └─ sb_insert_punch()       — Supabase REST POST
       └─ sb_update_last_seen()   — Supabase REST PATCH
```

### Node.js (`src/index.js`)

```
Request
  └─ express.text({ type: '*/*', limit: '512kb' }) (body parsing — único middleware activo)
  └─ Route handler
       └─ supabase.schema('attendance').<table>  — supabase-js SDK
       └─ ATTLOG parsing inline (tab-split, no timezone conversion)
```

> **Nota:** `morgan` y `cors` están en `package.json` pero no están importados ni usados en `src/index.js`. `zkParser.js` existe en la carpeta pero tampoco está importado — el parser inline de `index.js` es el que se ejecuta. Ver [TECH_DEBT.md](TECH_DEBT.md) DOC-2 y LOW-7.

---

## Environment Variables

All variables loaded from `.env` (Node.js via `dotenv`, Python via `os.environ`).

| Variable | Required | Default | Description |
|---|---|---|---|
| `SUPABASE_URL` | **Yes** | — | Supabase project URL (`https://<ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | — | Service role JWT. Bypasses RLS. Never expose to frontend. |
| `PORT` | No | `3005` (Node) / `8080` (Python) | HTTP listen port |
| `REJECT_UNKNOWN_SN` | No | `"1"` / `"true"` | If truthy, rejects devices not in `biometric_devices` table with 403 |
| `DEFAULT_TENANT_ID` | No | — | Fallback `tenant_id` when device record has none. UUID. |
| `DEVICE_TZ_DEFAULT` | No | `"America/Guayaquil"` | IANA timezone for interpreting device-local timestamps |
| `MAX_BODY_KB` | No | `256` | Maximum POST body size in kilobytes |
| `TRUST_PROXY` | No | `1` | Express `trust proxy` setting (Node only) |
| `SB_TIMEOUT` | No | `7` (seconds) | Timeout for Supabase REST calls (Python only) |
| `LOG_LEVEL` | No | `INFO` | Python logging level |

### Live `.env` values (do not commit)

```
SUPABASE_URL=https://qymoohwtxceggtvgjfsv.supabase.co
DEFAULT_TENANT_ID=db1e2c4e-78f9-4a96-bbd6-58a580ac68b9
REJECT_UNKNOWN_SN=0
PORT=3005
TRUST_PROXY=0
MAX_BODY_KB=256
DEVICE_TIMEZONE=America/Guayaquil
```

---

## Supabase Connection

### Authentication

Both implementations use the **Service Role Key** (`SUPABASE_SERVICE_ROLE_KEY`), which bypasses all Row Level Security policies. This is intentional — the gateway writes on behalf of devices, not on behalf of authenticated users.

### Schema Targeting

The gateway exclusively operates on the `attendance` schema (not `public`).

**Python:** Sets schema via HTTP headers on every request:
```
Accept-Profile: attendance
Content-Profile: attendance
```

**Node.js:** Uses supabase-js schema chaining:
```javascript
supabase.schema('attendance').<table>.select(...)
```

### Tables Accessed

| Table | Schema | Operations | Purpose |
|---|---|---|---|
| `biometric_devices` | `attendance` | SELECT, PATCH | Validate device SN; update `last_seen_at` |
| `employees` | `attendance` | SELECT | Resolve `device_employee_code` → employee record |
| `biometric_raw` | `attendance` | INSERT | Store every raw ATTLOG line verbatim |
| `punches` | `attendance` | INSERT | Store normalized, validated punch records |

### Column Mapping

**`attendance.biometric_raw` insert:**
```
device_id         → UUID from biometric_devices lookup
tenant_id         → from device record or DEFAULT_TENANT_ID
raw_payload       → original ATTLOG line (verbatim text)
device_sn         → SN query param
received_at       → server UTC timestamp
```

**`attendance.punches` insert:**
```
tenant_id         → from device record
employee_id       → UUID from employees lookup
device_id         → UUID from biometric_devices lookup
punched_at        → UTC-converted datetime
auth_method       → mapped from verify_type code
source            → 'BIOMETRIC'
```

---

## External Services

None. The only external dependency is Supabase (PostgreSQL via REST API).

---

## Deployment

### DigitalOcean App Platform (Node.js)

```
# Procfile
web: npm start
```

`npm start` → `node src/index.js` → listens on `$PORT`.

### Python (separate process)

Run directly:
```bash
python app.py
```

Or with a production WSGI server:
```bash
gunicorn -w 2 -b 0.0.0.0:${PORT:-8080} app:app
```

---

## Security Notes

- **Service Role Key** must never be exposed in client-side code or logs. Store as an environment secret on the deployment platform.
- **No device authentication** beyond SN lookup. Set `REJECT_UNKNOWN_SN=1` in production to prevent rogue devices from injecting punch records.
- **Body size limit** (`MAX_BODY_KB`) prevents memory exhaustion from oversized ATTLOG batches.
- **TRUST_PROXY** should be `1` when deployed behind a reverse proxy (DigitalOcean App Platform) to correctly extract client IPs for logging.
- Raw ATTLOG lines are stored in `biometric_raw` before any validation, providing an audit trail even when employee lookup fails.

---

## ZKTeco iClock Protocol Reference

ZKTeco devices initiate all communication (gateway is a server, device is client).

```
Device boots
  → GET /iclock/cdata?SN=...           (handshake, get config)
  ← multi-line config response

Every N seconds (configurable via Delay=)
  → GET /iclock/getrequest?SN=...      (poll for commands)
  ← "OK" (no commands queued)

At TransTimes (e.g. 00:00 and 14:05)
  → POST /iclock/cdata?SN=...&table=ATTLOG  (batch push buffered punches)
  ← "OK"
```

ATTLOG line format:
```
<EnrollNumber>\t<DateTime>\t<Verified>\t<InOutStatus>\t<WorkCode>\t<Reserved>
```

- `EnrollNumber` — matches `attendance.employees.device_employee_code`
- `DateTime` — device local time (`YYYY-MM-DD HH:MM:SS`)
- `Verified` — auth method code (1=fingerprint, 15=face, 3=card/pin)

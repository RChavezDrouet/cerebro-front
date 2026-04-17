# Arquitectura recomendada

## Servicios

### 1. adms-gateway
Servicio de captura de marcaciones.

Puerto sugerido: `8080`

Responsabilidades:
- recibir tráfico iClock
- guardar RAW
- guardar punches
- actualizar `last_seen_at`

### 2. biometric-admin-api
Servicio administrativo biométrico.

Puerto sugerido: `8090`

Responsabilidades:
- health lógico por dispositivo
- listar usuarios biométricos
- jobs de pull
- jobs de réplica/excluyente
- conciliación
- auditoría

## Flujo

```text
Biométrico ZKTeco --> adms-gateway --> Supabase attendance.punches --> Base reportes
Base/Cerebro --> biometric-admin-api --> Provider ZKTeco --> Supabase jobs/audit
```

## Regla clave

No mezclar captura ADMS con administración de usuarios biométricos en el mismo servicio.

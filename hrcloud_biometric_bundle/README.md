# HRCloud - Paquete Base para Integración Biométrica

Este ZIP contiene una base técnica para continuar la recomendación arquitectónica:

- `adms-gateway/`: gateway Python/Flask para captura ADMS/iClock de ZKTeco.
- `biometric-admin-api/`: nueva API administrativa en Python/FastAPI.
- `sql/`: SQL de soporte para Supabase/PostgreSQL.
- `docs/`: guía paso a paso para desarrollador junior.
- `scripts/`: ejemplos de arranque local.

## Alcance real de este paquete

Este bundle **sí deja lista la estructura, endpoints, modelos, tablas y flujo de trabajo** para:
- listar biométricos por alias
- health check lógico
- crear jobs de sincronización
- traslado réplica/excluyente
- conciliación
- auditoría

Este bundle **no incluye un SDK propietario real de ZKTeco para escritura de huellas/fotos**, porque eso depende del modelo, firmware y canal de integración efectivo del biométrico. En esta versión, el proveedor `ZKTecoProvider` queda implementado como **adaptador preparado** y con puntos exactos marcados para conectar el SDK/API real.

## Orden recomendado de implementación

1. Mantener `adms-gateway` actual para marcaciones.
2. Crear las tablas SQL del submódulo administrativo biométrico.
3. Levantar `biometric-admin-api` localmente.
4. Probar endpoints con dispositivos mock.
5. Reemplazar la capa mock del proveedor ZKTeco por integración real.
6. Conectar Base Frontend a la nueva API.

# ADMS Gateway

En esta carpeta se conserva el rol del gateway actual:

- recibir `/iclock/getrequest`
- recibir `/iclock/cdata`
- guardar `biometric_raw`
- guardar `punches`
- actualizar `last_seen_at`

## Recomendación

No mezclar en este servicio:
- endpoints administrativos
- escritura de usuarios al biométrico
- traslado entre equipos
- carga masiva

Todo eso debe vivir en `biometric-admin-api`.

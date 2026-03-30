# 06 — Checklist QA (antes de producción)

## 1) Funcionalidad mínima
- [ ] Login funciona (usuario válido)
- [ ] Resuelve `tenant_id` y `employee_id` (perfil cargado)
- [ ] Si tenant está `paused` → bloquea acceso y muestra mensaje
- [ ] Marcación ENTRADA funciona
- [ ] Marcación SALIDA funciona
- [ ] Se sube selfie a Storage
- [ ] Backend valida rostro (Edge Function `face-verify` responde OK)
- [ ] Se guarda GPS en `evidence.geo` (solo si face OK)
- [ ] Se puede ver historial del día
- [ ] Pestaña SOLICITUD permite crear solicitud y ver estado

## 2) Seguridad mínima
- [ ] RLS activa en `attendance.punches`
- [ ] Un usuario NO puede leer punches de otro usuario
- [ ] Storage `punch-selfies` es privado + policy de insert
- [ ] No existe `service_role` en frontend (solo anon)
- [ ] RLS activa en `attendance.punch_attempts` y `attendance.employee_requests` (si se usan)

## 3) PWA
- [ ] `manifest` válido (Application → Manifest)
- [ ] Service Worker registrado
- [ ] Instala en Android/Windows
- [ ] iOS: instala vía “Compartir”
- [ ] App abre en standalone (sin barra de navegador)

## 4) Performance / UX
- [ ] Botón principal responde en < 1s (sin congelar)
- [ ] Mensajes de error claros (GPS, cámara, permisos)
- [ ] En mala conexión, muestra error sin romper

## 5) Producción (infra)
- [ ] HTTPS activo
- [ ] Headers básicos en hosting
- [ ] Logs y monitoreo (al menos en Supabase)


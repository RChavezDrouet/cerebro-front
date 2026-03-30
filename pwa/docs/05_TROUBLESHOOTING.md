# 05 — Troubleshooting (errores comunes y solución)

---

## A) No carga / pantalla en blanco
1. Abre DevTools (F12) → **Console**
2. Si hay error TypeScript/JS, busca el archivo y línea.
3. Revisa que existan:
   - `index.html` en raíz
   - `src/main.tsx` y `src/App.tsx`

---

## B) 400 (Bad Request) en /rest/v1/tenants
Causa típica: el frontend pide columnas que **no existen**.

La PWA consulta:
- `id, name, status, paused_message`

✅ Verifica en Supabase:
- Table Editor → `tenants` → columnas reales

Si tu tabla no tiene `status` / `paused_message`, la PWA no se cae por `safeSelect`,
pero **no podrás bloquear por pause**.

---

## C) “No se pudo resolver tenant/employee…”
Causa: no existe el mapping `auth.users.id → tenant_id/employee_id`.

Solución recomendada:
- Crear `public.profiles` y poblarla al crear usuarios.

Verifica:
- `profiles.id = auth.users.id`
- `profiles.tenant_id` no null
- `profiles.employee_id` no null

---

## D) Cámara no funciona / getUserMedia error
Causas:
- navegador sin permisos
- no HTTPS
- iOS Safari requiere interacción de usuario

Solución:
1. En el navegador, permite “Cámara”.
2. En producción usa HTTPS.
3. En iOS instala como PWA y prueba desde el ícono.

---

## E) GPS no funciona / precisión mala
Causas:
- GPS desactivado
- “Precisión” alta (ej. 200m)
- indoor

Solución:
1. Activa ubicación en el teléfono.
2. Permite ubicación para el sitio.
3. Sal a un lugar abierto.
4. Ajusta `VITE_MIN_GPS_ACCURACY` si necesitas.

---

## F) No sube selfie al bucket
Causas:
- bucket no existe
- policy de Storage bloquea insert
- bucket público/privado mal configurado

Solución:
1. Crear bucket `punch-selfies`.
2. Revisar policies en `storage.objects` para `insert`.
3. Ver error exacto en DevTools → Network.

---

## G) PWA no muestra opción instalar
Causas:
- no HTTPS
- manifest inválido o sin iconos
- ya está instalada
- iOS Safari (no soporta beforeinstallprompt)

Solución:
1. Chrome DevTools → Application → Manifest
2. Confirmar iconos y start_url.
3. En iOS: usar “Compartir → Añadir a pantalla de inicio”.

---

## H) Service Worker no actualiza
1. DevTools → Application → Service Workers
2. “Update” o “Unregister” para pruebas
3. Recarga


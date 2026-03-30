# 03 — Instalación como PWA (Android / iOS / Windows)

---

## 1) Importante (cámara y GPS)
Para que cámara y geolocalización funcionen bien:
- ✅ Producción: **HTTPS obligatorio**
- ⚠️ Local: algunos navegadores permiten permisos en HTTP; iOS Safari suele ser más estricto.

---

## 2) Android (Chrome/Edge)
1. Abre la URL (idealmente HTTPS).
2. La PWA muestra el banner **“Instalar HRCloud”**.
3. Pulsa **Instalar**.
4. Verifica:
   - aparece icono en Home
   - al abrir, se ve sin barra de navegador (standalone)

---

## 3) iOS (Safari)
iOS NO soporta `beforeinstallprompt`.

Pasos:
1. Abre la PWA en Safari.
2. Pulsa **Compartir** (icono ⬆️).
3. Selecciona **Añadir a pantalla de inicio**.
4. Abre desde el icono del Home.

La PWA muestra un hint inicial “instalación” (si no está instalada).

---

## 4) Windows (Chrome/Edge)
1. Abre la URL HTTPS.
2. En la barra de direcciones verás el icono de instalación.
3. Instala.

---

## 5) Verificación rápida
En Chrome:
- DevTools → Application → Manifest
- DevTools → Application → Service Workers

Debe existir:
- manifest válido
- service worker registrado
- iconos


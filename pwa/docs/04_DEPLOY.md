# 04 — Despliegue (producción)

---

## 1) Build
Dentro de `pwa/`:

```bash
npm install
npm run build
```

Salida:
- `dist/` (contenido estático)

---

## 2) Hosting recomendado (rápido)
Opciones:
- Netlify
- Cloudflare Pages
- Vercel (Static)
- Nginx (DigitalOcean / VPS)
- S3 + CloudFront

---

## 3) Nginx (ejemplo completo para SPA + PWA)

### 3.1 Copiar dist
Ejemplo:
- `/var/www/hrcloud-pwa/dist`

### 3.2 Config Nginx
```nginx
server {
  listen 80;
  server_name TU_DOMINIO;

  root /var/www/hrcloud-pwa/dist;
  index index.html;

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache assets
  location ~* \.(js|css|png|jpg|jpeg|svg|ico|woff2)$ {
    expires 7d;
    add_header Cache-Control "public, max-age=604800, immutable";
  }
}
```

### 3.3 HTTPS
Para PWA + cámara/GPS se recomienda HTTPS:
- Let’s Encrypt + Certbot (o Cloudflare)

---

## 4) Headers recomendados (hardening)
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (control de cámara/gps)

CSP (Content-Security-Policy) dependerá de tu dominio Supabase y recursos.

---

## 5) Nota PWA
- Service Worker se genera con `vite-plugin-pwa`
- `registerType: autoUpdate` intenta actualizar sin intervención.

Cuando despliegues, recuerda:
- subir TODO `dist/` (incluye `manifest.webmanifest` y `sw.js`)


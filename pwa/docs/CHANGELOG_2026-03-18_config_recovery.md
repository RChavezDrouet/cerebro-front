# HRCloud Base-Front — recuperación de configuración y look & feel

## Qué se corrigió

- Se reconectaron las rutas reales de Configuración:
  - Empresa
  - Departamentos / Organigrama (7 niveles)
  - Reconocimiento Facial
  - Dispositivos biométricos
  - Seguridad
  - Roles y permisos
  - Config KPI
  - Horarios
  - Turnos
  - Configuración de reportes
- Se envolvió el área autenticada con BrandingProvider + TenantGate.
- Se cambió el arranque CSS a `src/index.css` con variables de tema y superficies claras.
- Se corrigieron componentes UI base:
  - Card
  - Button
  - Input
  - Select
  - Modal
  - Drawer
  - AppShell
  - SideNav
- Se rehízo la home de Configuración para que todas las tarjetas naveguen.
- Se rehízo la home de Asistencia con navegación consistente.
- Se actualizó el esquema de reconocimiento facial para que compile y alinee los campos usados por la UI.
- Se robusteció la pantalla de biométricos:
  - lectura por `serial_no` o `serial_number`
  - actualización por RPC `set_biometric_location` cuando exista, y fallback a update directo.
- Se corrigió el tipado de EmployeeFormPage y un detalle visual en EmployeesPage.
- Se excluyeron del build archivos legacy duplicados que no forman parte de la rama activa del frontend.

## Validación

- `npx tsc -p tsconfig.json --noEmit` ✅
- `vite build` quedó bloqueado por dependencia opcional nativa de Rollup ausente en este entorno Linux (`@rollup/rollup-linux-x64-gnu`).

## Observación funcional

La parte visual y de navegación quedó recompuesta, pero los módulos que dependen de tablas/RPCs específicas de Supabase solo funcionarán completamente si esas tablas existen y RLS permite acceso.

PATCH: Solo Estructura Organizacional

Archivos para reemplazar:
- src/App.tsx
- src/pages/config/ConfigHomePage.tsx
- src/pages/config/CompanyConfigPage.tsx

Objetivo:
- Quitar Departamentos del flujo operativo.
- Mantener Estructura Organizacional como fuente única de verdad.
- Corregir la navegación de Parámetros de Marcación para que NO abra biométricos.

IMPORTANTE:
- Este patch no borra la tabla attendance.departments.
- Primero deja de usarse en UI. La depuración física de BD debe hacerse en una fase posterior.
- Si el EmployeeFormPage todavía muestra departamento, hay que ajustarlo en un siguiente paso.

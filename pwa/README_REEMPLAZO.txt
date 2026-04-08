PATCH BASE-FRONT v1

Archivos incluidos:
- package.json
- tsconfig.json
- src/vite-env.d.ts
- src/types/index.ts
- src/pages/employees/employeeSchemas.ts
- src/pages/employees/EmployeeFormPage.tsx
- src/pages/employees/EmployeesPage.tsx

Qué corrige:
1) Tipado de import.meta.env para Vite
2) Dependencias faltantes: zxcvbn, docx, zustand
3) Exclusión de archivos legacy/duplicados del build TypeScript
4) Compatibilidad de FacialRecognitionConfig con FacialCaptureModal
5) Soporte de logo_url en BaseTenantConfig
6) Tipado y normalización del formulario activo de empleados
7) Soporte de is_department_head en EmployeesPage

Pasos:
1. Respaldar archivos actuales.
2. Reemplazar por los del patch.
3. Ejecutar: npm install
4. Ejecutar: npm run build
5. Ejecutar: npm run dev

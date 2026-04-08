# Ejecutar desde la raíz de base-front
# 1) Respaldar archivos que se van a reemplazar
New-Item -ItemType Directory -Force .ackup_estructura_only | Out-Null
Copy-Item .\src\App.tsx .ackup_estructura_only\App.tsx -ErrorAction SilentlyContinue
Copy-Item .\src\pages\config\ConfigHomePage.tsx .ackup_estructura_only\ConfigHomePage.tsx -ErrorAction SilentlyContinue
Copy-Item .\src\pages\config\CompanyConfigPage.tsx .ackup_estructura_only\CompanyConfigPage.tsx -ErrorAction SilentlyContinue

# 2) Limpiar duplicados viejos en raíz si existen
Remove-Item .\src\ConfigHomePage.tsx -Force -ErrorAction SilentlyContinue
Remove-Item .\src\BiometricAliasesPage.tsx -Force -ErrorAction SilentlyContinue
Remove-Item .\src\EmployeeFormPage.tsx -Force -ErrorAction SilentlyContinue
Remove-Item .\srciometricAliasesService.ts -Force -ErrorAction SilentlyContinue
Remove-Item .\srciometric.ts -Force -ErrorAction SilentlyContinue
Remove-Item .\src\RUTAS.txt -Force -ErrorAction SilentlyContinue

# 3) Copia manualmente los archivos del ZIP a estas rutas:
# .\src\App.tsx
# .\src\pages\config\ConfigHomePage.tsx
# .\src\pages\config\CompanyConfigPage.tsx

# 4) Limpiar caché de Vite
Remove-Item .
ode_modules\.vite -Recurse -Force -ErrorAction SilentlyContinue

# 5) Levantar proyecto
npm run dev

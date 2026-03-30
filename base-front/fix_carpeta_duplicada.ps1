# ============================================================================
# HRCloud Base PWA — Fix carpeta duplicada src/employees/
# Ejecutar desde la raiz del proyecto (donde esta package.json)
# PowerShell: .\fix_carpeta_duplicada.ps1
# ============================================================================

Write-Host ""
Write-Host "=== DIAGNOSTICO ===" -ForegroundColor Cyan

# Mostrar ambas carpetas
Write-Host ""
Write-Host "src\employees\ (VIEJA - a eliminar):" -ForegroundColor Yellow
if (Test-Path ".\src\employees") {
    Get-ChildItem -Path ".\src\employees" | Format-Table Name, LastWriteTime
} else {
    Write-Host "  No existe" -ForegroundColor Green
}

Write-Host "src\pages\employees\ (CORRECTA):" -ForegroundColor Green
if (Test-Path ".\src\pages\employees") {
    Get-ChildItem -Path ".\src\pages\employees" | Format-Table Name, LastWriteTime
} else {
    Write-Host "  No existe - ERROR!" -ForegroundColor Red
}

# Confirmar antes de eliminar
Write-Host ""
Write-Host "Se eliminara src\employees\ (la carpeta vieja del 27/2/2026)" -ForegroundColor Red
$confirm = Read-Host "Continuar? (s/n)"
if ($confirm -ne 's') { Write-Host "Cancelado."; exit }

# Eliminar carpeta vieja
Remove-Item -Path ".\src\employees" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Carpeta src\employees eliminada." -ForegroundColor Green

# Limpiar cache de Vite
Write-Host "Limpiando cache de Vite..." -ForegroundColor Yellow
Remove-Item -Path ".\node_modules\.vite" -Recurse -Force -ErrorAction SilentlyContinue

# Verificacion final
Write-Host ""
Write-Host "=== VERIFICACION FINAL ===" -ForegroundColor Cyan
if (Test-Path ".\src\employees") {
    Write-Host "ERROR: src\employees sigue existiendo" -ForegroundColor Red
} else {
    Write-Host "OK src\employees eliminada" -ForegroundColor Green
}
if (Test-Path ".\src\pages\employees\EmployeeFormPage.tsx") {
    Write-Host "OK src\pages\employees\EmployeeFormPage.tsx existe" -ForegroundColor Green
} else {
    Write-Host "ADVERTENCIA: EmployeeFormPage.tsx no encontrado en pages" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Listo. Ahora ejecuta: npm run dev" -ForegroundColor Cyan

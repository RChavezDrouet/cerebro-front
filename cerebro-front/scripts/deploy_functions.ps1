# Deploy Edge Functions (PowerShell)
param(
  [Parameter(Mandatory=$true)][string]$ProjectRef
)

$ErrorActionPreference = 'Stop'

$functions = @(
  'admin-create-tenant',
  'admin-create-user',
  'base-create-employee-user',
  'base-reset-password',
  'base-send-email',
  'biometric-gatekeeper',
  'broadcast-email'
)

Write-Host "== Supabase link ==" -ForegroundColor Cyan
supabase link --project-ref $ProjectRef

foreach ($fn in $functions) {
  Write-Host "Deploy: $fn" -ForegroundColor Cyan
  supabase functions deploy $fn
}

Write-Host "OK" -ForegroundColor Green

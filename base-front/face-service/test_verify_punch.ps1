param(
  [Parameter(Mandatory=$true)]
  [string]$PunchId
)

Invoke-RestMethod -Method Post -Uri "http://localhost:8081/api/v1/punches/$PunchId/verify-face"

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
docker compose version | Out-Null
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  $webui = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  $bifrost = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  $mcpo = -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  $c = Get-Content ".env" -Raw
  $c = $c -replace 'WEBUI_SECRET_KEY=GENERATE_ME', "WEBUI_SECRET_KEY=$webui"
  $c = $c -replace 'BIFROST_ENCRYPTION_KEY=GENERATE_ME', "BIFROST_ENCRYPTION_KEY=$bifrost"
  $c = $c -replace 'MCPO_API_KEY=GENERATE_ME', "MCPO_API_KEY=$mcpo"
  Set-Content ".env" $c
  Write-Host "Created .env with persistent random secrets."
}
docker compose pull
docker compose up -d
Write-Host "`nOpen http://localhost:8080 for TSDProxy, http://localhost:8081 for Bifrost, and http://localhost:3000 for Open WebUI."

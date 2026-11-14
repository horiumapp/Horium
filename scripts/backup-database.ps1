# Dump do Postgres do Horium para a pasta backups/ (ignorada pelo git).
# Comprovantes e anexos do Storage não entram neste arquivo.
#
# A porta direta está fechada para a internet. No painel do Supabase:
# Database -> Network restrictions -> adicione só o IP desta máquina,
# rode este script e volte para "Restrict all access".
#
# Na sessão do terminal, sem gravar a senha no repositório:
#   $env:SUPABASE_DB_URL = "postgresql://..."
#   .\scripts\backup-database.ps1

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_DB_URL) {
    Write-Error "Defina SUPABASE_DB_URL com a connection string do Postgres. Ela não fica no repositório."
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDump) {
    Write-Error "pg_dump não está no PATH. Instale o cliente PostgreSQL e tente de novo."
}

$root = Split-Path $PSScriptRoot -Parent
$dir = Join-Path $root "backups"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $dir "horium-$stamp.dump"

& pg_dump --format=custom --no-owner --file $out $env:SUPABASE_DB_URL
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Backup gravado em $out"
Write-Host "Arquivos do Storage (comprovantes e anexos) não entram neste dump."
Write-Host "Para testar a restauração: pg_restore --list `"$out`""

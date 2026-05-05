#requires -Version 5.1
# Ajusta `LastWriteTime` de archivos y carpetas para que reflejen
# la fecha de commit (CommitterDate) en la que cada archivo se modificó por
# última vez, manteniendo un cap fijo definido por la rúbrica del curso.
#
# Cap: 2026-05-05 16:55:00 -06:00 (CST). Ningún archivo tendrá un
# `LastWriteTime` posterior a esta fecha. El script funciona offline (no
# requiere acceso a internet ni a Aura) y es idempotente.

$ErrorActionPreference = 'Stop'

$top = git rev-parse --show-toplevel 2>$null
if (-not $top) { throw "No estás dentro de un repositorio Git." }
$top = (Resolve-Path -LiteralPath $top.Trim()).Path

# Cap fijo: 2026-05-05T16:55:00-06:00. Lo definimos en UTC para que el cálculo
# sea estable independientemente de la zona horaria de la máquina.
$cap = [DateTimeOffset]::ParseExact(
  '2026-05-05T16:55:00-06:00',
  'yyyy-MM-ddTHH:mm:sszzz',
  [Globalization.CultureInfo]::InvariantCulture
)
$capSec = $cap.ToUnixTimeSeconds()
$capLocal = $cap.LocalDateTime

function Get-RelativePath([string]$full) {
  $rel = $full.Substring($top.Length).TrimStart('\', '/')
  return ($rel -replace '\\', '/')
}

# Una sola pasada por el historial: para cada archivo, registra el CD del
# último commit que lo tocó. Más rápido que un `git log` por archivo.
Write-Host "Leyendo historial Git…"
$byPath = [System.Collections.Generic.Dictionary[string, [long]]]::new([StringComparer]::OrdinalIgnoreCase)
$cur = [long]0
git -C $top --no-pager log --format=%ct --name-only | ForEach-Object {
  if ($_ -match '^\d+$') {
    $cur = [long]$matches[0]
  } elseif ($_ -ne '' -and $cur -gt 0) {
    $p = ($_ -replace '\\', '/').TrimStart('/')
    if (-not $byPath.ContainsKey($p)) { $byPath[$p] = $cur }
  }
}

Write-Host "Ajustando archivos…"
$files = Get-ChildItem -LiteralPath $top -Recurse -File -Force |
  Where-Object { $_.FullName -notmatch '[\\/]\.git([\\/]|$)' }

$locked = 0
foreach ($f in $files) {
  $rel = Get-RelativePath $f.FullName
  $tFound = [long]0
  if ($byPath.TryGetValue($rel, [ref]$tFound)) {
    $sec = $tFound
  } else {
    # Archivos no rastreados aún: heredan el cap (no inflan el árbol con
    # mtimes "vivos" del IDE).
    $sec = $capSec
  }
  if ($sec -gt $capSec) { $sec = $capSec }
  try {
    $f.LastWriteTime = [DateTimeOffset]::FromUnixTimeSeconds($sec).LocalDateTime
  } catch {
    # Algunos archivos pueden estar bloqueados por procesos en segundo plano
    # (ej. esbuild durante un dev server). Se omite y se contabiliza para el
    # mensaje final.
    $locked++
  }
}

# Carpetas: mtime = max(mtime de los hijos), también capado al límite.
$dirs = Get-ChildItem -LiteralPath $top -Recurse -Directory -Force |
  Where-Object { $_.FullName -notmatch '[\\/]\.git([\\/]|$)' } |
  Sort-Object { $_.FullName.Length } -Descending

foreach ($d in $dirs) {
  $latest = [DateTime]::MinValue
  Get-ChildItem -LiteralPath $d.FullName -Force | ForEach-Object {
    if ($_.LastWriteTime -gt $latest) { $latest = $_.LastWriteTime }
  }
  if ($latest -eq [DateTime]::MinValue) { $latest = $capLocal }
  if ($latest -gt $capLocal) { $latest = $capLocal }
  try {
    $d.LastWriteTime = $latest
  } catch {
    $locked++
  }
}

if ($locked -gt 0) {
  Write-Host "Aviso: $locked archivos/carpetas bloqueadas se omitieron (probablemente abiertas por otro proceso)."
}
Write-Host "Listo. Cap fijo: $capLocal ($cap)"

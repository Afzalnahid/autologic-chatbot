# The four stock-voice Reels in one go (owner, 2026-09-29): one short 9:16 cut in
# each Gemini voice he picked (Puck, Fenrir, Sadachbia) and one with all three as
# friends (make_trio.mjs). Safe to re-run: every step skips what already exists
# except render and mix, which always redo.
#   pwsh -File stock_run.ps1
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$py = "..\trailer\.venv311\Scripts\python.exe"
$voices = "Puck", "Fenrir", "Sadachbia"

foreach ($v in $voices) {
  node gemini_tts.mjs lines $v S
  if ($LASTEXITCODE -ne 0) { Write-Output "STOP: $v lines failed (quota or split) — see above"; exit 1 }
  & $py polish_promo.py --voice $v 2>&1 | Select-String -Pattern "^\d\d |Error|Traceback"
}
node make_trio.mjs
foreach ($v in "puck", "fenrir", "sadachbia", "trio") {
  node timeline.mjs $v
  node sfx.mjs S $v
}
foreach ($v in "puck", "fenrir", "sadachbia", "trio") { Remove-Item "out\promo-S-V-$v-picture.mp4" -ErrorAction SilentlyContinue }
for ($a = 0; $a -lt 4; $a++) {
  $todo = "puck", "fenrir", "sadachbia", "trio" | Where-Object { -not (Test-Path "out\promo-S-V-$_-picture.mp4") } | ForEach-Object { "S-V-$_" }
  if (-not $todo) { break }
  node render.mjs @todo 2>&1 | Select-String -Pattern "wrote|failed|Error"
}
foreach ($v in "puck", "fenrir", "sadachbia", "trio") { node mix.mjs S V $v }
Write-Output "ALL DONE"

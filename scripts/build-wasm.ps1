$ErrorActionPreference = 'Stop'

rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown

$source = Join-Path $PSScriptRoot '..\target\wasm32-unknown-unknown\release\elevator_control_core.wasm'
$destination = Join-Path $PSScriptRoot '..\elevator_core.wasm'
Copy-Item -LiteralPath $source -Destination $destination -Force
$publicDirectory = Join-Path $PSScriptRoot '..\public'
New-Item -ItemType Directory -Path $publicDirectory -Force | Out-Null
Copy-Item -LiteralPath $source -Destination (Join-Path $publicDirectory 'elevator_core.wasm') -Force

$size = (Get-Item -LiteralPath $destination).Length
if ($size -gt 4096) {
  throw "Wasm size budget exceeded: $size bytes"
}
Write-Output "Built elevator_core.wasm ($size bytes)"

#!/usr/bin/env sh
set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
cd "$repository_root"
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/elevator_control_core.wasm legacy/elevator_core.wasm
mkdir -p apps/web/public
cp legacy/elevator_core.wasm apps/web/public/elevator_core.wasm

size=$(wc -c < legacy/elevator_core.wasm)
if [ "$size" -gt 4096 ]; then
  echo "Wasm size budget exceeded: $size bytes" >&2
  exit 1
fi
echo "Built elevator_core.wasm ($size bytes)"

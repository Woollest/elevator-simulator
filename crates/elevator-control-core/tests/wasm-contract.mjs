import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const bytes = await readFile(new URL('../../../apps/web/public/elevator_core.wasm', import.meta.url));
const { instance } = await WebAssembly.instantiate(bytes);
const { should_stop: shouldStop, served_call: servedCall } = instance.exports;

assert.equal(typeof shouldStop, 'function', 'should_stop export is required');
assert.equal(typeof servedCall, 'function', 'served_call export is required');

const decisionTable = [
  { direction: 1, up: 0, down: 0, stop: 0 },
  { direction: 1, up: 1, down: 0, stop: 1 },
  { direction: 1, up: 0, down: 1, stop: 0 },
  { direction: 1, up: 1, down: 1, stop: 1 },
  { direction: -1, up: 0, down: 0, stop: 0 },
  { direction: -1, up: 1, down: 0, stop: 0 },
  { direction: -1, up: 0, down: 1, stop: 1 },
  { direction: -1, up: 1, down: 1, stop: 1 }
];

for (const row of decisionTable) {
  assert.equal(shouldStop(row.direction, row.up, row.down), row.stop, JSON.stringify(row));
}
assert.equal(servedCall(1), 1);
assert.equal(servedCall(-1), 2);
assert.ok(bytes.byteLength <= 4096, `Wasm exceeds its 4 KiB budget: ${bytes.byteLength}`);

console.log(`Wasm contract verified across ${decisionTable.length} control states (${bytes.byteLength} bytes).`);

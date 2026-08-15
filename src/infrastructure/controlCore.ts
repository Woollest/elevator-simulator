import type { Calls, Direction } from '../domain/elevator';

type WasmExports = { should_stop(direction: number, up: number, down: number): number };

export function fallbackShouldStop(direction: Direction, calls: Calls): boolean {
  return direction > 0 ? calls.up : calls.down;
}

export class ControlCore {
  #wasm: WasmExports | null = null;

  async initialize(url: URL): Promise<void> {
    try {
      const response = await fetch(url);
      const { instance } = await WebAssembly.instantiateStreaming(response);
      this.#wasm = instance.exports as unknown as WasmExports;
    } catch {
      this.#wasm = null;
    }
  }

  shouldStop(direction: Direction, calls: Calls): boolean {
    return this.#wasm
      ? this.#wasm.should_stop(direction, Number(calls.up), Number(calls.down)) === 1
      : fallbackShouldStop(direction, calls);
  }
}

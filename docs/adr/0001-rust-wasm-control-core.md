# ADR 0001: Use Rust/Wasm for a two-boolean stop decision

- Status: Accepted
- Date: 2026-08-15

## Context

The simulator needs to decide whether a car moving through the hall floor should stop. The complete truth table contains only eight states and would normally require one JavaScript expression.

## Decision

Implement the decision as a `no_std` Rust library, compile it to WebAssembly, enforce a 4 KiB binary budget, test it natively, then test the committed Wasm ABI independently from Node.

## Consequences

- The most trivial business rule in the application crosses a language and runtime boundary.
- The deployed site remains static and requires no server.
- JavaScript retains a behaviorally equivalent fallback when Wasm cannot load.
- Maintenance complexity is wildly disproportionate to the problem, which is an explicit project goal.

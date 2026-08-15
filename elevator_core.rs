#![no_std]

// Collective-control decision core, compiled to WebAssembly.
// direction: 1 = up, -1 = down. Calls are 0/1.
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! { loop {} }

#[no_mangle]
pub extern "C" fn should_stop(direction: i32, call_up: i32, call_down: i32) -> i32 {
    if direction > 0 && call_up != 0 { return 1; }
    if direction < 0 && call_down != 0 { return 1; }
    0
}

#[no_mangle]
pub extern "C" fn served_call(direction: i32) -> i32 {
    if direction > 0 { 1 } else { 2 }
}

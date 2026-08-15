#![cfg_attr(target_arch = "wasm32", no_std)]

// Collective-control decision core, compiled to WebAssembly.
// direction: 1 = up, -1 = down. Calls are 0/1.
#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    loop {}
}

#[unsafe(no_mangle)]
pub extern "C" fn should_stop(direction: i32, call_up: i32, call_down: i32) -> i32 {
    if direction > 0 && call_up != 0 {
        return 1;
    }
    if direction < 0 && call_down != 0 {
        return 1;
    }
    0
}

#[unsafe(no_mangle)]
pub extern "C" fn served_call(direction: i32) -> i32 {
    if direction > 0 { 1 } else { 2 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn up_car_only_serves_up_call() {
        assert_eq!(should_stop(1, 1, 0), 1);
        assert_eq!(should_stop(1, 0, 1), 0);
    }

    #[test]
    fn down_car_only_serves_down_call() {
        assert_eq!(should_stop(-1, 0, 1), 1);
        assert_eq!(should_stop(-1, 1, 0), 0);
    }

    #[test]
    fn both_calls_serve_current_direction() {
        assert_eq!(should_stop(1, 1, 1), 1);
        assert_eq!(should_stop(-1, 1, 1), 1);
        assert_eq!(served_call(1), 1);
        assert_eq!(served_call(-1), 2);
    }
}

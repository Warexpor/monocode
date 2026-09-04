#[cfg(windows)]
use std::sync::atomic::AtomicU8;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri::window::Color;
#[cfg(target_os = "windows")]
use tauri::window::{Effect, EffectsBuilder};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow, WebviewWindowBuilder};

static WINDOW_COUNTER: AtomicU32 = AtomicU32::new(1);
static ALLOW_EXIT: AtomicBool = AtomicBool::new(false);
#[cfg(windows)]
static GLASS_RADIUS: AtomicU8 = AtomicU8::new(GLASS_RADIUS_DEFAULT);

const QUIT_REQUESTED: &str = "quit_requested";

/// Same range as macOS `CGSSetWindowBackgroundBlurRadius` (1–64, default 24).
#[cfg(any(windows, test))]
pub(crate) const GLASS_RADIUS_MIN: u8 = 1;
#[cfg(any(windows, test))]
pub(crate) const GLASS_RADIUS_MAX: u8 = 64;
#[cfg(any(windows, test))]
pub(crate) const GLASS_RADIUS_DEFAULT: u8 = 24;

#[cfg(any(windows, test))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum WindowsGlassKind {
    Acrylic,
    Mica,
    MicaDark,
    Blur,
}

/// DWM has no per-pixel radius. Map the macOS slider onto the closest material:
/// low → Blur, mid → Acrylic, high → Mica.
#[cfg(any(windows, test))]
pub(crate) fn windows_glass_effect_order(radius: u8) -> [WindowsGlassKind; 4] {
    let radius = radius.clamp(GLASS_RADIUS_MIN, GLASS_RADIUS_MAX);
    match radius {
        1..=12 => [
            WindowsGlassKind::Blur,
            WindowsGlassKind::Acrylic,
            WindowsGlassKind::Mica,
            WindowsGlassKind::MicaDark,
        ],
        13..=40 => [
            WindowsGlassKind::Acrylic,
            WindowsGlassKind::Mica,
            WindowsGlassKind::MicaDark,
            WindowsGlassKind::Blur,
        ],
        _ => [
            WindowsGlassKind::Mica,
            WindowsGlassKind::MicaDark,
            WindowsGlassKind::Acrylic,
            WindowsGlassKind::Blur,
        ],
    }
}

pub fn open_new_window(app: &AppHandle) -> Result<(), String> {
    let mut config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .ok_or("missing main window config")?
        .clone();

    let id = WINDOW_COUNTER.fetch_add(1, Ordering::Relaxed);
    config.label = format!("window-{id}");

    let window = WebviewWindowBuilder::from_config(app, &config)
        .map_err(|err| err.to_string())?
        .build()
        .map_err(|err| err.to_string())?;

    #[cfg(target_os = "macos")]
    crate::macos::install(&window);

    #[cfg(not(target_os = "macos"))]
    {
        let _ = window.set_decorations(false);
        let _ = window.set_shadow(true);
    }

    let _ = window.set_focus();
    #[cfg(target_os = "windows")]
    {
        apply_windows_window_icon(&window);
        apply_windows_glass(&window);
    }
    Ok(())
}

/// macOS: glass after the first UI paint (JS splash), not during the dock bounce.
/// Windows: same command still re-applies after paint; DWM is also applied from
/// `Ready` / `open_new_window` so CI does not depend on JS boot finishing.
#[tauri::command]
pub fn enable_window_glass(window: WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        let _ = window.set_background_color(Some(Color(0, 0, 0, 3)));
        crate::macos::enable_glass(&window);
    }
    #[cfg(target_os = "windows")]
    apply_windows_glass(&window);
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = window;
    }
}

/// Acrylic is the closest DWM stand-in for macOS CGS blur, but it is not
/// available on every Windows SKU. Walk the radius-mapped fallbacks so the
/// window is never left fully transparent after `enable_window_glass`.
#[cfg(target_os = "windows")]
pub fn apply_windows_glass(window: &WebviewWindow) {
    let _ = window.set_background_color(Some(Color(0, 0, 0, 0)));
    for kind in windows_glass_effect_order(GLASS_RADIUS.load(Ordering::Relaxed)) {
        let effect = match kind {
            WindowsGlassKind::Acrylic => Effect::Acrylic,
            WindowsGlassKind::Mica => Effect::Mica,
            WindowsGlassKind::MicaDark => Effect::MicaDark,
            WindowsGlassKind::Blur => Effect::Blur,
        };
        if window
            .set_effects(EffectsBuilder::new().effect(effect).build())
            .is_ok()
        {
            record_windows_glass(kind_label(kind));
            return;
        }
    }
    let _ = window.set_background_color(Some(Color(18, 18, 18, 255)));
    record_windows_glass("solid");
}

#[cfg(windows)]
fn kind_label(kind: WindowsGlassKind) -> &'static str {
    match kind {
        WindowsGlassKind::Acrylic => "acrylic",
        WindowsGlassKind::Mica => "mica",
        WindowsGlassKind::MicaDark => "mica-dark",
        WindowsGlassKind::Blur => "blur",
    }
}

/// Sidecar for CI / desktop smoke: which DWM fallback actually stuck.
#[cfg(windows)]
fn record_windows_glass(kind: &str) {
    let path = std::env::temp_dir().join("monocode-windows-glass.txt");
    let _ = std::fs::write(path, kind);
}

/// Undecorated Windows windows often omit the taskbar icon even when the PE
/// embeds one. Re-apply the bundle default onto the HWND.
#[cfg(target_os = "windows")]
pub fn apply_windows_window_icon(window: &WebviewWindow) {
    if let Some(icon) = window.app_handle().default_window_icon() {
        let _ = window.set_icon(icon.clone());
    }
}

/// Apply DWM effects on every live webview. Called from `RunEvent::Ready` so the
/// NSIS smoke sidecar is written even if the boot splash never invokes JS.
#[cfg(target_os = "windows")]
pub fn apply_windows_glass_all(app: &AppHandle) {
    for window in app.webview_windows().into_values() {
        apply_windows_window_icon(&window);
        apply_windows_glass(&window);
    }
}

#[cfg(target_os = "windows")]
pub fn set_windows_glass_radius(window: &WebviewWindow, radius: u8) {
    GLASS_RADIUS.store(
        radius.clamp(GLASS_RADIUS_MIN, GLASS_RADIUS_MAX),
        Ordering::Relaxed,
    );
    apply_windows_glass(window);
}

/// Close with a running chat hides the webview so the harness child keeps going.
#[tauri::command]
pub fn hide_window(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|err| err.to_string())
}

/// Finish an idle close. `destroy` skips CloseRequested so the JS handler
/// does not loop; `close` would fire it again.
#[tauri::command]
pub fn destroy_window(window: WebviewWindow) -> Result<(), String> {
    window.destroy().map_err(|err| err.to_string())
}

/// Dock click / Cmd-click with no visible windows: bring hidden ones back.
pub fn show_hidden_or_open_new(app: &AppHandle) -> Result<(), String> {
    let mut windows: Vec<WebviewWindow> = app.webview_windows().into_values().collect();
    if windows.is_empty() {
        return open_new_window(app);
    }
    windows.sort_by(|a, b| a.label().cmp(b.label()));
    for window in &windows {
        let _ = window.unminimize();
        let _ = window.show();
    }
    windows
        .first()
        .ok_or_else(|| "missing window".to_string())?
        .set_focus()
        .map_err(|err| err.to_string())
}

/// window-state can restore a window as hidden after a quit-while-hidden.
pub fn ensure_launch_window_visible(app: &AppHandle) {
    let windows: Vec<WebviewWindow> = app.webview_windows().into_values().collect();
    if windows.is_empty() {
        return;
    }
    let any_visible = windows
        .iter()
        .any(|window| window.is_visible().unwrap_or(false));
    if any_visible {
        return;
    }
    let _ = show_hidden_or_open_new(app);
}

pub fn allow_exit() -> bool {
    ALLOW_EXIT.load(Ordering::SeqCst)
}

/// Ask the UI to persist in-flight chats, then call `confirm_quit`.
pub fn request_quit(app: &AppHandle) {
    let windows = app.webview_windows();
    let target = windows
        .values()
        .find(|window| window.is_focused().unwrap_or(false))
        .cloned()
        .or_else(|| windows.get("main").cloned())
        .or_else(|| windows.values().next().cloned());
    match target {
        Some(window) => {
            if window.emit(QUIT_REQUESTED, ()).is_err() {
                confirm_quit(app.clone());
            }
        }
        None => confirm_quit(app.clone()),
    }
}

/// Persist already happened in JS. Show windows so window-state doesn't save hidden.
#[tauri::command]
pub fn confirm_quit(app: AppHandle) {
    ALLOW_EXIT.store(true, Ordering::SeqCst);
    for window in app.webview_windows().values() {
        let _ = window.show();
    }
    // Belt and braces. `RunEvent::Exit` reaps too, and it also runs before the
    // process is gone, but a macOS terminate that skips the run loop would not
    // reach it — and `kill_all`'s SIGKILL wait only works while we're alive.
    if let Some(host) = app.try_state::<crate::harness::HarnessHost>() {
        host.kill_all();
    }
    if let Some(host) = app.try_state::<crate::pty::PtyHost>() {
        host.kill_all();
    }
    app.exit(0);
}

#[cfg(test)]
mod glass_order_tests {
    use super::*;

    #[test]
    fn low_radius_prefers_blur() {
        assert_eq!(windows_glass_effect_order(1)[0], WindowsGlassKind::Blur);
        assert_eq!(windows_glass_effect_order(12)[0], WindowsGlassKind::Blur);
    }

    #[test]
    fn default_radius_prefers_acrylic() {
        assert_eq!(
            windows_glass_effect_order(GLASS_RADIUS_DEFAULT)[0],
            WindowsGlassKind::Acrylic
        );
    }

    #[test]
    fn high_radius_prefers_mica() {
        assert_eq!(windows_glass_effect_order(64)[0], WindowsGlassKind::Mica);
    }
}

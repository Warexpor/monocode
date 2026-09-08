use std::fs::File;
use std::io::BufReader;
use std::sync::mpsc::{self, SyncSender};
use std::sync::OnceLock;
use std::time::Duration;

use rodio::{
    source::{SineWave, Source},
    Decoder, OutputStream, OutputStreamHandle, Sink,
};

use crate::fs::expand_home;

enum SoundRequest {
    Play {
        kind: String,
        path: Option<String>,
        volume: f32,
    },
}

static SOUND_TX: OnceLock<SyncSender<SoundRequest>> = OnceLock::new();

fn cue_tone(kind: &str) -> (f32, Duration, f32) {
    match kind {
        "turnFinished" => (880.0, Duration::from_millis(140), 0.22),
        "inboxUnseen" => (660.0, Duration::from_millis(110), 0.18),
        "updateAvailable" => (523.25, Duration::from_millis(160), 0.2),
        "switch" => (440.0, Duration::from_millis(45), 0.12),
        "copy" => (988.0, Duration::from_millis(55), 0.1),
        _ => (720.0, Duration::from_millis(100), 0.16),
    }
}

fn play_tone(handle: &OutputStreamHandle, kind: &str, volume: f32) -> Result<(), String> {
    let (freq, duration, amp) = cue_tone(kind);
    let sink = Sink::try_new(handle).map_err(|e| e.to_string())?;
    let source = SineWave::new(freq)
        .take_duration(duration)
        .amplify(amp * volume.clamp(0.0, 1.0));
    sink.append(source);
    sink.detach();
    Ok(())
}

fn play_file(handle: &OutputStreamHandle, path: &str, volume: f32) -> Result<(), String> {
    let source_path = expand_home(path);
    let file = File::open(&source_path).map_err(|e| crate::fs::path_io(&source_path, &e))?;
    let decoder = Decoder::new(BufReader::new(file)).map_err(|e| e.to_string())?;
    let sink = Sink::try_new(handle).map_err(|e| e.to_string())?;
    sink.set_volume(volume.clamp(0.0, 1.0));
    sink.append(decoder);
    sink.detach();
    Ok(())
}

fn play_on_handle(
    handle: &OutputStreamHandle,
    kind: &str,
    path: Option<&str>,
    volume: f32,
) -> Result<(), String> {
    if let Some(path) = path.filter(|value| !value.is_empty()) {
        play_file(handle, path, volume)
    } else {
        play_tone(handle, kind, volume)
    }
}

fn sound_sender() -> Result<&'static SyncSender<SoundRequest>, String> {
    let tx = SOUND_TX.get_or_init(|| {
        let (tx, rx) = mpsc::sync_channel::<SoundRequest>(8);
        let _ = std::thread::Builder::new()
            .name("monocode-sound".into())
            .spawn(move || {
                let Ok((_stream, handle)) = OutputStream::try_default() else {
                    while rx.recv().is_ok() {}
                    return;
                };
                while let Ok(SoundRequest::Play { kind, path, volume }) = rx.recv() {
                    let _ = play_on_handle(&handle, &kind, path.as_deref(), volume);
                }
            });
        tx
    });
    Ok(tx)
}

/// Play a cue from the host process so Windows/macOS volume mixers list MonoCode.
#[tauri::command]
pub async fn play_app_sound(
    kind: String,
    path: Option<String>,
    volume: Option<f32>,
) -> Result<(), String> {
    let vol = volume.unwrap_or(0.55);
    let tx = sound_sender()?.clone();
    tauri::async_runtime::spawn_blocking(move || {
        tx.send(SoundRequest::Play {
            kind,
            path,
            volume: vol,
        })
        .map_err(|_| "Sound thread stopped".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cue_tone_maps_known_kinds() {
        let (freq, dur, _) = cue_tone("turnFinished");
        assert!(freq > 0.0);
        assert!(dur.as_millis() > 0);
        let (other, _, _) = cue_tone("unknown-cue");
        assert!(other > 0.0);
    }
}

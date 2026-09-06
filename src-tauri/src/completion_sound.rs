use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use crate::fs::expand_home;

const MAX_SOUND_BYTES: u64 = 5 * 1024 * 1024;
const ALLOWED_EXT: [&str; 5] = ["mp3", "wav", "ogg", "m4a", "aac"];
const SOUND_STEM: &str = "completion";

fn completion_sound_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("completion-sound");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn remove_existing_sounds(dir: &Path) -> Result<(), String> {
    let prefix = format!("{SOUND_STEM}.");
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else {
            continue;
        };
        if name == SOUND_STEM || name.starts_with(&prefix) {
            std::fs::remove_file(entry.path()).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn allowed_extension(ext: &str) -> bool {
    ALLOWED_EXT.contains(&ext)
}

fn save_completion_sound_sync(app: &AppHandle, source_path: &str) -> Result<String, String> {
    let source = expand_home(source_path);
    let meta = std::fs::metadata(&source).map_err(|e| crate::fs::path_io(&source, &e))?;
    if !meta.is_file() {
        return Err("Not a file".into());
    }
    if meta.len() > MAX_SOUND_BYTES {
        return Err(format!(
            "Sound is too large (maximum {} MB).",
            MAX_SOUND_BYTES / 1024 / 1024
        ));
    }

    let ext = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !allowed_extension(&ext) {
        return Err("Sound must be an MP3, WAV, OGG, M4A, or AAC file.".into());
    }

    let dir = completion_sound_dir(app)?;
    let dest = dir.join(format!("{SOUND_STEM}.{ext}"));
    let temp = dir.join(format!(".{SOUND_STEM}-upload"));

    std::fs::copy(&source, &temp).map_err(|e| crate::fs::path_io(&temp, &e))?;
    remove_existing_sounds(&dir)?;
    std::fs::rename(&temp, &dest).map_err(|e| crate::fs::path_io(&dest, &e))?;
    Ok(crate::fs::path_to_js(&dest))
}

fn remove_completion_sound_sync(app: &AppHandle) -> Result<(), String> {
    let dir = completion_sound_dir(app)?;
    remove_existing_sounds(&dir)
}

#[tauri::command]
pub async fn save_completion_sound(app: AppHandle, source_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || save_completion_sound_sync(&app, &source_path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn remove_completion_sound(app: AppHandle) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || remove_completion_sound_sync(&app))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allowed_extension_accepts_audio_types() {
        assert!(allowed_extension("mp3"));
        assert!(allowed_extension("wav"));
        assert!(allowed_extension("ogg"));
        assert!(allowed_extension("m4a"));
        assert!(allowed_extension("aac"));
        assert!(!allowed_extension("png"));
        assert!(!allowed_extension("exe"));
    }
}

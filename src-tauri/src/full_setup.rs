//! Interactive Grok Full Setup: install CLIs, wire OpenCodex Zen/Go, Exa MCP.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Manager};

use crate::dirs_home;
use crate::harness::{apply_gui_env, command_for_args, gui_search_path, which_in_path};

const OPENCODEX_PKG: &str = "@bitkyc08/opencodex";
const ZEN_MODELS_URL: &str = "https://opencode.ai/zen/v1/models";
const GO_MODELS_URL: &str = "https://opencode.ai/zen/go/v1/models";
const EXA_MCP_URL: &str = "https://mcp.exa.ai/mcp";
const EXA_BEGIN: &str = "# >>> monocode full-setup exa — do not edit >>>";
const EXA_END: &str = "# <<< monocode full-setup exa <<<";
const HTTP_TIMEOUT: Duration = Duration::from_secs(30);
const CMD_TIMEOUT: Duration = Duration::from_secs(300);

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FullSetupStatus {
    pub supported: bool,
    pub node_ok: bool,
    pub npm_ok: bool,
    pub node_version: Option<String>,
    pub npm_version: Option<String>,
    pub grok_ok: bool,
    pub grok_version: Option<String>,
    pub grok_path: Option<String>,
    pub ocx_ok: bool,
    pub ocx_version: Option<String>,
    pub ocx_path: Option<String>,
    pub ocx_healthy: bool,
    pub key_present: bool,
    pub exa_mcp_present: bool,
    pub hint: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FullSetupCatalogModel {
    pub id: String,
    pub name: String,
    pub free: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FullSetupCatalogs {
    pub zen_free: Vec<FullSetupCatalogModel>,
    pub go: Vec<FullSetupCatalogModel>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FullSetupApplyResult {
    pub log: Vec<String>,
    pub ocx_model_count: u32,
    pub exa_mcp_present: bool,
    pub ocx_healthy: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullSetupApplyArgs {
    pub go_model_ids: Vec<String>,
    pub enable_exa: bool,
}

#[tauri::command]
pub async fn full_setup_status(app: AppHandle) -> Result<FullSetupStatus, String> {
    tauri::async_runtime::spawn_blocking(move || status_sync(&app))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn full_setup_install_grok() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(install_grok_sync)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn full_setup_install_opencodex() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(install_opencodex_sync)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn full_setup_set_key(app: AppHandle, key: String) -> Result<FullSetupStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let trimmed = key.trim().to_string();
        if trimmed.is_empty() {
            delete_key(&app)?;
            return status_sync(&app);
        }
        validate_opencode_key(&trimmed)?;
        write_key(&app, &trimmed)?;
        status_sync(&app)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn full_setup_fetch_catalogs(app: AppHandle) -> Result<FullSetupCatalogs, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let key = require_key(&app)?;
        fetch_catalogs(&key)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn full_setup_apply(
    app: AppHandle,
    args: FullSetupApplyArgs,
) -> Result<FullSetupApplyResult, String> {
    tauri::async_runtime::spawn_blocking(move || apply_sync(&app, args))
        .await
        .map_err(|e| e.to_string())?
}

fn status_sync(app: &AppHandle) -> Result<FullSetupStatus, String> {
    let supported = cfg!(windows);
    let node = probe_version("node", &["--version"]);
    let npm = probe_version("npm", &["--version"]);
    let grok_path = which_in_path(&gui_search_path(), "grok");
    let grok = grok_path
        .as_ref()
        .and_then(|p| probe_version_at(p, &["--version"]));
    let ocx_path = which_in_path(&gui_search_path(), "ocx");
    let ocx = ocx_path
        .as_ref()
        .and_then(|p| probe_version_at(p, &["--version"]));
    let mut log = Vec::new();
    let ocx_healthy = ocx_path.is_some() && probe_ocx_health(&mut log);
    let hint = if !supported {
        Some("Full Setup is Windows-only in this build.".into())
    } else if node.is_none() || npm.is_none() {
        Some("Install Node.js LTS (includes npm), then retry.".into())
    } else {
        None
    };
    Ok(FullSetupStatus {
        supported,
        node_ok: node.is_some(),
        npm_ok: npm.is_some(),
        node_version: node,
        npm_version: npm,
        grok_ok: grok_path.is_some(),
        grok_version: grok,
        grok_path: grok_path.map(|p| p.display().to_string()),
        ocx_ok: ocx_path.is_some(),
        ocx_version: ocx,
        ocx_path: ocx_path.map(|p| p.display().to_string()),
        ocx_healthy,
        key_present: read_key(app)?.is_some(),
        exa_mcp_present: grok_config_has_exa(),
        hint,
    })
}

fn install_grok_sync() -> Result<String, String> {
    #[cfg(windows)]
    {
        let script = "irm https://x.ai/cli/install.ps1 | iex";
        let output = run_capture(
            "powershell",
            &[
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                script,
            ],
            None,
            CMD_TIMEOUT,
        )?;
        require_success("Grok install", &output)?;
        Ok(format_output("Grok install", &output))
    }
    #[cfg(not(windows))]
    {
        let output = run_capture(
            "bash",
            &["-lc", "curl -fsSL https://x.ai/cli/install.sh | bash"],
            None,
            CMD_TIMEOUT,
        )?;
        require_success("Grok install", &output)?;
        Ok(format_output("Grok install", &output))
    }
}

fn install_opencodex_sync() -> Result<String, String> {
    let npm = which_in_path(&gui_search_path(), "npm")
        .ok_or_else(|| "npm not found. Install Node.js LTS first.".to_string())?;
    let output = run_capture_at(&npm, &["install", "-g", OPENCODEX_PKG], None, CMD_TIMEOUT)?;
    require_success("OpenCodex install", &output)?;
    Ok(format_output("OpenCodex install", &output))
}

fn apply_sync(app: &AppHandle, args: FullSetupApplyArgs) -> Result<FullSetupApplyResult, String> {
    if !cfg!(windows) {
        return Err("Full Setup apply is Windows-only.".into());
    }

    let mut log = Vec::new();
    let key = require_key(app)?;
    log.push("OpenCode API key loaded.".into());

    let catalogs = fetch_catalogs(&key)?;
    let zen_ids: Vec<String> = catalogs.zen_free.iter().map(|m| m.id.clone()).collect();
    if zen_ids.is_empty() {
        log.push("Warning: no Zen free models discovered; writing empty Zen allowlist.".into());
    } else {
        log.push(format!("Zen free models: {}", zen_ids.join(", ")));
    }

    let go_ids: Vec<String> = args
        .go_model_ids
        .into_iter()
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty())
        .collect();
    log.push(if go_ids.is_empty() {
        "Go models: none selected.".into()
    } else {
        format!("Go models: {}", go_ids.join(", "))
    });

    write_opencodex_providers(&zen_ids, &go_ids, &mut log)?;

    if args.enable_exa {
        write_exa_mcp(&mut log)?;
    } else {
        remove_exa_mcp(&mut log)?;
    }

    ensure_grok_home(&mut log);
    ensure_ocx_running(app, &mut log)?;

    let ocx_healthy = probe_ocx_health(&mut log);
    let ocx_model_count = count_ocx_models(&mut log);
    let exa_mcp_present = grok_config_has_exa();

    Ok(FullSetupApplyResult {
        log,
        ocx_model_count,
        exa_mcp_present,
        ocx_healthy,
    })
}

fn write_opencodex_providers(
    zen_ids: &[String],
    go_ids: &[String],
    log: &mut Vec<String>,
) -> Result<(), String> {
    let path = opencodex_config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut root = read_json_object(&path);
    let providers = root
        .entry("providers".to_string())
        .or_insert_with(|| json!({}))
        .as_object_mut()
        .ok_or_else(|| "opencodex config providers must be an object".to_string())?;

    providers.insert(
        "opencode-zen".into(),
        provider_block("https://opencode.ai/zen/v1", zen_ids, "OpenCode Zen (free)"),
    );
    if go_ids.is_empty() {
        providers.remove("opencode-go");
    } else {
        providers.insert(
            "opencode-go".into(),
            provider_block("https://opencode.ai/zen/go/v1", go_ids, "OpenCode Go"),
        );
    }

    let pretty = serde_json::to_string_pretty(&root).map_err(|e| e.to_string())?;
    atomic_write(&path, pretty.as_bytes())?;
    log.push(format!("Wrote {}", path.display()));
    Ok(())
}

fn provider_block(base_url: &str, model_ids: &[String], name: &str) -> Value {
    let mut models = Map::new();
    for id in model_ids {
        models.insert(id.clone(), json!({ "name": id }));
    }
    json!({
        "adapter": "openai-chat",
        "baseUrl": base_url,
        "authMode": "key",
        "apiKey": "${OPENCODE_API_KEY}",
        "name": name,
        "models": models,
    })
}

fn write_exa_mcp(log: &mut Vec<String>) -> Result<(), String> {
    let path = grok_config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let existing = fs::read_to_string(&path).unwrap_or_default();
    let block = format!(
        "{EXA_BEGIN}\n[mcp_servers.exa]\nurl = \"{EXA_MCP_URL}\"\nenabled = true\n{EXA_END}\n"
    );
    let next = upsert_fenced_block(&existing, EXA_BEGIN, EXA_END, &block);
    atomic_write(&path, next.as_bytes())?;
    log.push(format!("Enabled Exa MCP in {}", path.display()));
    Ok(())
}

fn remove_exa_mcp(log: &mut Vec<String>) -> Result<(), String> {
    let path = grok_config_path()?;
    if !path.is_file() {
        log.push("No Grok config yet; skipped Exa removal.".into());
        return Ok(());
    }
    let existing = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let next = remove_fenced_block(&existing, EXA_BEGIN, EXA_END);
    if next != existing {
        atomic_write(&path, next.as_bytes())?;
        log.push("Removed MonoCode Exa MCP block.".into());
    } else {
        log.push("Exa MCP not enabled (left unchanged).".into());
    }
    Ok(())
}

fn ensure_grok_home(log: &mut Vec<String>) {
    if let Some(home) = dirs_home() {
        let grok = PathBuf::from(home).join(".grok");
        if let Err(e) = fs::create_dir_all(&grok) {
            log.push(format!("Could not create {}: {e}", grok.display()));
        } else {
            let cfg = grok.join("config.toml");
            if !cfg.is_file() {
                let _ = fs::write(&cfg, "# MonoCode Full Setup\n");
            }
            log.push(format!("Ensured {}", grok.display()));
        }
    }
}

fn ensure_ocx_running(app: &AppHandle, log: &mut Vec<String>) -> Result<(), String> {
    let ocx = which_in_path(&gui_search_path(), "ocx")
        .ok_or_else(|| "ocx not found after install. Restart MonoCode and retry.".to_string())?;

    let key = read_key(app)?;
    // Prefer service ensure; fall back to start --detach style if needed.
    match run_ocx(&ocx, &["ensure"], key.as_deref(), Duration::from_secs(60)) {
        Ok(out) => log.push(format_output("ocx ensure", &out)),
        Err(err) => {
            log.push(format!("ocx ensure failed ({err}); trying ocx start…"));
            let out = run_ocx(
                &ocx,
                &["start", "--port", "10100"],
                key.as_deref(),
                Duration::from_secs(20),
            );
            match out {
                Ok(text) => log.push(format_output("ocx start", &text)),
                Err(start_err) => {
                    // start may block; if health is up, treat as ok
                    if probe_ocx_health(log) {
                        log.push(format!(
                            "ocx start returned error but proxy is healthy: {start_err}"
                        ));
                    } else {
                        return Err(format!(
                            "Could not start OpenCodex. ensure: {err}; start: {start_err}"
                        ));
                    }
                }
            }
        }
    }

    match run_ocx(
        &ocx,
        &["grok", "apply"],
        key.as_deref(),
        Duration::from_secs(45),
    ) {
        Ok(out) => log.push(format_output("ocx grok apply", &out)),
        Err(err) => log.push(format!(
            "ocx grok apply skipped/failed ({err}). Auto-registration may still run on ensure."
        )),
    }

    Ok(())
}

fn run_ocx(
    ocx: &Path,
    args: &[&str],
    key: Option<&str>,
    timeout: Duration,
) -> Result<Captured, String> {
    let mut cmd = command_for_args(ocx, args);
    apply_gui_env(&mut cmd);
    if let Some(k) = key {
        cmd.env("OPENCODE_API_KEY", k);
    }
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    wait_capture(cmd, timeout)
}

fn probe_ocx_health(log: &mut Vec<String>) -> bool {
    match http_get_text("http://127.0.0.1:10100/api/models", None) {
        Ok(body) if !body.trim().is_empty() => {
            log.push("OpenCodex healthy on http://127.0.0.1:10100".into());
            true
        }
        Ok(_) => {
            log.push("OpenCodex responded empty on /api/models".into());
            false
        }
        Err(err) => {
            // Fallback: root or /v1/models
            if http_get_text("http://127.0.0.1:10100/v1/models", None).is_ok() {
                log.push("OpenCodex healthy via /v1/models".into());
                true
            } else {
                log.push(format!("OpenCodex not reachable: {err}"));
                false
            }
        }
    }
}

fn count_ocx_models(log: &mut Vec<String>) -> u32 {
    let grok = match which_in_path(&gui_search_path(), "grok") {
        Some(p) => p,
        None => {
            log.push("grok binary missing; cannot list ocx models yet.".into());
            return 0;
        }
    };
    match run_capture_at(&grok, &["models"], None, Duration::from_secs(20)) {
        Ok(out) => {
            let text = format!("{}{}", out.stdout, out.stderr);
            let count = text
                .lines()
                .filter(|line| {
                    let lower = line.to_lowercase();
                    lower.contains("ocx-") || lower.contains("opencodex")
                })
                .count() as u32;
            log.push(format!(
                "Detected ~{count} OpenCodex-related grok model lines"
            ));
            count
        }
        Err(err) => {
            log.push(format!("grok models failed: {err}"));
            0
        }
    }
}

fn fetch_catalogs(key: &str) -> Result<FullSetupCatalogs, String> {
    let zen_raw = http_get_text(ZEN_MODELS_URL, Some(key))?;
    let go_raw = http_get_text(GO_MODELS_URL, Some(key)).unwrap_or_else(|_| {
        // Some accounts only expose Go via a different path; empty is ok.
        "{\"data\":[]}".into()
    });
    let zen_all = parse_model_list(&zen_raw)?;
    let go_all = parse_model_list(&go_raw)?;
    let zen_free: Vec<_> = zen_all
        .into_iter()
        .filter(|m| is_zen_free(&m.id))
        .map(|m| FullSetupCatalogModel {
            free: true,
            id: m.id,
            name: m.name,
        })
        .collect();
    let go: Vec<_> = go_all
        .into_iter()
        .map(|m| FullSetupCatalogModel {
            free: false,
            id: m.id,
            name: m.name,
        })
        .collect();
    Ok(FullSetupCatalogs { zen_free, go })
}

fn is_zen_free(id: &str) -> bool {
    let lower = id.to_ascii_lowercase();
    lower.ends_with("-free") || lower == "big-pickle" || lower.ends_with("/big-pickle")
}

struct NamedModel {
    id: String,
    name: String,
}

fn parse_model_list(body: &str) -> Result<Vec<NamedModel>, String> {
    let value: Value = serde_json::from_str(body).map_err(|e| format!("models JSON: {e}"))?;
    let rows = value
        .get("data")
        .and_then(|v| v.as_array())
        .or_else(|| value.as_array())
        .ok_or_else(|| "models response missing data array".to_string())?;
    let mut out = Vec::new();
    for row in rows {
        let id = row
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if id.is_empty() {
            continue;
        }
        let name = row
            .get("name")
            .or_else(|| row.get("display_name"))
            .and_then(|v| v.as_str())
            .unwrap_or(&id)
            .trim()
            .to_string();
        out.push(NamedModel { id, name });
    }
    out.sort_by_key(|a| a.name.to_lowercase());
    out.dedup_by(|a, b| a.id == b.id);
    Ok(out)
}

fn validate_opencode_key(key: &str) -> Result<(), String> {
    let body = http_get_text(ZEN_MODELS_URL, Some(key))?;
    let _ = parse_model_list(&body)?;
    Ok(())
}

fn http_get_text(url: &str, bearer: Option<&str>) -> Result<String, String> {
    let mut req = ureq::get(url).timeout(HTTP_TIMEOUT);
    if let Some(token) = bearer {
        req = req.set("Authorization", &format!("Bearer {token}"));
    }
    let resp = req.call().map_err(|e| format!("GET {url}: {e}"))?;
    if !(200..300).contains(&resp.status()) {
        return Err(format!("GET {url}: HTTP {}", resp.status()));
    }
    resp.into_string()
        .map_err(|e| format!("GET {url} body: {e}"))
}

fn key_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("opencode-api-key"))
}

fn read_key(app: &AppHandle) -> Result<Option<String>, String> {
    let path = key_path(app)?;
    match fs::read_to_string(&path) {
        Ok(raw) => {
            let key = raw.trim().to_string();
            Ok(if key.is_empty() { None } else { Some(key) })
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn require_key(app: &AppHandle) -> Result<String, String> {
    read_key(app)?.ok_or_else(|| "Save an OpenCode API key first.".to_string())
}

fn write_key(app: &AppHandle, key: &str) -> Result<(), String> {
    let path = key_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    write_secret_file(&path, key)
}

fn delete_key(app: &AppHandle) -> Result<(), String> {
    let path = key_path(app)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

fn write_secret_file(path: &Path, token: &str) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .map_err(|e| e.to_string())?;
        file.write_all(token.as_bytes())
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(windows)]
    {
        fs::write(path, token).map_err(|e| e.to_string())?;
        crate::windows_secret::restrict_owner_acl(path)
    }
    #[cfg(not(any(unix, windows)))]
    {
        fs::write(path, token).map_err(|e| e.to_string())
    }
}

fn opencodex_config_path() -> Result<PathBuf, String> {
    let home = dirs_home().ok_or_else(|| "HOME/USERPROFILE not set".to_string())?;
    Ok(PathBuf::from(home).join(".opencodex").join("config.json"))
}

fn grok_config_path() -> Result<PathBuf, String> {
    let home = dirs_home().ok_or_else(|| "HOME/USERPROFILE not set".to_string())?;
    Ok(PathBuf::from(home).join(".grok").join("config.toml"))
}

fn grok_config_has_exa() -> bool {
    let Ok(path) = grok_config_path() else {
        return false;
    };
    let Ok(text) = fs::read_to_string(path) else {
        return false;
    };
    text.contains(EXA_BEGIN) || text.contains("mcp_servers.exa")
}

fn read_json_object(path: &Path) -> Map<String, Value> {
    match fs::read_to_string(path) {
        Ok(raw) => serde_json::from_str::<Value>(&raw)
            .ok()
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default(),
        Err(_) => Map::new(),
    }
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp-monocode");
    {
        let mut file = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        file.write_all(bytes).map_err(|e| e.to_string())?;
        file.sync_all().ok();
    }
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

pub(crate) fn upsert_fenced_block(existing: &str, begin: &str, end: &str, block: &str) -> String {
    let cleaned = remove_fenced_block(existing, begin, end);
    let trimmed = cleaned.trim_end();
    if trimmed.is_empty() {
        block.to_string()
    } else {
        format!("{trimmed}\n\n{block}")
    }
}

pub(crate) fn remove_fenced_block(existing: &str, begin: &str, end: &str) -> String {
    let Some(start) = existing.find(begin) else {
        return existing.to_string();
    };
    let after_begin = start + begin.len();
    let Some(rel_end) = existing[after_begin..].find(end) else {
        // Damaged fence — leave file alone.
        return existing.to_string();
    };
    let end_idx = after_begin + rel_end + end.len();
    let mut out = String::new();
    out.push_str(existing[..start].trim_end());
    let rest = existing[end_idx..].trim_start();
    if !out.is_empty() && !rest.is_empty() {
        out.push('\n');
        out.push('\n');
    }
    out.push_str(rest);
    out
}

struct Captured {
    stdout: String,
    stderr: String,
    status: i32,
}

fn probe_version(name: &str, args: &[&str]) -> Option<String> {
    let path = which_in_path(&gui_search_path(), name)?;
    probe_version_at(&path, args)
}

fn probe_version_at(path: &Path, args: &[&str]) -> Option<String> {
    let out = run_capture_at(path, args, None, Duration::from_secs(8)).ok()?;
    let text = format!("{}{}", out.stdout, out.stderr);
    let line = text.lines().next()?.trim();
    if line.is_empty() {
        None
    } else {
        Some(line.to_string())
    }
}

fn run_capture(
    program: &str,
    args: &[&str],
    cwd: Option<&str>,
    timeout: Duration,
) -> Result<Captured, String> {
    let mut cmd = command_for_args(program, args);
    apply_gui_env(&mut cmd);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    wait_capture(cmd, timeout)
}

fn run_capture_at(
    program: &Path,
    args: &[&str],
    cwd: Option<&str>,
    timeout: Duration,
) -> Result<Captured, String> {
    let mut cmd = command_for_args(program, args);
    apply_gui_env(&mut cmd);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    wait_capture(cmd, timeout)
}

fn wait_capture(mut cmd: Command, timeout: Duration) -> Result<Captured, String> {
    let child = cmd.spawn().map_err(|e| format!("Failed to spawn: {e}"))?;
    let pid = child.id();
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(child.wait_with_output());
    });
    match rx.recv_timeout(timeout) {
        Ok(Ok(output)) => Ok(Captured {
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            status: output.status.code().unwrap_or(-1),
        }),
        Ok(Err(e)) => Err(e.to_string()),
        Err(_) => {
            kill_timed_out_process(pid);
            let _ = rx.recv_timeout(Duration::from_secs(5));
            Err(format!("Command timed out after {}s", timeout.as_secs()))
        }
    }
}

fn kill_timed_out_process(pid: u32) {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("taskkill");
        crate::hide_window_console(&mut cmd);
        let _ = cmd
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(unix)]
    {
        unsafe {
            libc::kill(pid as i32, libc::SIGKILL);
        }
    }
    #[cfg(not(any(windows, unix)))]
    {
        let _ = pid;
    }
}

fn format_output(label: &str, out: &Captured) -> String {
    let mut parts = vec![format!("{label} (exit {})", out.status)];
    let stdout = out.stdout.trim();
    let stderr = out.stderr.trim();
    if !stdout.is_empty() {
        parts.push(stdout.to_string());
    }
    if !stderr.is_empty() {
        parts.push(stderr.to_string());
    }
    parts.join("\n")
}

fn require_success(label: &str, out: &Captured) -> Result<(), String> {
    if out.status == 0 {
        return Ok(());
    }
    Err(format_output(label, out))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upsert_replaces_existing_fence() {
        let existing = "keep\n\n# >>> monocode full-setup exa — do not edit >>>\nold\n# <<< monocode full-setup exa <<<\n\nafter\n";
        let block = "# >>> monocode full-setup exa — do not edit >>>\nnew\n# <<< monocode full-setup exa <<<\n";
        let next = upsert_fenced_block(existing, EXA_BEGIN, EXA_END, block);
        assert!(next.contains("keep"));
        assert!(next.contains("after"));
        assert!(next.contains("new"));
        assert!(!next.contains("old"));
        assert_eq!(next.matches(EXA_BEGIN).count(), 1);
    }

    #[test]
    fn zen_free_filter() {
        assert!(is_zen_free("mimo-v2.5-free"));
        assert!(is_zen_free("big-pickle"));
        assert!(!is_zen_free("gpt-5.5"));
    }

    #[test]
    fn parse_models_openai_shape() {
        let body = r#"{"data":[{"id":"a-free","name":"A"},{"id":"b"}]}"#;
        let models = parse_model_list(body).unwrap();
        assert_eq!(models.len(), 2);
        assert_eq!(models[0].id, "a-free");
    }
}

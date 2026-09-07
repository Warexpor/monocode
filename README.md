
<p align="center">
  <img src="public/monocode.png" alt="MonoCode" width="88" />
</p>

<h1 align="center">MonoCode</h1>

<p align="center">
  <strong>A desktop UI for your coding agents.</strong>
</p>

<p align="center">
  <img width="1680" height="1050" alt="Screenshot 2026-09-04 at 06 34 00" src="https://github.com/user-attachments/assets/2cd4a6ec-eb1e-4b45-8627-a76442ea3874" />
</p>

This repository is **[Warexpor/monocode](https://github.com/Warexpor/monocode)**, a fork of [hardbeat920/monocode](https://github.com/hardbeat920/monocode).

Works with your subscriptions on Claude Code, Codex, Cursor, Grok Build, OpenCode, Pi, omp, and fx. If they’re installed and logged in, MonoCode can run them. Tabs are sessions. The composer is the input. MonoCode does not sell tokens.

## Install

> Install and log in to at least one provider first:
>
> - [Claude Code](https://claude.com/product/claude-code) - `claude auth login`
> - [Codex](https://developers.openai.com/codex/cli) - `codex login`
> - [Cursor CLI](https://cursor.com/cli) - `agent login`
> - [Grok Build](https://docs.x.ai/build/overview) - `curl -fsSL https://x.ai/cli/install.sh | bash` then `grok login`
> - [OpenCode](https://opencode.ai) - `opencode auth login`
> - [Pi](https://pi.dev/) - `npm install -g @earendil-works/pi-coding-agent`
> - [omp](https://omp.sh) - `curl -fsSL https://omp.sh/install | sh`
> - [fx](https://fx.sh) - `curl -fsSL https://fx.sh/setup.sh | bash` then `fx login`

Prebuilt binaries for this fork are published on [GitHub Releases](https://github.com/Warexpor/monocode/releases/latest) (Windows x86_64 NSIS only). This fork does not ship macOS or Linux builds.

Windows (x86_64): download the NSIS installer and run it.

## Some notes

This is very early and you should expect bugs.

Small, focused pull requests are welcome. Anything large is worth an issue first - see [CONTRIBUTING.md](CONTRIBUTING.md).

Fork remotes, sync, and the Warexpor updater channel: [UPSTREAM.md](UPSTREAM.md). Windows parity notes: [WINDOWS-PARITY.md](WINDOWS-PARITY.md). Product overlay (`src/custom/`, including Windows Grok Full Setup): [CUSTOM.md](CUSTOM.md).

## Build from source

This fork is **Windows-only**. Non-Windows targets fail at compile time.

Need Node.js 20+, a current stable Rust toolchain (MSVC on Windows), and the [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) runtime (the installer bootstraps it when missing).

```bash
git clone https://github.com/Warexpor/monocode.git
cd monocode
npm install
npm run tauri dev
```

### Windows packages

```bash
npm ci
npm run build:windows
```

The Windows build emits an NSIS installer under `target/release/bundle/nsis/`.
Tauri loads `src-tauri/tauri.windows.conf.json` automatically for Windows development and builds.

## License

[MIT](LICENSE). Provider names and logos are trademarks of their owners - see [NOTICE](NOTICE).

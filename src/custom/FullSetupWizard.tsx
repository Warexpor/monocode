import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Modal } from "../chrome/Modal";
import { probeHarnessAvailability } from "../lib/harness/availability";
import { refreshHarnessCatalogs } from "../lib/harness/registry";
import { savePickerProviderVisible } from "../lib/models";
import {
  fullSetupApply,
  fullSetupFetchCatalogs,
  fullSetupInstallGrok,
  fullSetupInstallOpenCodex,
  fullSetupSetKey,
  fullSetupStatus,
  isFullSetupSupported,
  recoveryHint,
  saveFullSetupComplete,
  type FullSetupCatalogModel,
  type FullSetupStatus,
} from "./fullSetup";

type Step =
  | "prereq"
  | "grok"
  | "ocx"
  | "key"
  | "models"
  | "websearch"
  | "apply"
  | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "prereq", label: "Prerequisites" },
  { id: "grok", label: "Grok CLI" },
  { id: "ocx", label: "OpenCodex" },
  { id: "key", label: "API key" },
  { id: "models", label: "Models" },
  { id: "websearch", label: "Web search" },
  { id: "apply", label: "Apply" },
  { id: "done", label: "Done" },
];

type Props = {
  onClose: () => void;
};

export function FullSetupWizard({ onClose }: Props) {
  const supported = isFullSetupSupported();
  const [step, setStep] = useState<Step>(supported ? "prereq" : "done");
  const [status, setStatus] = useState<FullSetupStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [zenFree, setZenFree] = useState<FullSetupCatalogModel[]>([]);
  const [goModels, setGoModels] = useState<FullSetupCatalogModel[]>([]);
  const [goSelected, setGoSelected] = useState<Set<string>>(new Set());
  const [enableExa, setEnableExa] = useState(true);
  const [ocxCount, setOcxCount] = useState(0);
  const [exaOk, setExaOk] = useState(false);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev, line]);
  }, []);

  const refreshStatus = useCallback(async () => {
    const next = await fullSetupStatus();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    if (!supported) return;
    void refreshStatus().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [supported, refreshStatus]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const run = async (label: Step, work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      appendLog(msg);
      appendLog(recoveryHint(label, msg));
    } finally {
      setBusy(false);
    }
  };

  const onCheckPrereq = () =>
    void run("prereq", async () => {
      const next = await refreshStatus();
      if (!next.nodeOk || !next.npmOk) {
        throw new Error(
          next.hint ?? "Node.js / npm not found. Install Node LTS and retry.",
        );
      }
      appendLog(
        `Node ${next.nodeVersion ?? "?"} · npm ${next.npmVersion ?? "?"}`,
      );
      setStep("grok");
    });

  const onInstallGrok = (force: boolean) =>
    void run("grok", async () => {
      const before = await refreshStatus();
      if (before.grokOk && !force) {
        appendLog(`Grok already present: ${before.grokVersion ?? before.grokPath}`);
        setStep("ocx");
        return;
      }
      appendLog("Installing / updating Grok Build CLI…");
      const out = await fullSetupInstallGrok();
      appendLog(out);
      const after = await refreshStatus();
      if (!after.grokOk) {
        throw new Error(
          "Grok install finished but the binary was not found. Restart MonoCode and retry.",
        );
      }
      appendLog(`Grok ready: ${after.grokVersion ?? after.grokPath}`);
      setStep("ocx");
    });

  const onInstallOcx = (force: boolean) =>
    void run("ocx", async () => {
      const before = await refreshStatus();
      if (before.ocxOk && !force) {
        appendLog(`OpenCodex already present: ${before.ocxVersion ?? before.ocxPath}`);
        setStep("key");
        return;
      }
      appendLog("Installing / updating @bitkyc08/opencodex…");
      const out = await fullSetupInstallOpenCodex();
      appendLog(out);
      const after = await refreshStatus();
      if (!after.ocxOk) {
        throw new Error(
          "OpenCodex install finished but ocx was not found. Check npm global bin on PATH.",
        );
      }
      appendLog(`ocx ready: ${after.ocxVersion ?? after.ocxPath}`);
      setStep("key");
    });

  const onSaveKey = () =>
    void run("key", async () => {
      if (!key.trim() && !status?.keyPresent) {
        throw new Error("Paste your OpenCode API key (Zen and Go share it).");
      }
      if (key.trim()) {
        appendLog("Validating OpenCode API key…");
        await fullSetupSetKey(key.trim());
        setKey("");
      }
      await refreshStatus();
      appendLog("Fetching Zen / Go model catalogs…");
      const catalogs = await fullSetupFetchCatalogs();
      setZenFree(catalogs.zenFree);
      setGoModels(catalogs.go);
      setGoSelected(new Set(catalogs.go.map((m) => m.id)));
      appendLog(
        `Zen free: ${catalogs.zenFree.length} · Go: ${catalogs.go.length}`,
      );
      setStep("models");
    });

  const onModelsNext = () => setStep("websearch");

  const onWebsearchNext = () => setStep("apply");

  const onApply = () =>
    void run("apply", async () => {
      appendLog("Writing OpenCodex providers, Exa MCP, and starting ocx…");
      const result = await fullSetupApply({
        goModelIds: [...goSelected],
        enableExa,
      });
      for (const line of result.log) appendLog(line);
      setOcxCount(result.ocxModelCount);
      setExaOk(result.exaMcpPresent);
      if (!result.ocxHealthy) {
        throw new Error(
          "OpenCodex did not become healthy on 127.0.0.1:10100. See log.",
        );
      }
      savePickerProviderVisible("grok", true);
      await probeHarnessAvailability({ force: true });
      await refreshHarnessCatalogs(["grok"]);
      saveFullSetupComplete(true);
      await refreshStatus();
      setStep("done");
    });

  const toggleGo = (id: string) => {
    setGoSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const unsupportedBody = useMemo(
    () => (
      <p className="text-[13px] leading-relaxed text-content/60">
        Full Setup is Windows-only in this build. On other platforms, install
        Grok and OpenCodex manually, then add Exa MCP to{" "}
        <code className="text-content/80">~/.grok/config.toml</code>.
      </p>
    ),
    [],
  );

  return (
    <Modal
      onClose={onClose}
      title="Grok Full Setup"
      description="Install Grok + OpenCodex, wire Zen free / Go models, and enable Exa web search."
      size="lg"
      className="h-[min(82vh,720px)]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5 pt-2">
        {supported ? (
          <ol className="flex flex-wrap gap-1.5">
            {STEPS.map((item, index) => {
              const active = item.id === step;
              const done = index < stepIndex;
              return (
                <li
                  key={item.id}
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    active
                      ? "bg-content/15 text-content"
                      : done
                        ? "bg-content/8 text-content/55"
                        : "bg-content/5 text-content/35"
                  }`}
                >
                  {item.label}
                </li>
              );
            })}
          </ol>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {!supported ? (
            unsupportedBody
          ) : step === "prereq" ? (
            <StepBlock
              title="Prerequisites"
              body="Full Setup needs Node.js and npm so it can install OpenCodex."
            >
              <StatusLine
                ok={status?.nodeOk}
                label={`Node ${status?.nodeVersion ?? "—"}`}
              />
              <StatusLine
                ok={status?.npmOk}
                label={`npm ${status?.npmVersion ?? "—"}`}
              />
              {status?.hint ? (
                <p className="text-[12px] text-content/50">{status.hint}</p>
              ) : null}
              <Actions>
                <PrimaryButton disabled={busy} onClick={onCheckPrereq}>
                  {busy ? "Checking…" : "Continue"}
                </PrimaryButton>
              </Actions>
            </StepBlock>
          ) : null}

          {supported && step === "grok" ? (
            <StepBlock
              title="Grok Build CLI"
              body="Install or update the official Grok Build CLI (Windows PowerShell installer)."
            >
              <StatusLine
                ok={status?.grokOk}
                label={
                  status?.grokOk
                    ? `Found ${status.grokVersion ?? status.grokPath}`
                    : "Not found"
                }
              />
              <Actions>
                <PrimaryButton
                  disabled={busy}
                  onClick={() => onInstallGrok(false)}
                >
                  {busy
                    ? "Working…"
                    : status?.grokOk
                      ? "Use existing"
                      : "Install Grok"}
                </PrimaryButton>
                {status?.grokOk ? (
                  <GhostButton
                    disabled={busy}
                    onClick={() => onInstallGrok(true)}
                  >
                    Update
                  </GhostButton>
                ) : null}
              </Actions>
            </StepBlock>
          ) : null}

          {supported && step === "ocx" ? (
            <StepBlock
              title="OpenCodex"
              body="Install the OpenCodex proxy (`ocx`). It registers Go / Zen models into Grok."
            >
              <StatusLine
                ok={status?.ocxOk}
                label={
                  status?.ocxOk
                    ? `Found ${status.ocxVersion ?? status.ocxPath}`
                    : "Not found"
                }
              />
              <Actions>
                <PrimaryButton
                  disabled={busy}
                  onClick={() => onInstallOcx(false)}
                >
                  {busy
                    ? "Working…"
                    : status?.ocxOk
                      ? "Use existing"
                      : "Install OpenCodex"}
                </PrimaryButton>
                {status?.ocxOk ? (
                  <GhostButton
                    disabled={busy}
                    onClick={() => onInstallOcx(true)}
                  >
                    Update
                  </GhostButton>
                ) : null}
              </Actions>
            </StepBlock>
          ) : null}

          {supported && step === "key" ? (
            <StepBlock
              title="OpenCode API key"
              body="Zen and Go share one key (different endpoints). Get it from opencode.ai/auth."
            >
              <StatusLine
                ok={status?.keyPresent}
                label={
                  status?.keyPresent
                    ? "A key is already saved in MonoCode"
                    : "No key saved yet"
                }
              />
              <label className="block text-[12px] text-content/55">
                API key
                <input
                  type="password"
                  autoComplete="off"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder={
                    status?.keyPresent ? "Leave blank to keep saved key" : "sk-…"
                  }
                  className="mt-1 w-full rounded-lg border border-content/15 bg-background-base/40 px-3 py-2 text-[13px] text-content outline-none focus:border-content/35"
                />
              </label>
              <p className="text-[12px] text-content/40">
                <a
                  className="underline decoration-content/25 hover:decoration-content/50"
                  href="https://opencode.ai/auth"
                  target="_blank"
                  rel="noreferrer"
                >
                  opencode.ai/auth
                </a>
              </p>
              <Actions>
                <PrimaryButton disabled={busy} onClick={onSaveKey}>
                  {busy ? "Validating…" : "Save & fetch models"}
                </PrimaryButton>
              </Actions>
            </StepBlock>
          ) : null}

          {supported && step === "models" ? (
            <StepBlock
              title="Models"
              body="Zen free models import automatically. Pick which OpenCode Go models to expose through Grok."
            >
              <div className="space-y-3">
                <div>
                  <h3 className="text-[12px] font-medium text-content/70">
                    Zen free ({zenFree.length})
                  </h3>
                  <ul className="mt-1 max-h-28 overflow-y-auto rounded-lg border border-content/10 p-2 text-[12px] text-content/55">
                    {zenFree.length === 0 ? (
                      <li>None discovered for this key.</li>
                    ) : (
                      zenFree.map((model) => (
                        <li key={model.id} className="py-0.5">
                          {model.name}{" "}
                          <span className="text-content/35">({model.id})</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[12px] font-medium text-content/70">
                      Go ({goSelected.size}/{goModels.length})
                    </h3>
                    <div className="flex gap-2">
                      <GhostButton
                        disabled={busy || goModels.length === 0}
                        onClick={() =>
                          setGoSelected(new Set(goModels.map((m) => m.id)))
                        }
                      >
                        Select all
                      </GhostButton>
                      <GhostButton
                        disabled={busy}
                        onClick={() => setGoSelected(new Set())}
                      >
                        Clear
                      </GhostButton>
                    </div>
                  </div>
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-content/10 p-2 text-[12px]">
                    {goModels.length === 0 ? (
                      <li className="text-content/45">
                        No Go models returned. You can continue with Zen free
                        only.
                      </li>
                    ) : (
                      goModels.map((model) => (
                        <li key={model.id} className="py-0.5">
                          <label className="flex cursor-pointer items-center gap-2 text-content/70">
                            <input
                              type="checkbox"
                              checked={goSelected.has(model.id)}
                              onChange={() => toggleGo(model.id)}
                            />
                            <span>
                              {model.name}{" "}
                              <span className="text-content/35">
                                ({model.id})
                              </span>
                            </span>
                          </label>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
              <Actions>
                <PrimaryButton disabled={busy} onClick={onModelsNext}>
                  Continue
                </PrimaryButton>
              </Actions>
            </StepBlock>
          ) : null}

          {supported && step === "websearch" ? (
            <StepBlock
              title="Web search"
              body="OpenCode’s free websearch uses Exa’s hosted MCP. Full Setup writes the same endpoint into Grok — no Exa signup."
            >
              <label className="flex items-center gap-2 text-[13px] text-content/70">
                <input
                  type="checkbox"
                  checked={enableExa}
                  onChange={(event) => setEnableExa(event.target.checked)}
                />
                Enable Exa MCP (`https://mcp.exa.ai/mcp`)
              </label>
              <Actions>
                <PrimaryButton disabled={busy} onClick={onWebsearchNext}>
                  Continue
                </PrimaryButton>
              </Actions>
            </StepBlock>
          ) : null}

          {supported && step === "apply" ? (
            <StepBlock
              title="Apply"
              body="Write OpenCodex config, start the proxy on loopback, inject Grok models, and refresh MonoCode’s catalog."
            >
              <Actions>
                <PrimaryButton disabled={busy} onClick={onApply}>
                  {busy ? "Applying…" : "Run Full Setup"}
                </PrimaryButton>
              </Actions>
            </StepBlock>
          ) : null}

          {supported && step === "done" ? (
            <StepBlock
              title="Ready"
              body="Grok should list ocx-* models. New sessions load Exa from ~/.grok/config.toml."
            >
              <StatusLine
                ok={ocxCount > 0 || (status?.ocxHealthy ?? false)}
                label={`OpenCodex models seen by grok: ${ocxCount}`}
              />
              <StatusLine
                ok={exaOk || (status?.exaMcpPresent ?? false)}
                label={
                  enableExa
                    ? "Exa MCP block present"
                    : "Exa MCP skipped (as requested)"
                }
              />
              <Actions>
                <PrimaryButton onClick={onClose}>Close</PrimaryButton>
              </Actions>
            </StepBlock>
          ) : null}

          {error ? (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-200/90">
              {error}
            </p>
          ) : null}

          {log.length > 0 ? (
            <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-content/10 bg-black/20 p-3 text-[11px] leading-relaxed text-content/55 whitespace-pre-wrap">
              {log.join("\n\n")}
            </pre>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function StepBlock({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[15px] font-semibold text-content">{title}</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-content/50">
          {body}
        </p>
      </div>
      {children}
    </div>
  );
}

function StatusLine({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <p className="text-[12px] text-content/60">
      <span
        className={`mr-2 inline-block size-1.5 rounded-full ${
          ok ? "bg-emerald-400" : "bg-content/25"
        }`}
      />
      {label}
    </p>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2 pt-1">{children}</div>;
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg bg-content px-3 py-1.5 text-[12px] font-medium text-background-base disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-content/15 px-3 py-1.5 text-[12px] text-content/70 hover:bg-content/5 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

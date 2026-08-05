"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  clearAudioDiagnostics,
  emitAudioDiagnostic,
  getAudioDiagnosticEvents,
  isAudioDebugEnabled,
  subscribeAudioDiagnostics,
} from "@/lib/audioDiagnostics";

const emptyEvents = [] as const;

export function AudioDebugPanel() {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const enabled = useSyncExternalStore(
    () => () => undefined,
    isAudioDebugEnabled,
    () => false,
  );
  const events = useSyncExternalStore(
    subscribeAudioDiagnostics,
    getAudioDiagnosticEvents,
    () => emptyEvents,
  );

  useEffect(() => {
    if (!enabled) return;

    emitAudioDiagnostic("debug.enabled", {
      userAgentFamily: /iPad|Macintosh/i.test(navigator.userAgent) ? "apple-tablet-or-mac" : "other",
    });

    const handleWindowError = (event: ErrorEvent) => {
      emitAudioDiagnostic("window.error", {
        errorName: event.error instanceof Error ? event.error.name : "ErrorEvent",
      });
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      emitAudioDiagnostic("window.unhandled_rejection", {
        reasonType: event.reason instanceof Error ? event.reason.name : typeof event.reason,
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      emitAudioDiagnostic("debug.cleanup", { handlersRemoved: true });
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [enabled]);

  if (!enabled) return null;

  const copyLogs = async () => {
    const payload = JSON.stringify(events, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopyStatus("Copied");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = payload;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      setCopyStatus(copied ? "Copied" : "Copy failed");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] right-3 z-[240] min-h-11 touch-manipulation rounded-full bg-slate-950 px-4 text-sm font-semibold text-white shadow-xl"
      >
        Debug ({events.length})
      </button>
      {open ? (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Audio diagnostics"
          className="fixed inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] top-[calc(0.5rem+env(safe-area-inset-top))] z-[250] flex flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-950 text-white shadow-2xl sm:inset-x-auto sm:right-3 sm:w-[min(42rem,calc(100vw-1.5rem))]"
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 p-3">
            <div>
              <h2 className="font-semibold">Audio diagnostics</h2>
              <p className="text-xs text-slate-300">Memory only · latest {events.length}/200</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { clearAudioDiagnostics(); setCopyStatus(""); }} className="min-h-11 touch-manipulation rounded-lg border border-slate-500 px-3 text-sm">Clear logs</button>
              <button type="button" onClick={() => void copyLogs()} className="min-h-11 touch-manipulation rounded-lg border border-slate-500 px-3 text-sm">Copy logs</button>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 touch-manipulation rounded-lg bg-white px-3 text-sm font-semibold text-slate-950">Close</button>
            </div>
          </header>
          {copyStatus ? <p className="px-3 pt-2 text-xs text-emerald-300">{copyStatus}</p> : null}
          <pre className="min-h-0 flex-1 overflow-auto overscroll-contain whitespace-pre-wrap break-words p-3 font-mono text-[11px] leading-5 [-webkit-overflow-scrolling:touch]">
            {events.length > 0 ? JSON.stringify(events, null, 2) : "No diagnostic events yet."}
          </pre>
        </section>
      ) : null}
    </>
  );
}

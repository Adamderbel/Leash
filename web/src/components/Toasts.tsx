"use client";

import { explorerUrl } from "@/lib/config";
import { useLeash } from "./LeashProvider";

export function Toasts() {
  const { toasts, dismiss } = useLeash();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-xl border p-3 shadow-xl backdrop-blur ${
            t.kind === "error" ? "border-rose-500/40 bg-rose-950/80" : t.kind === "success" ? "border-emerald-400/40 bg-emerald-950/80" : "border-white/15 bg-zinc-900/90"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-zinc-50">
              {t.kind === "pending" ? "⏳ " : t.kind === "success" ? "✅ " : "⛔ "}
              {t.title}
            </div>
            <button className="text-xs text-zinc-400" onClick={() => dismiss(t.id)}>✕</button>
          </div>
          {t.detail && <div className="mt-1 text-xs text-zinc-300">{t.detail}</div>}
          {t.signature && (
            <a className="mt-1 inline-block text-xs text-emerald-300 underline" href={explorerUrl("tx", t.signature)} target="_blank" rel="noreferrer">
              View on Explorer ↗
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

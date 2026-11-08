"use client";

import { formatSol, timeAgo } from "@/lib/config";
import { useLeash } from "./LeashProvider";
import { AddrLink, Card, Pill } from "./ui";

export function Activity() {
  const { vault, activity } = useLeash();
  if (!vault?.policy) return null;
  const labelFor = (a: string | null) => (a ? vault.policy!.recipients.find((r) => r.address === a)?.label ?? null : null);

  return (
    <Card title="Activity">
      {activity.length === 0 ? (
        <p className="text-sm text-zinc-500">No transactions yet.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {activity.map((a) => {
            const amount = a.amount ?? (a.vaultDelta !== null && a.vaultDelta !== 0n ? (a.vaultDelta < 0n ? -a.vaultDelta : a.vaultDelta) : null);
            const who = a.recipient ? labelFor(a.recipient) ?? null : null;
            return (
              <li key={a.signature} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={a.ok ? "text-zinc-100" : "text-rose-300"}>{a.ok ? "" : "⛔ "}{a.kind}</span>
                    {amount !== null && <span className="font-medium text-zinc-300">{formatSol(amount)} SOL</span>}
                    {a.recipient && (
                      <span className="text-zinc-500">
                        → {who ?? <AddrLink address={a.recipient} />}
                      </span>
                    )}
                  </div>
                  {a.memo && <div className="truncate text-xs text-zinc-500">“{a.memo}”</div>}
                  {a.error && <div className="mt-0.5"><Pill tone="red">Blocked on-chain: {a.error}</Pill></div>}
                </div>
                <div className="shrink-0 text-right">
                  <AddrLink address={a.signature} kind="tx" label="tx ↗" />
                  <div className="text-xs text-zinc-600">{timeAgo(a.time)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

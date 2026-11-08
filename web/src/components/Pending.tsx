"use client";

import { getApprovePaymentInstructionAsync, getRejectPaymentInstruction } from "@/generated/leash";
import { formatSol, timeAgo } from "@/lib/config";
import type { PendingItem } from "@/lib/leash";
import { useLeash } from "./LeashProvider";
import { AddrLink, Button, Card, Pill } from "./ui";

export function Pending() {
  const { vault, run, busy } = useLeash();
  if (!vault?.policy) return null;
  const p = vault.policy;
  const labelFor = (a: string) => p.recipients.find((r) => r.address === a)?.label;

  const approve = (it: PendingItem) =>
    run(`Approve ${formatSol(it.data.amount)} SOL`, async (signer) => [
      await getApprovePaymentInstructionAsync({
        owner: signer,
        policy: vault.policyAddress,
        pending: it.address,
        recipient: it.data.recipient,
        rentPayer: it.data.rentPayer,
      }),
    ]);
  const reject = (it: PendingItem) =>
    run("Reject payment", async (signer) => [
      getRejectPaymentInstruction({ owner: signer, policy: vault.policyAddress, pending: it.address, rentPayer: it.data.rentPayer }),
    ]);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Waiting for your approval {vault.pending.length > 0 && <Pill tone="amber">{vault.pending.length}</Pill>}
        </span>
      }
    >
      {vault.pending.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing pending. Payments above {formatSol(p.approvalThreshold)} SOL will show up here.</p>
      ) : (
        <ul className="space-y-3">
          {vault.pending.map((it) => (
            <li key={it.address} className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-lg font-semibold text-zinc-50">
                  {formatSol(it.data.amount)} SOL → {labelFor(it.data.recipient) ?? "?"}
                </div>
                <span className="text-xs text-zinc-500">#{it.data.id.toString()} · {timeAgo(Number(it.data.createdAt))}</span>
              </div>
              <div className="mt-1 text-sm text-zinc-300">“{it.data.memo || "no memo"}”</div>
              <div className="mt-1">
                <AddrLink address={it.data.recipient} />
              </div>
              {it.data.amount > vault.available && <p className="mt-2 text-xs text-rose-300">Vault balance is too low for this payment.</p>}
              <div className="mt-3 flex gap-2">
                <Button disabled={!!busy || it.data.amount > vault.available} onClick={() => approve(it)}>Approve & pay</Button>
                <Button variant="ghost" disabled={!!busy} onClick={() => reject(it)}>Reject</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

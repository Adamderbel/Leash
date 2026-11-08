"use client";

import { useState } from "react";
import { address, isAddress } from "@solana/kit";

import { getAddRecipientInstruction, getRemoveRecipientInstruction } from "@/generated/leash";
import { useLeash } from "./LeashProvider";
import { AddrLink, Button, Card, Input } from "./ui";

export function Recipients() {
  const { vault, run, busy } = useLeash();
  const [label, setLabel] = useState("");
  const [addr, setAddr] = useState("");
  if (!vault?.policy) return null;
  const p = vault.policy;

  const full = p.recipients.length >= 10;
  const error =
    label && new TextEncoder().encode(label).length > 24
      ? "Label max 24 characters"
      : addr && !isAddress(addr)
        ? "Invalid address"
        : addr && p.recipients.some((r) => r.address === addr)
          ? "Already on the list"
          : null;

  const add = async () => {
    const ok = await run(`Add ${label}`, async (signer) => [
      getAddRecipientInstruction({ owner: signer, policy: vault.policyAddress, address: address(addr), label: label.trim() }),
    ]);
    if (ok) {
      setLabel("");
      setAddr("");
    }
  };
  const remove = (a: string, l: string) =>
    run(`Remove ${l}`, async (signer) => [getRemoveRecipientInstruction({ owner: signer, policy: vault.policyAddress, address: address(a) })]);

  return (
    <Card title={`Approved recipients (${p.recipients.length}/10)`}>
      {p.recipients.length === 0 ? (
        <p className="text-sm text-zinc-500">No recipients yet. The agent can’t pay anyone until you add someone.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {p.recipients.map((r) => (
            <li key={r.address} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-100">{r.label || "Unnamed"}</div>
                <AddrLink address={r.address} />
              </div>
              <button className="text-xs text-zinc-500 hover:text-rose-300" disabled={!!busy} onClick={() => remove(r.address, r.label)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <Input placeholder="Name (e.g. Alice)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input placeholder="Solana address" value={addr} onChange={(e) => setAddr(e.target.value.trim())} />
        <Button disabled={!label.trim() || !addr || !!error || full || !!busy} onClick={add}>Add</Button>
      </div>
      {(error || full) && <p className="mt-2 text-xs text-rose-300">{full ? "List is full (10 max)" : error}</p>}
    </Card>
  );
}

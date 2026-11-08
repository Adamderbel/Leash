"use client";

import { useState } from "react";
import { address, isAddress, lamports } from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";

import { getSetPausedInstruction, getUpdatePolicyInstruction } from "@/generated/leash";
import { formatSol, parseSol } from "@/lib/config";
import { useLeash } from "./LeashProvider";
import { AddrLink, Button, Card, Input, Pill, Stat } from "./ui";

export function Overview() {
  const { vault, run, busy } = useLeash();
  const [editing, setEditing] = useState(false);
  if (!vault?.policy) return null;
  const p = vault.policy;

  const pct = p.dailyLimit > 0n ? Number((vault.spentToday * 100n) / p.dailyLimit) : 0;
  const lowGas = vault.agentLamports !== null && vault.agentLamports < parseSol("0.01")!;

  const togglePause = () =>
    run(p.paused ? "Resume agent" : "Pause agent", async (signer) => [
      getSetPausedInstruction({ owner: signer, policy: vault.policyAddress, paused: !p.paused }),
    ]);

  const topUpAgent = () =>
    run("Top up agent gas", async (signer) => [
      getTransferSolInstruction({ source: signer, destination: p.agent, amount: lamports(parseSol("0.05")!) }),
    ]);

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Vault {p.paused ? <Pill tone="red">Agent paused</Pill> : <Pill tone="green">Agent active</Pill>}
        </span>
      }
      action={
        <Button variant={p.paused ? "primary" : "danger"} disabled={!!busy} onClick={togglePause}>
          {p.paused ? "▶ Resume agent" : "⏸ Pause agent"}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <Stat label="Available" value={<>{formatSol(vault.available)} <span className="text-base text-zinc-500">SOL</span></>} sub={<AddrLink address={vault.vaultAddress} label="view vault ↗" />} />
        <Stat label="Spent today" value={formatSol(vault.spentToday)} sub={`of ${formatSol(p.dailyLimit)} SOL budget`} />
        <Stat label="Total spent" value={formatSol(p.totalSpent)} sub="all time" />
        <Stat
          label="Agent gas"
          value={vault.agentLamports === null ? "–" : formatSol(vault.agentLamports)}
          sub={lowGas ? <button className="text-amber-300 underline" onClick={topUpAgent}>Low, top up 0.05</button> : <AddrLink address={p.agent} label="agent ↗" />}
        />
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/5">
        <div className={`h-full rounded-full ${pct >= 90 ? "bg-rose-400" : pct >= 60 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
        <span className="text-zinc-500">Rules:</span>
        <Pill>max {formatSol(p.perTxLimit)} SOL / payment</Pill>
        <Pill>{formatSol(p.dailyLimit)} SOL / day</Pill>
        <Pill tone="amber">you approve &gt; {formatSol(p.approvalThreshold)} SOL</Pill>
        <Pill>{p.recipients.length} approved recipients</Pill>
        <button className="ml-auto text-xs text-emerald-300 underline" onClick={() => setEditing((e) => !e)}>
          {editing ? "Close" : "Edit rules"}
        </button>
      </div>

      {editing && <EditRules onDone={() => setEditing(false)} />}
    </Card>
  );
}

function EditRules({ onDone }: { onDone: () => void }) {
  const { vault, run, busy } = useLeash();
  const p = vault!.policy!;
  const [perTx, setPerTx] = useState(formatSol(p.perTxLimit, 9));
  const [daily, setDaily] = useState(formatSol(p.dailyLimit, 9));
  const [threshold, setThreshold] = useState(formatSol(p.approvalThreshold, 9));
  const [agent, setAgent] = useState<string>(p.agent);

  const a = parseSol(perTx);
  const d = parseSol(daily);
  const t = parseSol(threshold);
  const error =
    a === null || d === null || t === null ? "Invalid amount" : a === 0n || d === 0n ? "Limits must be > 0" : t > a ? "Auto-approve must be ≤ max per payment" : !isAddress(agent) ? "Invalid agent address" : null;

  const save = async () => {
    const ok = await run("Update rules", async (signer) => [
      getUpdatePolicyInstruction({
        owner: signer,
        policy: vault!.policyAddress,
        agent: address(agent),
        perTxLimit: a!,
        dailyLimit: d!,
        approvalThreshold: t!,
      }),
    ]);
    if (ok) onDone();
  };

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Max per payment" suffix="SOL" value={perTx} onChange={(e) => setPerTx(e.target.value)} />
        <Input label="Daily budget" suffix="SOL" value={daily} onChange={(e) => setDaily(e.target.value)} />
        <Input label="Auto-approve up to" suffix="SOL" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </div>
      <Input className="mt-3" label="Agent address" value={agent} onChange={(e) => setAgent(e.target.value.trim())} />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-rose-300">{error}</span>
        <Button disabled={!!error || !!busy} onClick={save}>Save rules</Button>
      </div>
    </div>
  );
}

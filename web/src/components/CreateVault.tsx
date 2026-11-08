"use client";

import { useState } from "react";
import { address, isAddress, lamports, type Instruction } from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";

import { findPolicyPda, getDepositInstructionAsync, getInitializeInstructionAsync } from "@/generated/leash";
import { AGENT_ADDRESS, parseSol } from "@/lib/config";
import { useLeash } from "./LeashProvider";
import { Button, Card, Input } from "./ui";

const AGENT_GAS = parseSol("0.05")!;

export function CreateVault() {
  const { run, busy } = useLeash();
  const [perTx, setPerTx] = useState("1");
  const [daily, setDaily] = useState("2");
  const [threshold, setThreshold] = useState("0.25");
  const [deposit, setDeposit] = useState("0.5");
  const [agent, setAgent] = useState(AGENT_ADDRESS);
  const [fundAgent, setFundAgent] = useState(true);

  const p = parseSol(perTx);
  const d = parseSol(daily);
  const t = parseSol(threshold);
  const dep = deposit.trim() === "" ? 0n : parseSol(deposit);
  const error =
    p === null || d === null || t === null || dep === null
      ? "Enter valid SOL amounts"
      : p === 0n || d === 0n
        ? "Limits must be greater than 0"
        : t > p
          ? "Auto-approve must be ≤ max per payment"
          : !isAddress(agent)
            ? "Agent address is invalid"
            : null;

  const submit = () =>
    run("Create vault", async (signer) => {
      const agentAddr = address(agent);
      const ixs: Instruction[] = [
        await getInitializeInstructionAsync({
          owner: signer,
          agent: agentAddr,
          perTxLimit: p!,
          dailyLimit: d!,
          approvalThreshold: t!,
        }),
      ];
      if (dep && dep > 0n) {
        const [policy] = await findPolicyPda({ owner: signer.address });
        ixs.push(await getDepositInstructionAsync({ depositor: signer, policy, amount: dep }));
      }
      if (fundAgent) {
        ixs.push(getTransferSolInstruction({ source: signer, destination: agentAddr, amount: lamports(AGENT_GAS) }));
      }
      return ixs;
    });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-zinc-50">Create your Leash vault</h1>
      <p className="mt-2 text-zinc-400">
        Set the rules once. The Solana program enforces them on every payment your agent tries, and only you can change them.
      </p>

      <Card className="mt-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Max per payment" suffix="SOL" inputMode="decimal" value={perTx} onChange={(e) => setPerTx(e.target.value)} hint="Hard cap. Anything above it is rejected." />
          <Input label="Daily budget" suffix="SOL" inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} hint="Max the agent auto-spends per day" />
          <Input label="Auto-approve up to" suffix="SOL" inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} hint="Above this, you approve" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Input label="Initial deposit" suffix="SOL" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          <Input className="sm:col-span-2" label="AI agent address" value={agent} onChange={(e) => setAgent(e.target.value.trim())} hint="Leash's hosted agent. It’s the only key allowed to spend." />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={fundAgent} onChange={(e) => setFundAgent(e.target.checked)} className="accent-emerald-400" />
          Send 0.05 SOL to the agent for network fees
        </label>

        <div className="mt-6 flex items-center justify-between gap-4">
          <span className="text-sm text-rose-300">{error}</span>
          <Button disabled={!!error || !!busy} onClick={submit}>
            {busy === "Create vault" ? "Creating…" : "Create vault"}
          </Button>
        </div>
      </Card>
      <p className="mt-4 text-xs text-zinc-500">One Phantom approval creates the vault, deposits and funds the agent in a single transaction. Vault storage costs about 0.006 SOL.</p>
    </div>
  );
}

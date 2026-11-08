"use client";

import { useState } from "react";

import { getDepositInstructionAsync, getWithdrawInstructionAsync } from "@/generated/leash";
import { formatSol, parseSol } from "@/lib/config";
import { useLeash } from "./LeashProvider";
import { Button, Card, Input } from "./ui";

export function Funds() {
  const { vault, run, busy } = useLeash();
  const [amount, setAmount] = useState("0.5");
  if (!vault?.policy) return null;
  const lamports = parseSol(amount);
  const valid = lamports !== null && lamports > 0n;

  const deposit = () =>
    run("Deposit", async (signer) => [
      await getDepositInstructionAsync({ depositor: signer, policy: vault.policyAddress, amount: lamports! }),
    ]);
  const withdraw = () =>
    run("Withdraw", async (signer) => [
      await getWithdrawInstructionAsync({ owner: signer, policy: vault.policyAddress, amount: lamports! }),
    ]);

  return (
    <Card title="Funds">
      <Input label="Amount" suffix="SOL" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button disabled={!valid || !!busy} onClick={deposit}>Deposit</Button>
        <Button variant="ghost" disabled={!valid || !!busy || lamports! > vault.available} onClick={withdraw}>Withdraw</Button>
      </div>
      <button className="mt-2 text-xs text-zinc-500 underline" onClick={() => setAmount(formatSol(vault.available, 9))}>
        Max withdraw: {formatSol(vault.available)} SOL
      </button>
    </Card>
  );
}

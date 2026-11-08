import "server-only";

import { address, isAddress, type Address } from "@solana/kit";

import { fetchMaybePolicy, getAgentSpendInstructionAsync, getRequestApprovalInstruction, type Policy } from "@/generated/leash";
import type { PayAction } from "@/lib/agent-types";
import { formatSol, parseSol, SECONDS_PER_DAY, VAULT_RENT_MIN } from "@/lib/config";
import { findPendingPda, getVaultAddresses } from "@/lib/leash";

import { getAgentSigner, rpc, sendAgentTransaction } from "./solana";

export type VaultContext = { owner: Address; policyAddress: Address; vaultAddress: Address; policy: Policy };

/** Load the owner's vault and make sure it is actually controlled by this agent. */
export async function loadContext(owner: string): Promise<VaultContext | string> {
  const { policy: policyAddress, vault: vaultAddress } = await getVaultAddresses(address(owner));
  const maybe = await fetchMaybePolicy(rpc, policyAddress);
  if (!maybe.exists) return "This wallet has no Leash vault yet. Create one in the dashboard first.";
  const agent = await getAgentSigner();
  if (maybe.data.agent !== agent.address) return "This vault is configured for a different agent key.";
  return { owner: address(owner), policyAddress, vaultAddress, policy: maybe.data };
}

export async function getVaultStatus(ctx: VaultContext) {
  const [bal, agentBal] = await Promise.all([
    rpc.getBalance(ctx.vaultAddress, { commitment: "confirmed" }).send(),
    rpc.getBalance((await getAgentSigner()).address, { commitment: "confirmed" }).send(),
  ]);
  const p = ctx.policy;
  const lamports = BigInt(bal.value);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const spent = now - p.dayStart >= SECONDS_PER_DAY ? 0n : p.spentToday;
  return {
    available_sol: formatSol(lamports > VAULT_RENT_MIN ? lamports - VAULT_RENT_MIN : 0n, 6),
    spent_today_sol: formatSol(spent, 6),
    daily_budget_sol: formatSol(p.dailyLimit, 6),
    remaining_today_sol: formatSol(p.dailyLimit > spent ? p.dailyLimit - spent : 0n, 6),
    max_per_payment_sol: formatSol(p.perTxLimit, 6),
    auto_approve_up_to_sol: formatSol(p.approvalThreshold, 6),
    paused: p.paused,
    approved_recipient_count: p.recipients.length,
    agent_gas_sol: formatSol(BigInt(agentBal.value), 6),
  };
}

export function listRecipients(ctx: VaultContext) {
  return ctx.policy.recipients.map((r) => ({ name: r.label, address: r.address }));
}

function clipUtf8(s: string, maxBytes: number): string {
  const enc = new TextEncoder();
  let out = s;
  while (enc.encode(out).length > maxBytes) out = out.slice(0, -1);
  return out;
}

/**
 * Attempt a payment. The agent does NOT pre-check the owner's rules: the on-chain program is the
 * authority. Small payments use agent_spend; above the auto-approve threshold (and within the hard
 * cap) we file a request_approval instead so the owner can approve it in the dashboard.
 */
export async function pay(ctx: VaultContext, args: { recipient?: unknown; amount_sol?: unknown; memo?: unknown }): Promise<PayAction> {
  const rawRecipient = String(args.recipient ?? "").trim().replace(/^@/, "");
  const amountStr = String(args.amount_sol ?? "").trim();
  const memo = clipUtf8(String(args.memo ?? "").trim(), 64);
  const base: PayAction = { kind: "error", recipient: null, recipientLabel: null, amountSol: amountStr, memo };

  const lamports = parseSol(amountStr);
  if (lamports === null || lamports === 0n) return { ...base, error: `"${amountStr}" is not a valid SOL amount` };

  let recipient: Address;
  let label: string | null = null;
  if (isAddress(rawRecipient)) {
    recipient = address(rawRecipient);
    label = ctx.policy.recipients.find((r) => r.address === recipient)?.label ?? null;
  } else {
    const match = ctx.policy.recipients.find((r) => r.label.toLowerCase() === rawRecipient.toLowerCase());
    if (!match) {
      return { ...base, error: `"${rawRecipient}" is not on the approved recipients list (and is not a valid address)` };
    }
    recipient = match.address;
    label = match.label;
  }

  const agent = await getAgentSigner();
  const agentBal = await rpc.getBalance(agent.address, { commitment: "confirmed" }).send();
  if (BigInt(agentBal.value) < 3_000_000n) {
    return { ...base, recipient, recipientLabel: label, error: "The agent is out of gas. Top it up from the dashboard (Agent gas → top up)." };
  }

  const needsApproval = lamports > ctx.policy.approvalThreshold && lamports <= ctx.policy.perTxLimit;
  const instruction = needsApproval
    ? getRequestApprovalInstruction({
        agent,
        policy: ctx.policyAddress,
        pending: await findPendingPda(ctx.policyAddress, ctx.policy.pendingCount),
        recipient,
        amount: lamports,
        memo,
      })
    : await getAgentSpendInstructionAsync({ agent, policy: ctx.policyAddress, recipient, amount: lamports, memo });

  const res = await sendAgentTransaction([instruction]);
  const common = { recipient, recipientLabel: label, amountSol: formatSol(lamports, 9), memo, signature: res.signature };
  if (!res.ok) return { ...common, kind: "blocked", error: res.error };
  if (needsApproval) ctx.policy = { ...ctx.policy, pendingCount: ctx.policy.pendingCount + 1n };
  return { ...common, kind: needsApproval ? "pending" : "paid" };
}

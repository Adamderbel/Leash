import {
  getAddressEncoder,
  getBase58Encoder,
  getProgramDerivedAddress,
  getU64Encoder,
  getUtf8Encoder,
  type Address,
  type Rpc,
  type Signature,
  type SolanaRpcApi,
} from "@solana/kit";

import {
  fetchAllMaybePendingPayment,
  fetchMaybePolicy,
  findPolicyPda,
  findVaultPda,
  getAgentSpendInstructionDataDecoder,
  getDepositInstructionDataDecoder,
  getLeashErrorMessage,
  getRequestApprovalInstructionDataDecoder,
  getWithdrawInstructionDataDecoder,
  identifyLeashInstruction,
  LEASH_PROGRAM_ADDRESS,
  LeashInstruction,
  type LeashError,
  type PendingPayment,
  type Policy,
} from "@/generated/leash";

import { SECONDS_PER_DAY, VAULT_RENT_MIN } from "./config";

export { LEASH_PROGRAM_ADDRESS };

export async function getVaultAddresses(owner: Address) {
  const [policy] = await findPolicyPda({ owner });
  const [vault] = await findVaultPda({ policy });
  return { policy, vault };
}

/** ["pending", policy, id as u64 little-endian] — mirrors the on-chain seeds. */
export async function findPendingPda(policy: Address, id: bigint): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: LEASH_PROGRAM_ADDRESS,
    seeds: [getUtf8Encoder().encode("pending"), getAddressEncoder().encode(policy), getU64Encoder().encode(id)],
  });
  return pda;
}

export type PendingItem = { address: Address; data: PendingPayment };

export type VaultState = {
  policyAddress: Address;
  vaultAddress: Address;
  policy: Policy | null;
  vaultLamports: bigint;
  available: bigint;
  /** spent_today with the 24h window applied (0 if the window expired) */
  spentToday: bigint;
  agentLamports: bigint | null;
  pending: PendingItem[];
};

const PENDING_LOOKBACK = 15n;

export async function loadVault(rpc: Rpc<SolanaRpcApi>, owner: Address): Promise<VaultState> {
  const { policy: policyAddress, vault: vaultAddress } = await getVaultAddresses(owner);
  const [maybePolicy, vaultBal] = await Promise.all([
    fetchMaybePolicy(rpc, policyAddress),
    rpc.getBalance(vaultAddress, { commitment: "confirmed" }).send(),
  ]);
  const vaultLamports = BigInt(vaultBal.value);
  const policy = maybePolicy.exists ? maybePolicy.data : null;

  let pending: PendingItem[] = [];
  let agentLamports: bigint | null = null;
  let spentToday = 0n;
  if (policy) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    spentToday = now - policy.dayStart >= SECONDS_PER_DAY ? 0n : policy.spentToday;

    const start = policy.pendingCount > PENDING_LOOKBACK ? policy.pendingCount - PENDING_LOOKBACK : 0n;
    const ids: bigint[] = [];
    for (let i = start; i < policy.pendingCount; i++) ids.push(i);
    const addrs = await Promise.all(ids.map((id) => findPendingPda(policyAddress, id)));
    const [accounts, agentBal] = await Promise.all([
      addrs.length ? fetchAllMaybePendingPayment(rpc, addrs) : Promise.resolve([]),
      rpc.getBalance(policy.agent, { commitment: "confirmed" }).send(),
    ]);
    pending = accounts.flatMap((a) => (a.exists ? [{ address: a.address, data: a.data }] : []));
    agentLamports = BigInt(agentBal.value);
  }

  return {
    policyAddress,
    vaultAddress,
    policy,
    vaultLamports,
    available: vaultLamports > VAULT_RENT_MIN ? vaultLamports - VAULT_RENT_MIN : 0n,
    spentToday,
    agentLamports,
    pending,
  };
}

// ---------------------------------------------------------------- activity feed

export type ActivityItem = {
  signature: string;
  time: number | bigint | null;
  ok: boolean;
  kind: string;
  /** SOL moved in/out of the vault (positive = in) */
  vaultDelta: bigint | null;
  amount: bigint | null;
  recipient: string | null;
  memo: string | null;
  error: string | null;
};

const KIND_LABEL: Record<LeashInstruction, string> = {
  [LeashInstruction.AddRecipient]: "Recipient added",
  [LeashInstruction.AgentSpend]: "Agent payment",
  [LeashInstruction.ApprovePayment]: "Owner approved payment",
  [LeashInstruction.Deposit]: "Deposit",
  [LeashInstruction.Initialize]: "Vault created",
  [LeashInstruction.RejectPayment]: "Owner rejected payment",
  [LeashInstruction.RemoveRecipient]: "Recipient removed",
  [LeashInstruction.RequestApproval]: "Agent asked for approval",
  [LeashInstruction.SetPaused]: "Pause toggled",
  [LeashInstruction.UpdatePolicy]: "Rules updated",
  [LeashInstruction.Withdraw]: "Withdrawal",
};

type JsonTx = {
  blockTime: number | null;
  meta: { err: unknown; logMessages: string[] | null; preBalances: number[]; postBalances: number[] } | null;
  transaction: {
    message: {
      accountKeys: string[];
      instructions: { programIdIndex: number; accounts: number[]; data: string }[];
    };
  };
};

function parseTx(signature: string, tx: JsonTx, vault: Address): ActivityItem {
  const keys = tx.transaction.message.accountKeys.map(String);
  const meta = tx.meta;
  const item: ActivityItem = {
    signature,
    time: tx.blockTime ?? null,
    ok: !meta?.err,
    kind: "Transaction",
    vaultDelta: null,
    amount: null,
    recipient: null,
    memo: null,
    error: null,
  };
  const vi = keys.indexOf(vault);
  if (meta && vi >= 0) item.vaultDelta = BigInt(meta.postBalances[vi] - meta.preBalances[vi]);

  const ix = tx.transaction.message.instructions.find((i) => keys[i.programIdIndex] === LEASH_PROGRAM_ADDRESS);
  if (ix) {
    try {
      const data = getBase58Encoder().encode(ix.data);
      const kind = identifyLeashInstruction(data);
      item.kind = KIND_LABEL[kind] ?? item.kind;
      if (kind === LeashInstruction.AgentSpend) {
        const d = getAgentSpendInstructionDataDecoder().decode(data);
        item.amount = d.amount;
        item.memo = d.memo;
        item.recipient = keys[ix.accounts[3]] ?? null;
      } else if (kind === LeashInstruction.RequestApproval) {
        const d = getRequestApprovalInstructionDataDecoder().decode(data);
        item.amount = d.amount;
        item.memo = d.memo;
        item.recipient = keys[ix.accounts[3]] ?? null;
      } else if (kind === LeashInstruction.Deposit) {
        item.amount = getDepositInstructionDataDecoder().decode(data).amount;
      } else if (kind === LeashInstruction.Withdraw) {
        item.amount = getWithdrawInstructionDataDecoder().decode(data).amount;
      } else if (kind === LeashInstruction.ApprovePayment) {
        item.recipient = keys[ix.accounts[4]] ?? null;
      }
    } catch {
      /* not a Leash instruction we know */
    }
  }
  if (!item.ok) {
    const line = meta?.logMessages?.find((l) => l.includes("Error Message:"));
    item.error = line ? line.split("Error Message:")[1].trim().replace(/\.$/, "") : "Transaction failed";
  }
  return item;
}

export async function loadActivity(
  rpc: Rpc<SolanaRpcApi>,
  vault: Address,
  cache: Map<string, ActivityItem>,
  limit = 12,
): Promise<ActivityItem[]> {
  const sigs = await rpc.getSignaturesForAddress(vault, { limit, commitment: "confirmed" }).send();
  const missing = sigs.filter((s) => !cache.has(s.signature));
  await Promise.all(
    missing.map(async (s) => {
      const tx = await rpc
        .getTransaction(s.signature as Signature, {
          encoding: "json",
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        })
        .send();
      if (tx) cache.set(s.signature, parseTx(s.signature, tx as unknown as JsonTx, vault));
    }),
  );
  return sigs.flatMap((s) => {
    const it = cache.get(s.signature);
    return it ? [it] : [];
  });
}

// ---------------------------------------------------------------- errors

/** Find a Leash program error code (6000-6016) anywhere inside a nested Kit/RPC error. */
export function findLeashCode(e: unknown): number | undefined {
  let code: number | undefined;
  const seen = new Set<unknown>();
  const walk = (x: unknown, depth: number) => {
    if (!x || typeof x !== "object" || seen.has(x) || depth > 8 || code !== undefined) return;
    seen.add(x);
    const o = x as Record<string, unknown>;
    if (typeof o.code === "number" && o.code >= 6000 && o.code <= 6016) {
      code = o.code;
      return;
    }
    for (const k of Object.keys(o)) walk(o[k], depth + 1);
    if ("cause" in o) walk(o.cause, depth + 1);
  };
  walk(e, 0);
  return code;
}

export function leashErrorMessage(code: number): string {
  return getLeashErrorMessage(code as LeashError);
}

/** Turn any wallet / RPC / program error into a short human sentence. */
export function explainError(e: unknown): string {
  const code = findLeashCode(e);
  if (code !== undefined) return leashErrorMessage(code);

  const msg = e instanceof Error ? e.message : String(e);
  if (/reject|denied|cancel/i.test(msg)) return "Request rejected in your wallet.";
  if (/insufficient|0x1\b|lamports/i.test(msg)) return "Not enough SOL to pay for this transaction.";
  if (/already in use/i.test(msg)) return "This account already exists.";
  return msg.length > 180 ? msg.slice(0, 180) + "…" : msg;
}


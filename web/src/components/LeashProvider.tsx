"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { address, type Address, type Instruction, type TransactionSigner } from "@solana/kit";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";

import { client } from "@/lib/client";
import { explainError, loadActivity, loadVault, type ActivityItem, type VaultState } from "@/lib/leash";

export type Toast = { id: number; kind: "pending" | "success" | "error"; title: string; detail?: string; signature?: string };

type LeashCtx = {
  owner: Address | null;
  signer: TransactionSigner | null;
  vault: VaultState | null;
  activity: ActivityItem[];
  loading: boolean;
  busy: string | null;
  toasts: Toast[];
  dismiss: (id: number) => void;
  refresh: () => void;
  /** Build instructions, ask the wallet to sign, send, and report the result. */
  run: (label: string, build: (signer: TransactionSigner) => Promise<Instruction[]>) => Promise<boolean>;
};

const Ctx = createContext<LeashCtx | null>(null);

export function useLeash(): LeashCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLeash must be used inside <LeashProvider>");
  return v;
}

const VAULT_POLL_MS = 6_000;
const ACTIVITY_POLL_MS = 15_000;

export function LeashProvider({ children }: { children: ReactNode }) {
  const connected = useConnectedWallet(client);
  const owner = connected ? address(connected.account.address) : null;
  const signer = (connected?.signer ?? null) as TransactionSigner | null;

  // Data is stored together with the key it belongs to, so switching wallets never shows stale data.
  const [vaultData, setVaultData] = useState<{ owner: Address; vault: VaultState } | null>(null);
  const [activityData, setActivityData] = useState<{ vault: Address; items: ActivityItem[] } | null>(null);
  const vault = owner && vaultData?.owner === owner ? vaultData.vault : null;
  const loading = !!owner && !vault;
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tick, setTick] = useState(0);
  const cache = useRef(new Map<string, ActivityItem>());
  const toastId = useRef(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Vault + policy + pending: poll
  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    const load = async () => {
      try {
        const v = await loadVault(client.rpc, owner);
        if (!cancelled) setVaultData({ owner, vault: v });
      } catch (e) {
        console.warn("loadVault failed", e);
      }
    };
    load();
    const id = setInterval(load, VAULT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [owner, tick]);

  // Activity feed: slower poll, cached per signature
  const vaultAddress = vault?.vaultAddress ?? null;
  const activity = vaultAddress && activityData?.vault === vaultAddress ? activityData.items : [];
  useEffect(() => {
    if (!vaultAddress) return;
    let cancelled = false;
    const load = async () => {
      try {
        const items = await loadActivity(client.rpc, vaultAddress, cache.current);
        if (!cancelled) setActivityData({ vault: vaultAddress, items });
      } catch (e) {
        console.warn("loadActivity failed", e);
      }
    };
    load();
    const id = setInterval(load, ACTIVITY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [vaultAddress, tick]);

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    if (t.kind !== "pending") setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 9_000);
    return id;
  }, []);
  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  const run = useCallback<LeashCtx["run"]>(
    async (label, build) => {
      if (!signer) {
        pushToast({ kind: "error", title: label, detail: "Connect a wallet that can sign first." });
        return false;
      }
      setBusy(label);
      const pid = pushToast({ kind: "pending", title: label, detail: "Approve in your wallet…" });
      try {
        const ixs = await build(signer);
        const res = await client.sendTransaction(ixs);
        dismiss(pid);
        pushToast({ kind: "success", title: label, detail: "Confirmed on Devnet", signature: res.context.signature });
        refresh();
        setTimeout(refresh, 2_500);
        return true;
      } catch (e) {
        console.error(label, e);
        dismiss(pid);
        pushToast({ kind: "error", title: `${label} failed`, detail: explainError(e) });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [signer, pushToast, dismiss, refresh],
  );

  return (
    <Ctx.Provider value={{ owner, signer, vault, activity, loading, busy, toasts, dismiss, refresh, run }}>
      {children}
    </Ctx.Provider>
  );
}

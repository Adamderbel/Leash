"use client";

import { useState } from "react";
import { useConnect, useConnectedWallet, useDisconnect, useIsWalletReady, useWallets } from "@solana/kit-plugin-wallet/react";

import { client } from "@/lib/client";
import { shortAddr } from "@/lib/config";
import { Button } from "./ui";

export function WalletButton({ big = false }: { big?: boolean }) {
  const ready = useIsWalletReady(client);
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const connect = useConnect(client);
  const disconnect = useDisconnect(client);
  const [open, setOpen] = useState(false);

  if (!ready) return <Button variant="ghost" disabled>Loading wallets…</Button>;

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden rounded-xl border border-white/10 px-3 py-2 font-mono text-xs text-zinc-300 sm:inline">
          {connected.wallet.name} · {shortAddr(connected.account.address)}
        </span>
        <Button variant="ghost" onClick={() => disconnect.dispatch()}>Disconnect</Button>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <a href="https://phantom.com/download" target="_blank" rel="noreferrer">
        <Button className={big ? "px-6 py-3 text-base" : ""}>Install Phantom</Button>
      </a>
    );
  }

  const size = big ? "px-6 py-3 text-base" : "";
  if (wallets.length === 1) {
    return (
      <Button className={size} disabled={connect.isRunning} onClick={() => connect.dispatch(wallets[0])}>
        {connect.isRunning ? "Connecting…" : `Connect ${wallets[0].name}`}
      </Button>
    );
  }

  return (
    <div className="relative">
      <Button className={size} onClick={() => setOpen((o) => !o)}>{connect.isRunning ? "Connecting…" : "Connect wallet"}</Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-white/10 bg-zinc-900 p-1 shadow-xl">
          {wallets.map((w) => (
            <button
              key={w.name}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5"
              onClick={() => {
                setOpen(false);
                connect.dispatch(w);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {w.icon && <img src={w.icon} alt="" className="h-5 w-5 rounded" />}
              {w.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

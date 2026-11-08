"use client";

import { explorerUrl } from "@/lib/config";
import { LEASH_PROGRAM_ADDRESS } from "@/lib/leash";
import { WalletButton } from "./WalletButton";

const FEATURES = [
  { icon: "🤖", title: "Your AI pays for you", body: "Tell the agent “pay Alice 0.1 SOL for the logo” and it handles the transaction." },
  { icon: "⛓️", title: "Rules enforced on-chain", body: "Per-payment caps, daily budgets and an approved-recipient list, checked by a Solana program rather than by the prompt." },
  { icon: "✋", title: "You approve the big ones", body: "Anything above your auto-approve limit waits for one click from you. There’s also a kill switch." },
];

export function Landing() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
      <div className="text-center">
        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
          Live on Solana Devnet
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-50 sm:text-6xl">
          Give your AI agent a wallet,
          <br />
          <span className="text-emerald-400">on a leash.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
          Leash is a vault your AI agent can spend from, but only within limits that Solana itself enforces. A hacked,
          confused or prompt-injected agent still can’t overspend.
        </p>
        <div className="mt-10 flex justify-center">
          <WalletButton big />
        </div>
        <p className="mt-3 text-xs text-zinc-500">Switch Phantom to Devnet: Settings → Developer Settings → Testnet Mode</p>
      </div>

      <div className="mt-20 grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-2xl">{f.icon}</div>
            <h3 className="mt-3 font-semibold text-zinc-100">{f.title}</h3>
            <p className="mt-2 text-sm text-zinc-400">{f.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-zinc-600">
        Program{" "}
        <a className="font-mono underline" href={explorerUrl("address", LEASH_PROGRAM_ADDRESS)} target="_blank" rel="noreferrer">
          {LEASH_PROGRAM_ADDRESS}
        </a>
      </p>
    </div>
  );
}

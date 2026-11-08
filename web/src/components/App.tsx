"use client";

import { Activity } from "./Activity";
import { ChatPanel } from "./ChatPanel";
import { CreateVault } from "./CreateVault";
import { Funds } from "./Funds";
import { Landing } from "./Landing";
import { LeashProvider, useLeash } from "./LeashProvider";
import { Overview } from "./Overview";
import { Pending } from "./Pending";
import { Recipients } from "./Recipients";
import { Toasts } from "./Toasts";
import { WalletButton } from "./WalletButton";

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🦮</span>
          <span className="text-lg font-bold tracking-tight text-zinc-50">Leash</span>
          <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">devnet</span>
        </div>
        <WalletButton />
      </div>
    </header>
  );
}

function Body() {
  const { owner, vault, loading } = useLeash();
  if (!owner) return <Landing />;
  if (loading && !vault) return <div className="py-32 text-center text-zinc-500">Loading your vault…</div>;
  if (!vault?.policy) return <CreateVault />;

  return (
    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[1fr_400px]">
      <div className="min-w-0 space-y-4">
        <Overview />
        <Pending />
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Recipients />
          <Funds />
        </div>
        <Activity />
      </div>
      <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
        <ChatPanel key={owner} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <LeashProvider>
      <Header />
      <main className="flex-1">
        <Body />
      </main>
      <Toasts />
    </LeashProvider>
  );
}

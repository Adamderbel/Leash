"use client";

import dynamic from "next/dynamic";

// Wallet discovery only works in the browser, so the app renders client-side only.
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => <div className="py-32 text-center text-zinc-500">Loading Leash…</div>,
});

export default function Page() {
  return <App />;
}

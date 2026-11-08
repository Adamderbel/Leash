export const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const WS_URL = process.env.NEXT_PUBLIC_SOLANA_WS_URL ?? "wss://api.devnet.solana.com";
export const AGENT_ADDRESS = process.env.NEXT_PUBLIC_AGENT_ADDRESS ?? "";

export const LAMPORTS_PER_SOL = 1_000_000_000n;
/** Rent-exempt minimum for a 0-byte system account (the vault keeps this much). */
export const VAULT_RENT_MIN = 890_880n;
export const SECONDS_PER_DAY = 86_400n;

export function explorerUrl(kind: "address" | "tx", id: string): string {
  return `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;
}

export function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

/** Parse a decimal SOL string ("0.25") into lamports without float rounding. Returns null if invalid. */
export function parseSol(input: string): bigint | null {
  const s = input.trim();
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return null;
  const [whole = "0", frac = ""] = s.split(".");
  if (frac.length > 9) return null;
  return BigInt(whole || "0") * LAMPORTS_PER_SOL + BigInt((frac + "000000000").slice(0, 9));
}

export function formatSol(lamports: bigint, maxDigits = 4): string {
  const neg = lamports < 0n;
  const abs = neg ? -lamports : lamports;
  const whole = abs / LAMPORTS_PER_SOL;
  const frac = (abs % LAMPORTS_PER_SOL).toString().padStart(9, "0").slice(0, maxDigits).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

export function timeAgo(unixSeconds: number | bigint | null | undefined): string {
  if (unixSeconds === null || unixSeconds === undefined) return "";
  const secs = Number(unixSeconds); // RPC returns block times as bigint
  if (!secs) return "";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - secs);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Shared between the browser chat and the /api/agent server route.

/** Throwaway address with no known owner, used by the demo "attack" buttons. */
export const DEMO_ATTACKER = "jRiEPkqh9JbeXX3CuYroARgoTvBSKxsXWsCD1TnSbmV";

export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** The text the owner signs (free, off-chain) to unlock the agent chat. */
export function sessionMessage(owner: string, issuedAtIso: string): string {
  return `Leash agent session\nOwner: ${owner}\nIssued: ${issuedAtIso}\n\nSigning proves you own this vault. It is free and sends no transaction.`;
}

export type AgentSession = { message: string; signature: string /* base64 */ };

export type PayAction = {
  kind: "paid" | "pending" | "blocked" | "error";
  recipient: string | null;
  recipientLabel: string | null;
  amountSol: string;
  memo: string;
  signature?: string;
  error?: string;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AgentRequest = {
  owner: string;
  session: AgentSession;
  text: string;
  history: ChatTurn[];
  /** "compromised" skips the AI and sends a malicious payment directly (demo). */
  mode?: "chat" | "compromised";
};

export type AgentResponse = {
  reply: string;
  actions: PayAction[];
  engine: "groq" | "fallback" | "direct";
  error?: string;
};

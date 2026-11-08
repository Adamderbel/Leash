import "server-only";

import { getBase64Encoder, getPublicKeyFromAddress, getUtf8Encoder, isAddress, verifySignature, type Address, type SignatureBytes } from "@solana/kit";

import { SESSION_MAX_AGE_MS, type AgentSession } from "@/lib/agent-types";

/** Verify the owner signed the session message with their wallet (ed25519). */
export async function verifySession(owner: string, session: AgentSession | undefined): Promise<string | null> {
  if (!isAddress(owner)) return "Invalid owner address";
  if (!session?.message || !session?.signature) return "Missing session signature";

  const ownerLine = session.message.match(/^Owner: (\S+)$/m)?.[1];
  const issuedLine = session.message.match(/^Issued: (\S+)$/m)?.[1];
  if (ownerLine !== owner || !issuedLine) return "Session does not match this wallet";
  const issued = Date.parse(issuedLine);
  if (!Number.isFinite(issued) || Date.now() - issued > SESSION_MAX_AGE_MS || issued - Date.now() > 60_000) {
    return "Session expired, please unlock the agent again";
  }

  try {
    const sig = getBase64Encoder().encode(session.signature) as SignatureBytes;
    const key = await getPublicKeyFromAddress(owner as Address);
    const ok = await verifySignature(key, sig, getUtf8Encoder().encode(session.message));
    return ok ? null : "Invalid session signature";
  } catch {
    return "Invalid session signature";
  }
}

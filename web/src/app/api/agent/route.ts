import { DEMO_ATTACKER, type AgentRequest, type AgentResponse } from "@/lib/agent-types";
import { verifySession } from "@/lib/server/auth";
import { runFallbackAgent, runGroqAgent } from "@/lib/server/llm";
import { loadContext, pay } from "@/lib/server/tools";

export const maxDuration = 60;

function json(body: AgentResponse, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  let body: AgentRequest;
  try {
    body = await request.json();
  } catch {
    return json({ reply: "", actions: [], engine: "direct", error: "Invalid JSON" }, 400);
  }

  // 1. Only the vault owner may drive their agent (they signed a session message with their wallet).
  const authError = await verifySession(body.owner, body.session);
  if (authError) return json({ reply: "", actions: [], engine: "direct", error: authError }, 401);

  try {
    // 2. Load the owner's vault and check it trusts this agent.
    const ctx = await loadContext(body.owner);
    if (typeof ctx === "string") return json({ reply: ctx, actions: [], engine: "direct" });

    // 3a. Demo: a fully compromised agent sends a malicious payment directly (no AI involved).
    if (body.mode === "compromised") {
      const action = await pay(ctx, { recipient: DEMO_ATTACKER, amount_sol: "5", memo: "pwned: drain vault" });
      return json({
        reply:
          action.kind === "blocked"
            ? `💀 Simulated a hacked agent sending 5 SOL to an attacker. Solana rejected it: ${action.error}.`
            : `Result: ${action.kind}${action.error ? `: ${action.error}` : ""}`,
        actions: [action],
        engine: "direct",
      });
    }

    // 3b. Normal chat: Groq with tools, falling back to the simple command reader.
    const text = String(body.text ?? "").trim();
    if (!text) return json({ reply: "Say something like “pay Alice 0.1 SOL for the logo”.", actions: [], engine: "direct" });
    const history = Array.isArray(body.history) ? body.history.filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string") : [];

    try {
      const result = await runGroqAgent(ctx, history, text);
      return json({ ...result, engine: "groq" });
    } catch (e) {
      console.warn("Groq unavailable, using fallback:", e instanceof Error ? e.message : e);
      const result = await runFallbackAgent(ctx, text);
      return json({ ...result, engine: "fallback" });
    }
  } catch (e) {
    // Details go to the private server logs only; visitors get a generic message so nothing sensitive can leak.
    const ref = Math.random().toString(36).slice(2, 8);
    console.error(`agent error [${ref}]`, e);
    return json({ reply: "", actions: [], engine: "direct", error: `The agent hit an internal error (ref ${ref}). Please try again.` }, 500);
  }
}

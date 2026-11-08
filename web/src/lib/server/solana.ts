import "server-only";

import {
  appendTransactionMessageInstructions,
  assertIsSendableTransaction,
  assertIsTransactionWithBlockhashLifetime,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  devnet,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";

import { RPC_URL, WS_URL } from "@/lib/config";
import { explainError, findLeashCode, leashErrorMessage } from "@/lib/leash";

export const rpc = createSolanaRpc(devnet(RPC_URL));
export const rpcSubscriptions = createSolanaRpcSubscriptions(devnet(WS_URL));
const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });

let agentSigner: Promise<KeyPairSigner> | null = null;

/** The agent's hot wallet. The secret only ever lives on the server (env var). */
export function getAgentSigner(): Promise<KeyPairSigner> {
  if (!agentSigner) {
    const raw = process.env.AGENT_SECRET_KEY;
    if (!raw) throw new Error("AGENT_SECRET_KEY is not set");
    agentSigner = createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(raw) as number[]));
  }
  return agentSigner;
}

export type TxResult = { ok: boolean; signature: string; error?: string };

/**
 * Sign with the agent key and send. skipPreflight=true on purpose: if the on-chain rules
 * reject the payment, the failed transaction still lands on Devnet as public proof.
 */
export async function sendAgentTransaction(instructions: Instruction[]): Promise<TxResult> {
  const signer = await getAgentSigner();
  const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const tx = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(tx);
  assertIsSendableTransaction(tx);
  assertIsTransactionWithBlockhashLifetime(tx);
  try {
    await sendAndConfirm(tx, { commitment: "confirmed", skipPreflight: true });
    return { ok: true, signature };
  } catch (e) {
    const code = findLeashCode(e);
    return { ok: false, signature, error: code !== undefined ? leashErrorMessage(code) : explainError(e) };
  }
}

"use client";

import { createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";

import { RPC_URL, WS_URL } from "./config";

/**
 * One Solana client for the whole app.
 * - walletSigner: Wallet Standard discovery (Phantom, Solflare, ...); the connected wallet signs and pays.
 * - solanaRpc: talks to Devnet. Version-0 transactions for the widest wallet support.
 */
export const client = createClient()
  .use(walletSigner({ chain: "solana:devnet" }))
  .use(
    solanaRpc({
      rpcUrl: RPC_URL,
      rpcSubscriptionsUrl: WS_URL,
      transactionConfig: { version: 0 },
    }),
  );

export type AppClient = typeof client;

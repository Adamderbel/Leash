use anchor_lang::prelude::*;

/// Seed for the Policy PDA: ["policy", owner]
#[constant]
pub const POLICY_SEED: &[u8] = b"policy";

/// Seed for the Vault PDA: ["vault", policy]
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// Seed for a PendingPayment PDA: ["pending", policy, id (u64 LE)]
#[constant]
pub const PENDING_SEED: &[u8] = b"pending";

/// Keep these in sync with the #[max_len] attributes in state.rs
pub const MAX_RECIPIENTS: usize = 10;
pub const MAX_LABEL_LEN: usize = 24;
pub const MAX_MEMO_LEN: usize = 64;

pub const SECONDS_PER_DAY: i64 = 86_400;

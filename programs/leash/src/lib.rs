pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("3FYwa35S5PAQZkqgXHEkTgB414P7j1zXAvwg6fX3YxV5");

/// Leash: give an AI agent a wallet whose spending rules are enforced on-chain.
#[program]
pub mod leash {
    use super::*;

    // ---- Owner: setup & funds ----
    pub fn initialize(
        ctx: Context<Initialize>,
        agent: Pubkey,
        per_tx_limit: u64,
        daily_limit: u64,
        approval_threshold: u64,
    ) -> Result<()> {
        instructions::initialize::handle_initialize(ctx, agent, per_tx_limit, daily_limit, approval_threshold)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::funds::handle_deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::funds::handle_withdraw(ctx, amount)
    }

    // ---- Owner: rules ----
    pub fn update_policy(
        ctx: Context<OwnerOnly>,
        agent: Pubkey,
        per_tx_limit: u64,
        daily_limit: u64,
        approval_threshold: u64,
    ) -> Result<()> {
        instructions::admin::handle_update_policy(ctx, agent, per_tx_limit, daily_limit, approval_threshold)
    }

    pub fn add_recipient(ctx: Context<OwnerOnly>, address: Pubkey, label: String) -> Result<()> {
        instructions::admin::handle_add_recipient(ctx, address, label)
    }

    pub fn remove_recipient(ctx: Context<OwnerOnly>, address: Pubkey) -> Result<()> {
        instructions::admin::handle_remove_recipient(ctx, address)
    }

    pub fn set_paused(ctx: Context<OwnerOnly>, paused: bool) -> Result<()> {
        instructions::admin::handle_set_paused(ctx, paused)
    }

    // ---- Agent ----
    pub fn agent_spend(ctx: Context<AgentSpend>, amount: u64, memo: String) -> Result<()> {
        instructions::agent::handle_agent_spend(ctx, amount, memo)
    }

    pub fn request_approval(ctx: Context<RequestApproval>, amount: u64, memo: String) -> Result<()> {
        instructions::agent::handle_request_approval(ctx, amount, memo)
    }

    // ---- Owner: approvals ----
    pub fn approve_payment(ctx: Context<ApprovePayment>) -> Result<()> {
        instructions::approvals::handle_approve_payment(ctx)
    }

    pub fn reject_payment(ctx: Context<RejectPayment>) -> Result<()> {
        instructions::approvals::handle_reject_payment(ctx)
    }
}

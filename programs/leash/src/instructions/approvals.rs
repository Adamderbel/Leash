use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::LeashError,
    instructions::vault_transfer,
    state::{vault_available, ApprovalResolved, PaymentSent, PendingPayment, Policy},
};

/// Owner approves a pending payment: SOL moves from the vault to the recipient.
#[derive(Accounts)]
pub struct ApprovePayment<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ LeashError::Unauthorized)]
    pub policy: Account<'info, Policy>,
    #[account(mut, seeds = [VAULT_SEED, policy.key().as_ref()], bump = policy.vault_bump)]
    pub vault: SystemAccount<'info>,
    #[account(
        mut,
        close = rent_payer,
        seeds = [PENDING_SEED, policy.key().as_ref(), &pending.id.to_le_bytes()],
        bump = pending.bump,
        has_one = policy @ LeashError::PendingMismatch,
        has_one = recipient @ LeashError::PendingMismatch,
        has_one = rent_payer @ LeashError::PendingMismatch,
    )]
    pub pending: Account<'info, PendingPayment>,
    /// CHECK: verified by has_one against pending.recipient
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    /// CHECK: verified by has_one against pending.rent_payer; receives the rent refund
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_approve_payment(ctx: Context<ApprovePayment>) -> Result<()> {
    let amount = ctx.accounts.pending.amount;
    let id = ctx.accounts.pending.id;
    let memo = ctx.accounts.pending.memo.clone();
    require!(
        amount <= vault_available(&ctx.accounts.vault.to_account_info())?,
        LeashError::InsufficientFunds
    );

    let now = Clock::get()?.unix_timestamp;
    let policy = &mut ctx.accounts.policy;
    // Owner-approved payments count toward today's spending but are not blocked by it.
    policy.roll_day(now);
    policy.spent_today = policy.spent_today.saturating_add(amount);
    policy.total_spent = policy.total_spent.saturating_add(amount);
    let policy_key = policy.key();
    let vault_bump = policy.vault_bump;

    vault_transfer(
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.recipient.to_account_info(),
        policy_key,
        vault_bump,
        amount,
    )?;

    emit!(PaymentSent {
        policy: policy_key,
        recipient: ctx.accounts.recipient.key(),
        amount,
        memo,
        by_agent: false,
    });
    emit!(ApprovalResolved { policy: policy_key, id, approved: true });
    Ok(())
}

/// Owner rejects a pending payment: nothing is paid, the request is deleted.
#[derive(Accounts)]
pub struct RejectPayment<'info> {
    pub owner: Signer<'info>,
    #[account(has_one = owner @ LeashError::Unauthorized)]
    pub policy: Account<'info, Policy>,
    #[account(
        mut,
        close = rent_payer,
        seeds = [PENDING_SEED, policy.key().as_ref(), &pending.id.to_le_bytes()],
        bump = pending.bump,
        has_one = policy @ LeashError::PendingMismatch,
        has_one = rent_payer @ LeashError::PendingMismatch,
    )]
    pub pending: Account<'info, PendingPayment>,
    /// CHECK: verified by has_one against pending.rent_payer; receives the rent refund
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,
}

pub fn handle_reject_payment(ctx: Context<RejectPayment>) -> Result<()> {
    emit!(ApprovalResolved {
        policy: ctx.accounts.policy.key(),
        id: ctx.accounts.pending.id,
        approved: false,
    });
    Ok(())
}

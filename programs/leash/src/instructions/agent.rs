use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::LeashError,
    instructions::vault_transfer,
    state::{vault_available, ApprovalRequested, PaymentSent, PendingPayment, Policy},
};

/// The agent pays a recipient directly. Every rule is checked here, on-chain.
#[derive(Accounts)]
pub struct AgentSpend<'info> {
    pub agent: Signer<'info>,
    #[account(mut, has_one = agent @ LeashError::UnauthorizedAgent)]
    pub policy: Account<'info, Policy>,
    #[account(mut, seeds = [VAULT_SEED, policy.key().as_ref()], bump = policy.vault_bump)]
    pub vault: SystemAccount<'info>,
    /// CHECK: must be on the policy's recipient list (checked in the handler)
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_agent_spend(ctx: Context<AgentSpend>, amount: u64, memo: String) -> Result<()> {
    require!(amount > 0, LeashError::ZeroAmount);
    require!(memo.len() <= MAX_MEMO_LEN, LeashError::MemoTooLong);

    let recipient_key = ctx.accounts.recipient.key();
    let available = vault_available(&ctx.accounts.vault.to_account_info())?;
    let now = Clock::get()?.unix_timestamp;
    let policy = &mut ctx.accounts.policy;

    // The rules, in order
    require!(!policy.paused, LeashError::Paused);
    require!(policy.is_allowed(&recipient_key), LeashError::RecipientNotAllowed);
    require!(amount <= policy.per_tx_limit, LeashError::ExceedsPerTxLimit);
    require!(amount <= policy.approval_threshold, LeashError::NeedsApproval);
    policy.roll_day(now);
    let new_spent = policy.spent_today.checked_add(amount).ok_or(LeashError::Overflow)?;
    require!(new_spent <= policy.daily_limit, LeashError::ExceedsDailyLimit);
    require!(amount <= available, LeashError::InsufficientFunds);

    policy.spent_today = new_spent;
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
        recipient: recipient_key,
        amount,
        memo,
        by_agent: true,
    });
    Ok(())
}

/// The agent asks the owner to approve a payment above the auto-approve threshold.
#[derive(Accounts)]
pub struct RequestApproval<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    #[account(mut, has_one = agent @ LeashError::UnauthorizedAgent)]
    pub policy: Account<'info, Policy>,
    #[account(
        init,
        payer = agent,
        space = 8 + PendingPayment::INIT_SPACE,
        seeds = [PENDING_SEED, policy.key().as_ref(), &policy.pending_count.to_le_bytes()],
        bump
    )]
    pub pending: Account<'info, PendingPayment>,
    /// CHECK: must be on the policy's recipient list (checked in the handler)
    pub recipient: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_request_approval(ctx: Context<RequestApproval>, amount: u64, memo: String) -> Result<()> {
    require!(amount > 0, LeashError::ZeroAmount);
    require!(memo.len() <= MAX_MEMO_LEN, LeashError::MemoTooLong);

    let recipient_key = ctx.accounts.recipient.key();
    let policy = &mut ctx.accounts.policy;
    require!(!policy.paused, LeashError::Paused);
    require!(policy.is_allowed(&recipient_key), LeashError::RecipientNotAllowed);
    require!(amount <= policy.per_tx_limit, LeashError::ExceedsPerTxLimit);

    let id = policy.pending_count;
    policy.pending_count = id.checked_add(1).ok_or(LeashError::Overflow)?;
    let policy_key = policy.key();

    let pending = &mut ctx.accounts.pending;
    pending.policy = policy_key;
    pending.id = id;
    pending.recipient = recipient_key;
    pending.amount = amount;
    pending.created_at = Clock::get()?.unix_timestamp;
    pending.rent_payer = ctx.accounts.agent.key();
    pending.bump = ctx.bumps.pending;
    pending.memo = memo.clone();

    emit!(ApprovalRequested {
        policy: policy_key,
        id,
        recipient: recipient_key,
        amount,
        memo,
    });
    Ok(())
}

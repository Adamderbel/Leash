use anchor_lang::prelude::*;

use crate::{
    constants::*,
    error::LeashError,
    state::{Policy, Recipient},
};

/// Shared accounts for every owner-only settings change.
#[derive(Accounts)]
pub struct OwnerOnly<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner @ LeashError::Unauthorized)]
    pub policy: Account<'info, Policy>,
}

pub fn handle_update_policy(
    ctx: Context<OwnerOnly>,
    agent: Pubkey,
    per_tx_limit: u64,
    daily_limit: u64,
    approval_threshold: u64,
) -> Result<()> {
    Policy::validate_limits(per_tx_limit, daily_limit, approval_threshold)?;
    let policy = &mut ctx.accounts.policy;
    policy.agent = agent;
    policy.per_tx_limit = per_tx_limit;
    policy.daily_limit = daily_limit;
    policy.approval_threshold = approval_threshold;
    Ok(())
}

pub fn handle_add_recipient(ctx: Context<OwnerOnly>, address: Pubkey, label: String) -> Result<()> {
    require!(label.len() <= MAX_LABEL_LEN, LeashError::LabelTooLong);
    let policy = &mut ctx.accounts.policy;
    require!(!policy.is_allowed(&address), LeashError::RecipientExists);
    require!(policy.recipients.len() < MAX_RECIPIENTS, LeashError::TooManyRecipients);
    policy.recipients.push(Recipient { address, label });
    Ok(())
}

pub fn handle_remove_recipient(ctx: Context<OwnerOnly>, address: Pubkey) -> Result<()> {
    let policy = &mut ctx.accounts.policy;
    let before = policy.recipients.len();
    policy.recipients.retain(|r| r.address != address);
    require!(policy.recipients.len() < before, LeashError::RecipientNotFound);
    Ok(())
}

/// Kill switch: freeze or unfreeze the agent.
pub fn handle_set_paused(ctx: Context<OwnerOnly>, paused: bool) -> Result<()> {
    ctx.accounts.policy.paused = paused;
    Ok(())
}

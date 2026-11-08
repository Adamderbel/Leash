use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::{
    constants::*,
    error::LeashError,
    instructions::vault_transfer,
    state::{vault_available, Policy},
};

/// Anyone can top up a vault.
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub policy: Account<'info, Policy>,
    #[account(mut, seeds = [VAULT_SEED, policy.key().as_ref()], bump = policy.vault_bump)]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, LeashError::ZeroAmount);
    let cpi_ctx = CpiContext::new(
        anchor_lang::system_program::ID,
        Transfer {
            from: ctx.accounts.depositor.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
        },
    );
    transfer(cpi_ctx, amount)
}

/// Only the owner can take SOL back out (no limits apply to the owner).
#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(has_one = owner @ LeashError::Unauthorized)]
    pub policy: Account<'info, Policy>,
    #[account(mut, seeds = [VAULT_SEED, policy.key().as_ref()], bump = policy.vault_bump)]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, LeashError::ZeroAmount);
    require!(
        amount <= vault_available(&ctx.accounts.vault.to_account_info())?,
        LeashError::InsufficientFunds
    );
    vault_transfer(
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.owner.to_account_info(),
        ctx.accounts.policy.key(),
        ctx.accounts.policy.vault_bump,
        amount,
    )
}

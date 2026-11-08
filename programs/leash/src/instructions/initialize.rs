use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::{constants::*, state::Policy};

/// Owner creates their Policy (rules) + Vault (holds SOL).
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Policy::INIT_SPACE,
        seeds = [POLICY_SEED, owner.key().as_ref()],
        bump
    )]
    pub policy: Account<'info, Policy>,
    #[account(mut, seeds = [VAULT_SEED, policy.key().as_ref()], bump)]
    pub vault: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize(
    ctx: Context<Initialize>,
    agent: Pubkey,
    per_tx_limit: u64,
    daily_limit: u64,
    approval_threshold: u64,
) -> Result<()> {
    Policy::validate_limits(per_tx_limit, daily_limit, approval_threshold)?;
    let now = Clock::get()?.unix_timestamp;

    let policy = &mut ctx.accounts.policy;
    policy.owner = ctx.accounts.owner.key();
    policy.agent = agent;
    policy.vault = ctx.accounts.vault.key();
    policy.per_tx_limit = per_tx_limit;
    policy.daily_limit = daily_limit;
    policy.approval_threshold = approval_threshold;
    policy.spent_today = 0;
    policy.day_start = now;
    policy.total_spent = 0;
    policy.pending_count = 0;
    policy.paused = false;
    policy.bump = ctx.bumps.policy;
    policy.vault_bump = ctx.bumps.vault;
    policy.recipients = Vec::new();

    // Seed the vault with the rent-exempt minimum so it can always hold SOL safely.
    let min = Rent::get()?.minimum_balance(0);
    let current = ctx.accounts.vault.lamports();
    if current < min {
        let cpi_ctx = CpiContext::new(
            anchor_lang::system_program::ID,
            Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        transfer(cpi_ctx, min - current)?;
    }

    msg!("Leash vault created for {}", policy.owner);
    Ok(())
}

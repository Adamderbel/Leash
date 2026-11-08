use anchor_lang::prelude::*;

use crate::{constants::*, error::LeashError};

/// One per owner. Holds the spending rules the agent must obey.
#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub owner: Pubkey,
    /// The only key allowed to call agent_spend / request_approval
    pub agent: Pubkey,
    pub vault: Pubkey,
    /// Hard cap for any single payment (lamports)
    pub per_tx_limit: u64,
    /// Max the agent can auto-spend per rolling day (lamports)
    pub daily_limit: u64,
    /// Payments above this need the owner's approval (lamports)
    pub approval_threshold: u64,
    pub spent_today: u64,
    pub day_start: i64,
    pub total_spent: u64,
    /// Counter used to derive PendingPayment addresses
    pub pending_count: u64,
    pub paused: bool,
    pub bump: u8,
    pub vault_bump: u8,
    #[max_len(10)]
    pub recipients: Vec<Recipient>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace, PartialEq, Eq, Debug)]
pub struct Recipient {
    pub address: Pubkey,
    #[max_len(24)]
    pub label: String,
}

impl Policy {
    pub fn validate_limits(per_tx_limit: u64, daily_limit: u64, approval_threshold: u64) -> Result<()> {
        require!(
            per_tx_limit > 0 && daily_limit > 0 && approval_threshold <= per_tx_limit,
            LeashError::InvalidLimits
        );
        Ok(())
    }

    pub fn is_allowed(&self, address: &Pubkey) -> bool {
        self.recipients.iter().any(|r| r.address == *address)
    }

    /// Reset the daily counter once 24h have passed since the window started.
    pub fn roll_day(&mut self, now: i64) {
        if now.saturating_sub(self.day_start) >= SECONDS_PER_DAY {
            self.day_start = now;
            self.spent_today = 0;
        }
    }
}

/// Created when the agent wants to pay more than the auto-approve threshold.
#[account]
#[derive(InitSpace)]
pub struct PendingPayment {
    pub policy: Pubkey,
    pub id: u64,
    pub recipient: Pubkey,
    pub amount: u64,
    pub created_at: i64,
    /// Who paid the rent for this account (refunded on approve/reject)
    pub rent_payer: Pubkey,
    pub bump: u8,
    #[max_len(64)]
    pub memo: String,
}

/// Lamports the vault can spend while staying rent-exempt.
pub fn vault_available(vault: &AccountInfo) -> Result<u64> {
    let min = Rent::get()?.minimum_balance(0);
    Ok(vault.lamports().saturating_sub(min))
}

#[event]
pub struct PaymentSent {
    pub policy: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub memo: String,
    /// true = agent auto-pay, false = owner-approved
    pub by_agent: bool,
}

#[event]
pub struct ApprovalRequested {
    pub policy: Pubkey,
    pub id: u64,
    pub recipient: Pubkey,
    pub amount: u64,
    pub memo: String,
}

#[event]
pub struct ApprovalResolved {
    pub policy: Pubkey,
    pub id: u64,
    pub approved: bool,
}

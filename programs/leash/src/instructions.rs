pub mod admin;
pub mod agent;
pub mod approvals;
pub mod funds;
pub mod initialize;

pub use admin::*;
pub use agent::*;
pub use approvals::*;
pub use funds::*;
pub use initialize::*;

use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

use crate::constants::VAULT_SEED;

/// Move lamports out of the vault PDA. The program signs for the vault using its seeds.
pub fn vault_transfer<'info>(
    vault: AccountInfo<'info>,
    to: AccountInfo<'info>,
    policy_key: Pubkey,
    vault_bump: u8,
    amount: u64,
) -> Result<()> {
    let bump = [vault_bump];
    let seeds: &[&[u8]] = &[VAULT_SEED, policy_key.as_ref(), &bump];
    let signer_seeds = &[seeds];
    let cpi_ctx = CpiContext::new_with_signer(
        anchor_lang::system_program::ID,
        Transfer { from: vault, to },
        signer_seeds,
    );
    transfer(cpi_ctx, amount)
}

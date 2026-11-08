use anchor_lang::prelude::*;

#[error_code]
pub enum LeashError {
    #[msg("Only the vault owner can do this")]
    Unauthorized,
    #[msg("This key is not the vault's authorized agent")]
    UnauthorizedAgent,
    #[msg("The agent is paused by the owner")]
    Paused,
    #[msg("Recipient is not on the approved list")]
    RecipientNotAllowed,
    #[msg("Amount exceeds the per-payment limit")]
    ExceedsPerTxLimit,
    #[msg("Amount is above the auto-approve threshold; owner approval required")]
    NeedsApproval,
    #[msg("Amount exceeds the remaining daily limit")]
    ExceedsDailyLimit,
    #[msg("Vault does not have enough SOL")]
    InsufficientFunds,
    #[msg("Invalid limits: need per_tx_limit > 0, daily_limit > 0 and approval_threshold <= per_tx_limit")]
    InvalidLimits,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Recipient list is full")]
    TooManyRecipients,
    #[msg("Recipient is already on the list")]
    RecipientExists,
    #[msg("Recipient not found")]
    RecipientNotFound,
    #[msg("Label is too long")]
    LabelTooLong,
    #[msg("Memo is too long")]
    MemoTooLong,
    #[msg("Account does not match the pending payment")]
    PendingMismatch,
    #[msg("Math overflow")]
    Overflow,
}

//! End-to-end rule tests for the Leash program, run in-process with LiteSVM.

use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const SOL: u64 = 1_000_000_000;

struct Env {
    svm: LiteSVM,
    owner: Keypair,
    agent: Keypair,
    alice: Keypair,
    policy: Pubkey,
    vault: Pubkey,
}

fn policy_pda(owner: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[leash::POLICY_SEED, owner.as_ref()], &leash::id()).0
}

fn vault_pda(policy: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[leash::VAULT_SEED, policy.as_ref()], &leash::id()).0
}

fn pending_pda(policy: &Pubkey, id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[leash::PENDING_SEED, policy.as_ref(), &id.to_le_bytes()],
        &leash::id(),
    )
    .0
}

/// Send a transaction; on failure return the program logs so tests can check the error name.
fn send(svm: &mut LiteSVM, ix: Instruction, payer: &Keypair, signers: &[&Keypair]) -> Result<(), String> {
    svm.expire_blockhash();
    let bh = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &bh);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), signers).unwrap();
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| e.meta.logs.join("\n"))
}

fn expect_err(res: Result<(), String>, name: &str) {
    match res {
        Ok(()) => panic!("expected error {name}, but transaction succeeded"),
        Err(logs) => assert!(logs.contains(name), "expected error {name}, got logs:\n{logs}"),
    }
}

fn balance(svm: &LiteSVM, key: &Pubkey) -> u64 {
    svm.get_account(key).map(|a| a.lamports).unwrap_or(0)
}

fn policy_state(svm: &LiteSVM, policy: &Pubkey) -> leash::Policy {
    let acc = svm.get_account(policy).unwrap();
    leash::Policy::try_deserialize(&mut acc.data.as_slice()).unwrap()
}

/// Limits used by most tests: max 1 SOL per payment, 1.5 SOL/day, auto-approve up to 0.5 SOL.
fn setup() -> Env {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/leash.so"));
    svm.add_program(leash::id(), bytes).unwrap();

    let owner = Keypair::new();
    let agent = Keypair::new();
    let alice = Keypair::new();
    svm.airdrop(&owner.pubkey(), 10 * SOL).unwrap();
    svm.airdrop(&agent.pubkey(), SOL).unwrap();
    svm.airdrop(&alice.pubkey(), SOL).unwrap();

    let policy = policy_pda(&owner.pubkey());
    let vault = vault_pda(&policy);

    let ix = Instruction::new_with_bytes(
        leash::id(),
        &leash::instruction::Initialize {
            agent: agent.pubkey(),
            per_tx_limit: SOL,
            daily_limit: 3 * SOL / 2,
            approval_threshold: SOL / 2,
        }
        .data(),
        leash::accounts::Initialize {
            owner: owner.pubkey(),
            policy,
            vault,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut svm, ix, &owner, &[&owner]).unwrap();

    let mut env = Env { svm, owner, agent, alice, policy, vault };
    deposit(&mut env, 5 * SOL);
    let alice_key = env.alice.pubkey();
    add_recipient(&mut env, alice_key, "Alice").unwrap();
    env
}

fn deposit(env: &mut Env, amount: u64) {
    let ix = Instruction::new_with_bytes(
        leash::id(),
        &leash::instruction::Deposit { amount }.data(),
        leash::accounts::Deposit {
            depositor: env.owner.pubkey(),
            policy: env.policy,
            vault: env.vault,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, &env.owner, &[&env.owner]).unwrap();
}

fn owner_ix(env: &Env, signer: &Keypair, data: Vec<u8>) -> Instruction {
    Instruction::new_with_bytes(
        leash::id(),
        &data,
        leash::accounts::OwnerOnly { owner: signer.pubkey(), policy: env.policy }.to_account_metas(None),
    )
}

fn add_recipient(env: &mut Env, address: Pubkey, label: &str) -> Result<(), String> {
    let ix = owner_ix(
        env,
        &env.owner,
        leash::instruction::AddRecipient { address, label: label.to_string() }.data(),
    );
    send(&mut env.svm, ix, &env.owner, &[&env.owner])
}

fn agent_spend_as(env: &mut Env, signer: &Keypair, to: Pubkey, amount: u64) -> Result<(), String> {
    let ix = Instruction::new_with_bytes(
        leash::id(),
        &leash::instruction::AgentSpend { amount, memo: "test".to_string() }.data(),
        leash::accounts::AgentSpend {
            agent: signer.pubkey(),
            policy: env.policy,
            vault: env.vault,
            recipient: to,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, signer, &[signer])
}

fn agent_spend(env: &mut Env, to: Pubkey, amount: u64) -> Result<(), String> {
    let agent = env.agent.insecure_clone();
    agent_spend_as(env, &agent, to, amount)
}

#[test]
fn happy_path_agent_pays_allowed_recipient() {
    let mut env = setup();
    let alice = env.alice.pubkey();
    let before = balance(&env.svm, &alice);

    agent_spend(&mut env, alice, SOL / 10).unwrap();

    assert_eq!(balance(&env.svm, &alice), before + SOL / 10);
    let p = policy_state(&env.svm, &env.policy);
    assert_eq!(p.spent_today, SOL / 10);
    assert_eq!(p.total_spent, SOL / 10);
    assert_eq!(p.recipients.len(), 1);
    assert_eq!(p.recipients[0].label, "Alice");
}

#[test]
fn rejects_unknown_recipient_prompt_injection() {
    let mut env = setup();
    let attacker = Keypair::new().pubkey();
    expect_err(agent_spend(&mut env, attacker, SOL / 10), "RecipientNotAllowed");
    assert_eq!(balance(&env.svm, &attacker), 0);
}

#[test]
fn rejects_over_per_tx_limit() {
    let mut env = setup();
    let alice = env.alice.pubkey();
    expect_err(agent_spend(&mut env, alice, 2 * SOL), "ExceedsPerTxLimit");
}

#[test]
fn large_payment_needs_owner_approval() {
    let mut env = setup();
    let alice = env.alice.pubkey();
    let amount = 8 * SOL / 10; // above 0.5 auto-approve, below 1.0 per-tx cap

    // Direct spend is refused...
    expect_err(agent_spend(&mut env, alice, amount), "NeedsApproval");

    // ...so the agent requests approval
    let pending = pending_pda(&env.policy, 0);
    let ix = Instruction::new_with_bytes(
        leash::id(),
        &leash::instruction::RequestApproval { amount, memo: "Logo design".to_string() }.data(),
        leash::accounts::RequestApproval {
            agent: env.agent.pubkey(),
            policy: env.policy,
            pending,
            recipient: alice,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, &env.agent, &[&env.agent]).unwrap();
    assert_eq!(policy_state(&env.svm, &env.policy).pending_count, 1);

    let approve = |signer: &Keypair| {
        Instruction::new_with_bytes(
            leash::id(),
            &leash::instruction::ApprovePayment {}.data(),
            leash::accounts::ApprovePayment {
                owner: signer.pubkey(),
                policy: env.policy,
                vault: env.vault,
                pending,
                recipient: alice,
                rent_payer: env.agent.pubkey(),
                system_program: system_program::ID,
            }
            .to_account_metas(None),
        )
    };

    // A stranger cannot approve
    let stranger = Keypair::new();
    env.svm.airdrop(&stranger.pubkey(), SOL).unwrap();
    let ix = approve(&stranger);
    expect_err(send(&mut env.svm, ix, &stranger, &[&stranger]), "Unauthorized");

    // The owner approves -> Alice is paid, pending account is closed
    let before = balance(&env.svm, &alice);
    let ix = approve(&env.owner);
    send(&mut env.svm, ix, &env.owner, &[&env.owner]).unwrap();
    assert_eq!(balance(&env.svm, &alice), before + amount);
    assert!(env.svm.get_account(&pending).map(|a| a.lamports == 0).unwrap_or(true));
}

#[test]
fn owner_can_reject_pending() {
    let mut env = setup();
    let alice = env.alice.pubkey();
    let pending = pending_pda(&env.policy, 0);
    let ix = Instruction::new_with_bytes(
        leash::id(),
        &leash::instruction::RequestApproval { amount: 9 * SOL / 10, memo: "?".to_string() }.data(),
        leash::accounts::RequestApproval {
            agent: env.agent.pubkey(),
            policy: env.policy,
            pending,
            recipient: alice,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, &env.agent, &[&env.agent]).unwrap();

    let before = balance(&env.svm, &alice);
    let ix = Instruction::new_with_bytes(
        leash::id(),
        &leash::instruction::RejectPayment {}.data(),
        leash::accounts::RejectPayment {
            owner: env.owner.pubkey(),
            policy: env.policy,
            pending,
            rent_payer: env.agent.pubkey(),
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, &env.owner, &[&env.owner]).unwrap();
    assert_eq!(balance(&env.svm, &alice), before);
    assert!(env.svm.get_account(&pending).map(|a| a.lamports == 0).unwrap_or(true));
}

#[test]
fn rejects_over_daily_limit() {
    let mut env = setup();
    let alice = env.alice.pubkey();
    // daily = 1.5 SOL, auto-approve = 0.5 SOL
    agent_spend(&mut env, alice, SOL / 2).unwrap();
    agent_spend(&mut env, alice, SOL / 2).unwrap();
    agent_spend(&mut env, alice, SOL / 2).unwrap();
    expect_err(agent_spend(&mut env, alice, SOL / 10), "ExceedsDailyLimit");
}

#[test]
fn paused_agent_cannot_spend() {
    let mut env = setup();
    let alice = env.alice.pubkey();
    let ix = owner_ix(&env, &env.owner, leash::instruction::SetPaused { paused: true }.data());
    send(&mut env.svm, ix, &env.owner, &[&env.owner]).unwrap();
    expect_err(agent_spend(&mut env, alice, SOL / 10), "Paused");

    let ix = owner_ix(&env, &env.owner, leash::instruction::SetPaused { paused: false }.data());
    send(&mut env.svm, ix, &env.owner, &[&env.owner]).unwrap();
    agent_spend(&mut env, alice, SOL / 10).unwrap();
}

#[test]
fn impostor_agent_and_stranger_withdraw_rejected() {
    let mut env = setup();
    let alice = env.alice.pubkey();
    let impostor = Keypair::new();
    env.svm.airdrop(&impostor.pubkey(), SOL).unwrap();
    expect_err(agent_spend_as(&mut env, &impostor, alice, SOL / 10), "UnauthorizedAgent");

    // Stranger tries to withdraw
    let ix = Instruction::new_with_bytes(
        leash::id(),
        &leash::instruction::Withdraw { amount: SOL }.data(),
        leash::accounts::Withdraw {
            owner: impostor.pubkey(),
            policy: env.policy,
            vault: env.vault,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    expect_err(send(&mut env.svm, ix, &impostor, &[&impostor]), "Unauthorized");

    // Owner withdraws fine
    let before = balance(&env.svm, &env.vault);
    let ix = Instruction::new_with_bytes(
        leash::id(),
        &leash::instruction::Withdraw { amount: SOL }.data(),
        leash::accounts::Withdraw {
            owner: env.owner.pubkey(),
            policy: env.policy,
            vault: env.vault,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    );
    send(&mut env.svm, ix, &env.owner, &[&env.owner]).unwrap();
    assert_eq!(balance(&env.svm, &env.vault), before - SOL);
}

#[test]
fn owner_manages_recipients_and_limits() {
    let mut env = setup();
    let alice = env.alice.pubkey();
    expect_err(add_recipient(&mut env, alice, "Alice again"), "RecipientExists");
    expect_err(add_recipient(&mut env, Keypair::new().pubkey(), "a-very-long-label-over-24-chars"), "LabelTooLong");

    // Invalid limits: threshold above per-tx cap
    let agent = env.agent.pubkey();
    let ix = owner_ix(
        &env,
        &env.owner,
        leash::instruction::UpdatePolicy { agent, per_tx_limit: SOL, daily_limit: SOL, approval_threshold: 2 * SOL }.data(),
    );
    expect_err(send(&mut env.svm, ix, &env.owner, &[&env.owner]), "InvalidLimits");

    // Remove Alice -> agent can no longer pay her
    let ix = owner_ix(&env, &env.owner, leash::instruction::RemoveRecipient { address: alice }.data());
    send(&mut env.svm, ix, &env.owner, &[&env.owner]).unwrap();
    expect_err(agent_spend(&mut env, alice, SOL / 10), "RecipientNotAllowed");
}

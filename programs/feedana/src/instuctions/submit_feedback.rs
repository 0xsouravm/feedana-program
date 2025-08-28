use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction::transfer;

use crate::types::FeedbackBoard;
use crate::errors::FeedbackBoardError::*;
use crate::events::FeedbackSubmitted;

const PLATFORM_FEE_WALLET: &str = "96fN4Eegj84PaUcyEJrxUztDjo7Q7MySJzV2skLfgchY";

pub fn submit_feedback(ctx: Context<SubmitFeedback>, new_ipfs_cid: String) -> Result<()> {
    // Validation: Check if ipfs_cid is empty
    if new_ipfs_cid.trim().is_empty() {
        return Err(EmptyIpfsCid.into());
    }

    // Validation: Check IPFS CID length (typical IPFS CIDs are 32-64 characters)
    if new_ipfs_cid.len() < 32 || new_ipfs_cid.len() > 64 {
        return Err(InvalidIpfsCidLength.into());
    }

    // Validation: Basic IPFS CID format check (should start with Qm for base58 or b for base32)
    if !new_ipfs_cid.starts_with("Qm") && !new_ipfs_cid.starts_with("b") {
        return Err(InvalidIpfsCid.into());
    }

    let feedback_board = &mut ctx.accounts.feedback_board;

    // Validation: Check if the feedback giver is not the board creator
    if feedback_board.creator == ctx.accounts.feedback_giver.key() {
        return Err(CreatorCannotSubmit.into());
    }

    // Validation: Check if the board is archived
    if feedback_board.is_archived {
        return Err(CannotSubmitToArchivedBoard.into());
    }

    // Fixed platform fee for feedback submission: 1 lamport
    const PLATFORM_FEE_SUBMIT_FEEDBACK: u64 = 1;

    // Transfer platform fee via CPI
    let ix = transfer(
        &ctx.accounts.feedback_giver.key(),
        &ctx.accounts.platform_wallet.key(),
        PLATFORM_FEE_SUBMIT_FEEDBACK,
    );

    invoke(
        &ix,
        &[
            ctx.accounts.feedback_giver.to_account_info(),
            ctx.accounts.platform_wallet.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    // Update IPFS CID with new feedback data
    feedback_board.ipfs_cid = new_ipfs_cid;

    msg!(
        "Feedback submitted. Updated IPFS CID: {}",
        feedback_board.ipfs_cid
    );

    // Emit event
    emit!(FeedbackSubmitted {
        board_id: feedback_board.board_id.clone(),
        new_ipfs_cid: feedback_board.ipfs_cid.clone(),
        feedback_giver: ctx.accounts.feedback_giver.key(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SubmitFeedback<'info> {
    #[account(
        mut,
        seeds = [b"feedback_board", feedback_board.creator.as_ref(), feedback_board.board_id.as_bytes()],
        bump
    )]
    pub feedback_board: Account<'info, FeedbackBoard>,

    #[account(mut)]
    pub feedback_giver: Signer<'info>,

    /// CHECK: This is safe as we're only transferring to this hardcoded address
    #[account(
        mut,
        address = PLATFORM_FEE_WALLET.parse::<Pubkey>().unwrap()
    )]
    pub platform_wallet: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

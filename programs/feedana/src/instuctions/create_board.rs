use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction::transfer;

use crate::types::FeedbackBoard;
use crate::errors::FeedbackBoardError::*;

const PLATFORM_FEE_WALLET: &str = "96fN4Eegj84PaUcyEJrxUztDjo7Q7MySJzV2skLfgchY";

pub fn create_feedback_board(
    ctx: Context<CreateFeedbackBoard>,
    board_id: String,
    ipfs_cid: String,
) -> Result<()> {
    // Validation: Check if board_id is empty
    if board_id.trim().is_empty() {
        return Err(EmptyBoardId.into());
    }

    // Validation: Check if board_id is too long (max 32 chars for efficiency)
    if board_id.len() > 32 {
        return Err(BoardIdTooLong.into());
    }

    // Validation: Check if board_id contains only valid characters (alphanumeric and hyphens)
    if !board_id.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err(InvalidBoardIdChars.into());
    }

    // Validation: Check if ipfs_cid is empty
    if ipfs_cid.trim().is_empty() {
        return Err(EmptyIpfsCid.into());
    }

    // Validation: Check IPFS CID length (typical IPFS CIDs are 32-64 characters)
    if ipfs_cid.len() < 32 || ipfs_cid.len() > 64 {
        return Err(InvalidIpfsCidLength.into());
    }

    // Validation: Basic IPFS CID format check (should start with Qm for base58 or b for base32)
    if !ipfs_cid.starts_with("Qm") && !ipfs_cid.starts_with("b") {
        return Err(InvalidIpfsCid.into());
    }

    let feedback_board = &mut ctx.accounts.feedback_board;

    // Initialize feedback board
    feedback_board.creator = ctx.accounts.creator.key();
    feedback_board.ipfs_cid = ipfs_cid;
    feedback_board.board_id = board_id;

    // Fixed platform fee for board creation: 10 lamports
    const PLATFORM_FEE_CREATE_BOARD: u64 = 10;

    // Transfer platform fee via CPI
    let ix = transfer(
        &ctx.accounts.creator.key(),
        &ctx.accounts.platform_wallet.key(),
        PLATFORM_FEE_CREATE_BOARD,
    );

    invoke(
        &ix,
        &[
            ctx.accounts.creator.to_account_info(),
            ctx.accounts.platform_wallet.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
    )?;

    msg!(
        "Feedback board created with IPFS CID: {}",
        feedback_board.ipfs_cid
    );
    Ok(())
}

#[derive(Accounts)]
#[instruction(board_id: String)]
pub struct CreateFeedbackBoard<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 64 + 32, // discriminator + creator pubkey + ipfs_cid + board_id
        seeds = [b"feedback_board", creator.key().as_ref(), board_id.as_bytes()],
        bump
    )]
    pub feedback_board: Account<'info, FeedbackBoard>,

    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: This is safe as we're only transferring to this hardcoded address
    #[account(
        mut,
        address = PLATFORM_FEE_WALLET.parse::<Pubkey>().unwrap()
    )]
    pub platform_wallet: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

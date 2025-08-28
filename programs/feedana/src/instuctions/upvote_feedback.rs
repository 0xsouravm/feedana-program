use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::FeedbackBoardError;
use crate::events::FeedbackUpvoted;
use crate::types::FeedbackBoard;

const PLATFORM_FEE_WALLET: &str = "96fN4Eegj84PaUcyEJrxUztDjo7Q7MySJzV2skLfgchY";

#[derive(Accounts)]
pub struct UpvoteFeedback<'info> {
    #[account(
        mut,
        seeds = [
            b"feedback_board",
            feedback_board.creator.as_ref(),
            feedback_board.board_id.as_bytes()
        ],
        bump
    )]
    pub feedback_board: Account<'info, FeedbackBoard>,

    #[account(mut)]
    pub voter: Signer<'info>,

    #[account(
        mut,
        address = PLATFORM_FEE_WALLET.parse::<Pubkey>().unwrap()
    )]
    pub platform_wallet: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn upvote_feedback(ctx: Context<UpvoteFeedback>, new_ipfs_cid: String) -> Result<()> {
    let feedback_board = &mut ctx.accounts.feedback_board;

    // Validate that the board is not archived
    if feedback_board.is_archived {
        return Err(FeedbackBoardError::CannotUpvoteInArchivedBoard.into());
    }

    // Validate IPFS CID (reuse validation from submit_feedback)
    if new_ipfs_cid.is_empty() {
        return Err(FeedbackBoardError::EmptyIpfsCid.into());
    }

    if new_ipfs_cid.len() < 32 || new_ipfs_cid.len() > 64 {
        return Err(FeedbackBoardError::InvalidIpfsCidLength.into());
    }

    if !new_ipfs_cid.starts_with("Qm") && !new_ipfs_cid.starts_with("b") {
        return Err(FeedbackBoardError::InvalidIpfsCid.into());
    }

    // Transfer platform fee (1 lamport)
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.voter.to_account_info(),
                to: ctx.accounts.platform_wallet.to_account_info(),
            },
        ),
        1,
    )?;

    // Update the IPFS CID
    feedback_board.ipfs_cid = new_ipfs_cid.clone();

    // Emit event
    emit!(FeedbackUpvoted {
        board_id: feedback_board.board_id.clone(),
        new_ipfs_cid,
        voter: ctx.accounts.voter.key(),
    });

    Ok(())
}
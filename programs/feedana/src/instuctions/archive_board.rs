use anchor_lang::prelude::*;

use crate::types::FeedbackBoard;
use crate::errors::FeedbackBoardError::*;
use crate::events::FeedbackBoardArchived;

pub fn archive_feedback_board(ctx: Context<ArchiveFeedbackBoard>) -> Result<()> {
    let feedback_board = &mut ctx.accounts.feedback_board;

    // Validation: Check if the signer is the board creator
    if feedback_board.creator != ctx.accounts.creator.key() {
        return Err(UnauthorizedAccess.into());
    }

    // Validation: Check if board is already archived
    if feedback_board.is_archived {
        return Err(BoardAlreadyArchived.into());
    }

    // Archive the board
    feedback_board.is_archived = true;

    msg!(
        "Feedback board '{}' has been archived by creator: {}",
        feedback_board.board_id,
        feedback_board.creator
    );

    // Emit event
    emit!(FeedbackBoardArchived {
        creator: feedback_board.creator,
        board_id: feedback_board.board_id.clone(),
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ArchiveFeedbackBoard<'info> {
    #[account(
        mut,
        seeds = [b"feedback_board", feedback_board.creator.as_ref(), feedback_board.board_id.as_bytes()],
        bump
    )]
    pub feedback_board: Account<'info, FeedbackBoard>,

    #[account(mut)]
    pub creator: Signer<'info>,
}
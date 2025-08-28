use anchor_lang::prelude::*;

declare_id!("3TwZoBQB7g8roimCHwUW7JTEHjGeZwvjcdQM5AeddqMY");

// Module declarations
pub mod errors;
pub mod events;
pub mod instuctions;
pub mod types;

use instuctions::*;

#[program]
pub mod feedana {
    use super::*;

    pub fn create_feedback_board(
        ctx: Context<CreateFeedbackBoard>,
        board_id: String,
        ipfs_cid: String,
    ) -> Result<()> {
        instuctions::create_board::create_feedback_board(ctx, board_id, ipfs_cid)
    }

    pub fn submit_feedback(ctx: Context<SubmitFeedback>, new_ipfs_cid: String) -> Result<()> {
        instuctions::submit_feedback::submit_feedback(ctx, new_ipfs_cid)
    }

    pub fn archive_feedback_board(ctx: Context<ArchiveFeedbackBoard>) -> Result<()> {
        instuctions::archive_board::archive_feedback_board(ctx)
    }

    pub fn upvote_feedback(ctx: Context<UpvoteFeedback>, new_ipfs_cid: String) -> Result<()> {
        instuctions::upvote_feedback::upvote_feedback(ctx, new_ipfs_cid)
    }

    pub fn downvote_feedback(ctx: Context<DownvoteFeedback>, new_ipfs_cid: String) -> Result<()> {
        instuctions::downvote_feedback::downvote_feedback(ctx, new_ipfs_cid)
    }
}

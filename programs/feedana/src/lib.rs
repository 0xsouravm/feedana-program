use anchor_lang::prelude::*;

declare_id!("8YsNicGdBn86spF22Kk4rTB59HpGrs1wWGUedjuEr2U5");

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
}

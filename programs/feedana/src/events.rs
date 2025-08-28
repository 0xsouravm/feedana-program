use anchor_lang::prelude::*;

#[event]
pub struct FeedbackBoardCreated {
    pub creator: Pubkey,
    pub board_id: String,
    pub ipfs_cid: String,
}

#[event]
pub struct FeedbackSubmitted {
    pub board_id: String,
    pub new_ipfs_cid: String,
    pub feedback_giver: Pubkey,
}

#[event]
pub struct FeedbackBoardArchived {
    pub creator: Pubkey,
    pub board_id: String,
}

#[event]
pub struct FeedbackUpvoted {
    pub board_id: String,
    pub new_ipfs_cid: String,
    pub voter: Pubkey,
}

#[event]
pub struct FeedbackDownvoted {
    pub board_id: String,
    pub new_ipfs_cid: String,
    pub voter: Pubkey,
}

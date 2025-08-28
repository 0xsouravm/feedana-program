use anchor_lang::prelude::*;

#[account]
pub struct FeedbackBoard {
    pub creator: Pubkey,  // 32 bytes
    pub ipfs_cid: String, // 4 + up to 60 bytes (IPFS CIDs are typically ~46 chars)
    pub board_id: String, // 4 + up to 28 bytes
    pub is_archived: bool, // 1 byte
}

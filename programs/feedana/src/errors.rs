use anchor_lang::prelude::*;

#[error_code]
pub enum FeedbackBoardError {
    #[msg("Invalid IPFS CID format")]
    InvalidIpfsCid,
    #[msg("Board ID too long")]
    BoardIdTooLong,
    #[msg("Board ID cannot be empty")]
    EmptyBoardId,
    #[msg("IPFS CID cannot be empty")]
    EmptyIpfsCid,
    #[msg("Feedback board already exists for this creator and board ID")]
    DuplicateFeedbackBoard,
    #[msg("Insufficient funds to create feedback board")]
    InsufficientFunds,
    #[msg("Invalid IPFS CID length - must be between 32 and 64 characters")]
    InvalidIpfsCidLength,
    #[msg("Board ID contains invalid characters - only alphanumeric and hyphens allowed")]
    InvalidBoardIdChars,
    #[msg("Feedback board does not exist")]
    FeedbackBoardNotFound,
    #[msg("Unauthorized access - only the creator can modify this board")]
    UnauthorizedAccess,
    #[msg("The board creator cannot submit a feedback in their own board")]
    CreatorCannotSubmit,
    #[msg("Feedback board is already archived")]
    BoardAlreadyArchived,
    #[msg("Cannot submit feedback to archived board")]
    CannotSubmitToArchivedBoard,
}

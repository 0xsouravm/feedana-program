# Feedana Program

[![Solana](https://img.shields.io/badge/Solana-9945FF?style=for-the-badge&logo=solana&logoColor=white)](https://solana.com/)
[![Anchor](https://img.shields.io/badge/Anchor-663399?style=for-the-badge&logo=anchor&logoColor=white)](https://www.anchor-lang.com/)
[![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![IPFS](https://img.shields.io/badge/IPFS-65C2CB?style=for-the-badge&logo=ipfs&logoColor=white)](https://ipfs.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Feedana** is a decentralized feedback collection platform built on the Solana blockchain using the Anchor framework. It enables creators to collect feedback in a trustless, transparent manner while leveraging IPFS for decentralized data storage.

## 📋 Table of Contents

- [🌟 Features](#🌟-features)
- [🏗️ Architecture](#🏗️-architecture)
- [💰 Fee Structure](#💰-fee-structure)
- [🔒 Security Features](#🔒-security-features)
- [🧪 Testing](#🧪-testing)
- [🌐 Frontend Integration](#🌐-frontend-integration)
- [📁 Project Structure](#📁-project-structure)
- [🔗 Related Links](#🔗-related-links)
- [📋 API Reference](#📋-api-reference)
- [🤝 Contributing](#🤝-contributing)
- [📄 License](#📄-license)

## 🌟 Features

- **Decentralized Feedback Boards**: Create feedback boards with unique identifiers
- **IPFS Integration**: Store feedback data on IPFS for decentralized, immutable storage
- **Platform Fees**: Built-in fee structure to support platform sustainability
- **Secure Validation**: Comprehensive input validation for board IDs and IPFS CIDs
- **Program Derived Addresses (PDAs)**: Deterministic addressing for feedback boards
- **Cross-Platform Compatibility**: Works with any Solana-compatible wallet

## 🏗️ Architecture

### Program ID
- **Devnet/Localnet**: `3TwZoBQB7g8roimCHwUW7JTEHjGeZwvjcdQM5AeddqMY`

### Data Structure

```rust
pub struct FeedbackBoard {
    pub creator: Pubkey,     // 32 bytes - Board creator's public key
    pub ipfs_cid: String,    // 4 + up to 60 bytes - IPFS content identifier
    pub board_id: String,    // 4 + up to 28 bytes - Human-readable board identifier
}
```

### Core Instructions

1. **create_feedback_board**: Creates a new feedback board with platform fee payment
2. **submit_feedback**: Updates existing board with new feedback data

## 💰 Fee Structure

| Action | Fee | Description |
|--------|-----|-------------|
| Create Board | 10 lamports | One-time fee for creating a feedback board |
| Submit Feedback | 1 lamport | Fee per feedback submission |

**Platform Wallet**: `96fN4Eegj84PaUcyEJrxUztDjo7Q7MySJzV2skLfgchY`

## 🔒 Security Features

### Input Validation

- **Board ID**: 1-32 characters, alphanumeric and hyphens/underscores only
- **IPFS CID**: 32-64 characters, must start with "Qm" (base58) or "b" (base32)
- **Duplicate Prevention**: Uses PDAs to prevent duplicate boards per creator
- **Creator Restriction**: Board creators cannot submit feedback on their own boards

### Error Handling

The program includes comprehensive error codes:

```rust
pub enum FeedbackBoardError {
    InvalidIpfsCid,
    BoardIdTooLong,
    EmptyBoardId,
    EmptyIpfsCid,
    DuplicateFeedbackBoard,
    InsufficientFunds,
    InvalidIpfsCidLength,
    InvalidBoardIdChars,
    FeedbackBoardNotFound,
    UnauthorizedAccess,
    CreatorCannotSubmit,
}
```

### Events

The program emits events for important state changes:

```rust
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
```

## 🧪 Testing

The test suite covers:

- ✅ Successful board creation and feedback submission with event verification
- ✅ Input validation (empty/invalid board IDs and IPFS CIDs)
- ✅ Board ID length and character validation
- ✅ Creator self-feedback prevention (CreatorCannotSubmit)
- ✅ Duplicate board prevention
- ✅ Insufficient funds handling
- ✅ Platform fee verification
- ✅ Multiple feedback submissions
- ✅ Non-existent board handling
- ✅ Event emission verification

Run the complete test suite:

```bash
yarn test
# or
npm run test
```

## 🌐 Frontend Integration

**Frontend Repository**: [Feedana UI](https://github.com/0xsouravm/feedana-ui)

The frontend provides a user-friendly interface for:
- Creating and managing feedback boards
- Submitting feedback with rich text editing
- Viewing feedback history
- Wallet integration for Solana payments

## 📁 Project Structure

```
feedana-program/
├── programs/
│   └── feedana/
│       ├── src/
│       │   ├── lib.rs              # Main program entry point
│       │   ├── types.rs            # Data structures
│       │   ├── errors.rs           # Custom error definitions
│       │   ├── events.rs           # Event definitions 
│       │   └── instructions/
│       │       ├── mod.rs
│       │       ├── create_board.rs # Board creation logic
│       │       └── submit_feedback.rs # Feedback submission logic
│       ├── Cargo.toml
│       └── Xargo.toml
├── tests/
│   └── feedana.ts                  # Comprehensive test suite
├── migrations/
│   └── deploy.ts                   # Deployment script
├── Anchor.toml                     # Anchor configuration
├── package.json                    # Node.js dependencies
└── tsconfig.json                   # TypeScript configuration
```

## 🔗 Related Links

- **Frontend Application**: [Feedana UI](https://github.com/0xsouravm/feedana-ui)
- **Anchor Framework**: [https://www.anchor-lang.com/](https://www.anchor-lang.com/)
- **Solana Documentation**: [https://docs.solana.com/](https://docs.solana.com/)
- **IPFS Documentation**: [https://docs.ipfs.io/](https://docs.ipfs.io/)

## 📋 API Reference

### Instructions

#### `create_feedback_board`
Creates a new feedback board with the specified board ID and initial IPFS CID.

**Parameters:**
- `board_id`: String (1-32 chars, alphanumeric + hyphens/underscores)
- `ipfs_cid`: String (32-64 chars, valid IPFS CID format)

**Accounts:**
- `feedback_board`: PDA account to be created
- `creator`: Signer and payer
- `platform_wallet`: Platform fee recipient
- `system_program`: System program for account creation

**Fee:** 10 lamports

#### `submit_feedback`
Updates an existing feedback board with new IPFS CID containing updated feedback data.

**Parameters:**
- `new_ipfs_cid`: String (32-64 chars, valid IPFS CID format)

**Accounts:**
- `feedback_board`: Existing feedback board PDA
- `feedback_giver`: Signer and fee payer
- `platform_wallet`: Platform fee recipient
- `system_program`: System program for fee transfer

**Fee:** 1 lamport

### PDA Seeds

Feedback boards use the following seed structure:
```
["feedback_board", creator_pubkey, board_id]
```

This ensures:
- Deterministic addressing
- Creator can have multiple boards with different IDs
- No collision between different creators

### Events

The program emits the following events:

#### `FeedbackBoardCreated`
Emitted when a new feedback board is successfully created.

**Fields:**
- `creator`: Pubkey - The public key of the board creator
- `board_id`: String - The unique identifier of the board
- `ipfs_cid`: String - The initial IPFS content identifier

#### `FeedbackSubmitted`
Emitted when feedback is successfully submitted to a board.

**Fields:**
- `board_id`: String - The identifier of the feedback board
- `new_ipfs_cid`: String - The updated IPFS content identifier
- `feedback_giver`: Pubkey - The public key of the feedback submitter

These events can be consumed by frontend applications for real-time updates and analytics tracking.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## ⚠️ Disclaimer

This is educational/demonstration software. Use at your own risk. Always audit smart contracts before deploying to mainnet with significant funds.
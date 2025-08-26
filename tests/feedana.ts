import * as anchor from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { assert } from "chai";
import { Feedana } from "../target/types/feedana";
import { Program } from "@coral-xyz/anchor";

describe("feedana", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);

  const program = anchor.workspace.Feedana as Program<Feedana>;
  
  // Test accounts
  const creator = anchor.web3.Keypair.generate();
  const feedbackGiver = anchor.web3.Keypair.generate();
  const platformWallet = new PublicKey("96fN4Eegj84PaUcyEJrxUztDjo7Q7MySJzV2skLfgchY");

  // Test data
  const boardId = "test-board-1";
  const initialIpfsCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"; // Valid 46-char IPFS CID
  const updatedIpfsCid = "QmPGBVJFnXhYMSuNcbswQRJWtqRznUvKQPZF9EfAb3Tx4M"; // Valid 46-char IPFS CID

  before(async () => {    
    // Airdrop SOL to test accounts
    await airdrop(provider.connection, creator.publicKey);
    await airdrop(provider.connection, feedbackGiver.publicKey);
    
    // Airdrop SOL to platform wallet to ensure it can receive transfers
    await airdrop(provider.connection, platformWallet, 10 * anchor.web3.LAMPORTS_PER_SOL);
  });

  it("Creates a feedback board", async () => {
    // Derive the PDA for the feedback board
    const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        creator.publicKey.toBuffer(),
        Buffer.from(boardId),
      ],
      program.programId
    );

    // Get initial balances
    const initialCreatorBalance = await provider.connection.getBalance(creator.publicKey);
    const initialPlatformBalance = await provider.connection.getBalance(platformWallet);

    // Create feedback board
    const tx = await program.methods
      .createFeedbackBoard(boardId, initialIpfsCid)
      .accounts({
        feedbackBoard: feedbackBoardPda,
        creator: creator.publicKey,
        platformWallet: platformWallet,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    console.log("Create feedback board transaction:", tx);

    // Verify the feedback board account was created
    const feedbackBoardAccount = await program.account.feedbackBoard.fetch(feedbackBoardPda);
    
    assert.equal(feedbackBoardAccount.creator.toString(), creator.publicKey.toString());
    assert.equal(feedbackBoardAccount.ipfsCid, initialIpfsCid);
    assert.equal(feedbackBoardAccount.boardId, boardId);

    // Verify balance changes after successful board creation
    const finalCreatorBalance = await provider.connection.getBalance(creator.publicKey);
    const finalPlatformBalance = await provider.connection.getBalance(platformWallet);
    
    // Calculate actual balance changes
    const creatorBalanceDecrease = initialCreatorBalance - finalCreatorBalance;
    const platformBalanceIncrease = finalPlatformBalance - initialPlatformBalance;
    
    console.log(`=== BOARD CREATION BALANCE VERIFICATION ===`);
    console.log(`Creator balance: ${initialCreatorBalance} -> ${finalCreatorBalance}`);
    console.log(`Creator decrease: ${creatorBalanceDecrease} lamports`);
    console.log(`Platform balance: ${initialPlatformBalance} -> ${finalPlatformBalance}`);
    console.log(`Platform increase: ${platformBalanceIncrease} lamports`);
    
    // CRITICAL: Platform account must have received exactly 10 lamports
    assert.equal(platformBalanceIncrease, 10, "Platform wallet must receive exactly 10 lamports platform fee");
    
    // CRITICAL: Creator account must have decreased by at least 10 lamports (platform fee + transaction costs)
    assert.isTrue(creatorBalanceDecrease >= 10, `Creator balance must decrease by at least 10 lamports (platform fee), actual decrease: ${creatorBalanceDecrease}`);
    
    console.log(`✅ Board creation balance verification passed`);
  });

  it("Fails to create feedback board with empty board ID", async () => {
    const emptyBoardId = "";
    const validIpfsCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    
    // Derive the PDA for the feedback board with empty ID
    const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        creator.publicKey.toBuffer(),
        Buffer.from(emptyBoardId),
      ],
      program.programId
    );

    try {
      await program.methods
        .createFeedbackBoard(emptyBoardId, validIpfsCid)
        .accounts({
          feedbackBoard: feedbackBoardPda,
          creator: creator.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
      
      assert.fail("Should have failed when creating board with empty ID");
    } catch (error) {
      // Should fail due to empty board ID
      console.log("Expected error for empty board ID:", error.message);
      assert.include(error.toString().toLowerCase(), "empty");
    }
  });

  it("Fails to create feedback board with empty IPFS CID", async () => {
    const validBoardId = "test-board-empty-cid";
    const emptyIpfsCid = "";
    
    // Derive the PDA for the feedback board
    const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        creator.publicKey.toBuffer(),
        Buffer.from(validBoardId),
      ],
      program.programId
    );

    try {
      await program.methods
        .createFeedbackBoard(validBoardId, emptyIpfsCid)
        .accounts({
          feedbackBoard: feedbackBoardPda,
          creator: creator.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
      
      assert.fail("Should have failed when creating board with empty IPFS CID");
    } catch (error) {
      // Should fail due to empty IPFS CID
      console.log("Expected error for empty IPFS CID:", error.message);
      assert.include(error.toString().toLowerCase(), "empty");
    }
  });

  it("Fails to create duplicate feedback board", async () => {
    const duplicateBoardId = boardId; // Use the same board ID from the first test
    const duplicateIpfsCid = "QmTestDuplicateCid987654321";
    
    // Derive the PDA for the duplicate feedback board (same as first test)
    const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        creator.publicKey.toBuffer(),
        Buffer.from(duplicateBoardId),
      ],
      program.programId
    );

    try {
      await program.methods
        .createFeedbackBoard(duplicateBoardId, duplicateIpfsCid)
        .accounts({
          feedbackBoard: feedbackBoardPda,
          creator: creator.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([creator])
        .rpc();
      
      assert.fail("Should have failed when creating duplicate board");
    } catch (error) {
      // Should fail because account already exists
      console.log("Expected error for duplicate board:", error.message);
      assert.include(error.toString().toLowerCase(), "already in use");
    }
  });

  it("Fails to create feedback board with insufficient funds", async () => {
    const poorCreator = anchor.web3.Keypair.generate();
    const testBoardId = "test-board-poor";
    const testIpfsCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    
    // Give minimal funds to creator (less than needed for account creation + fees)
    await airdrop(provider.connection, poorCreator.publicKey, 0.001 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Derive the PDA for the feedback board
    const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        poorCreator.publicKey.toBuffer(),
        Buffer.from(testBoardId),
      ],
      program.programId
    );

    try {
      await program.methods
        .createFeedbackBoard(testBoardId, testIpfsCid)
        .accounts({
          feedbackBoard: feedbackBoardPda,
          creator: poorCreator.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([poorCreator])
        .rpc();
      
      assert.fail("Should have failed when creator has insufficient funds");
    } catch (error) {
      // Should fail due to insufficient funds
      console.log("Expected error for insufficient funds:", error.message);
      assert.include(error.toString().toLowerCase(), "insufficient");
    }
  });

  it("Submits feedback and updates IPFS CID", async () => {
    // Derive the PDA for the feedback board (using the board created in the first test)
    const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        creator.publicKey.toBuffer(),
        Buffer.from(boardId),
      ],
      program.programId
    );

    // Get initial balances
    const initialFeedbackGiverBalance = await provider.connection.getBalance(feedbackGiver.publicKey);
    const initialPlatformBalance = await provider.connection.getBalance(platformWallet);

    // Submit feedback
    const tx = await program.methods
      .submitFeedback(updatedIpfsCid)
      .accounts({
        feedbackBoard: feedbackBoardPda,
        feedbackGiver: feedbackGiver.publicKey,
        platformWallet: platformWallet,
        systemProgram: SystemProgram.programId,
      })
      .signers([feedbackGiver])
      .rpc();

    console.log("Submit feedback transaction:", tx);

    // Verify the IPFS CID was updated
    const feedbackBoardAccount = await program.account.feedbackBoard.fetch(feedbackBoardPda);
    
    assert.equal(feedbackBoardAccount.creator.toString(), creator.publicKey.toString());
    assert.equal(feedbackBoardAccount.ipfsCid, updatedIpfsCid);
    assert.equal(feedbackBoardAccount.boardId, boardId);

    // Verify transaction costs
    const finalFeedbackGiverBalance = await provider.connection.getBalance(feedbackGiver.publicKey);
    const finalPlatformBalance = await provider.connection.getBalance(platformWallet);
    
    // Calculate actual balance changes
    const feedbackGiverBalanceDecrease = initialFeedbackGiverBalance - finalFeedbackGiverBalance;
    const platformBalanceIncrease = finalPlatformBalance - initialPlatformBalance;
    
    console.log(`=== FEEDBACK SUBMISSION BALANCE VERIFICATION ===`);
    console.log(`Feedback giver balance: ${initialFeedbackGiverBalance} -> ${finalFeedbackGiverBalance}`);
    console.log(`Feedback giver decrease: ${feedbackGiverBalanceDecrease} lamports`);
    console.log(`Platform balance: ${initialPlatformBalance} -> ${finalPlatformBalance}`);
    console.log(`Platform increase: ${platformBalanceIncrease} lamports`);
    
    // CRITICAL: Platform account must have received exactly 1 lamport
    assert.equal(platformBalanceIncrease, 1, "Platform wallet must receive exactly 1 lamport platform fee");
    
    // CRITICAL: Feedback giver account must have decreased by at least 1 lamport (platform fee + transaction costs)
    assert.isTrue(feedbackGiverBalanceDecrease >= 1, `Feedback giver balance must decrease by at least 1 lamport (platform fee), actual decrease: ${feedbackGiverBalanceDecrease}`);
    
    console.log(`✅ Feedback submission balance verification passed`);
  });

  it("Handles multiple feedback submissions", async () => {
    // Derive the PDA for the feedback board
    const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        creator.publicKey.toBuffer(),
        Buffer.from(boardId),
      ],
      program.programId
    );

    const newIpfsCid = "QmPGBVJFnXhYMSuNcbswQRJWtqRznUvKQPZF9EfAb3Tx4M";

    // Get initial balances for second feedback submission
    const initialFeedbackGiverBalance = await provider.connection.getBalance(feedbackGiver.publicKey);
    const initialPlatformBalance = await provider.connection.getBalance(platformWallet);

    // Submit another feedback
    const tx = await program.methods
      .submitFeedback(newIpfsCid)
      .accounts({
        feedbackBoard: feedbackBoardPda,
        feedbackGiver: feedbackGiver.publicKey,
        platformWallet: platformWallet,
        systemProgram: SystemProgram.programId,
      })
      .signers([feedbackGiver])
      .rpc();

    console.log("Multiple feedback transaction:", tx);

    // Verify the IPFS CID was updated again
    const feedbackBoardAccount = await program.account.feedbackBoard.fetch(feedbackBoardPda);
    assert.equal(feedbackBoardAccount.ipfsCid, newIpfsCid);

    // Verify balance changes for second feedback submission
    const finalFeedbackGiverBalance = await provider.connection.getBalance(feedbackGiver.publicKey);
    const finalPlatformBalance = await provider.connection.getBalance(platformWallet);
    
    const feedbackGiverBalanceDecrease = initialFeedbackGiverBalance - finalFeedbackGiverBalance;
    const platformBalanceIncrease = finalPlatformBalance - initialPlatformBalance;
    
    console.log(`=== SECOND FEEDBACK SUBMISSION BALANCE VERIFICATION ===`);
    console.log(`Feedback giver decrease: ${feedbackGiverBalanceDecrease} lamports`);
    console.log(`Platform increase: ${platformBalanceIncrease} lamports`);
    
    // CRITICAL: Platform account must have received exactly 1 lamport for second submission
    assert.equal(platformBalanceIncrease, 1, "Platform wallet must receive exactly 1 lamport for second feedback submission");
    
    // CRITICAL: Feedback giver account must have decreased by at least 1 lamport
    assert.isTrue(feedbackGiverBalanceDecrease >= 1, `Feedback giver balance must decrease by at least 1 lamport, actual decrease: ${feedbackGiverBalanceDecrease}`);
    
    console.log(`✅ Second feedback submission balance verification passed`);
  });

  it("Verifies total platform fee collection across all successful operations", async () => {
    // Get platform wallet balance after all successful operations
    const currentPlatformBalance = await provider.connection.getBalance(platformWallet);
    
    // Calculate total expected platform fees:
    // - 1 board creation: 10 lamports
    // - 2 feedback submissions: 2 lamports (1 + 1)
    // Total expected: 12 lamports
    const expectedTotalFees = 12;
    
    // Compare with the initial platform balance (before any operations)
    // Note: We need to get the initial balance from the airdrop amount
    const airdroppedAmount = 10 * anchor.web3.LAMPORTS_PER_SOL;
    const totalFeesCollected = currentPlatformBalance - airdroppedAmount;
    
    console.log(`=== TOTAL PLATFORM FEE VERIFICATION ===`);
    console.log(`Platform wallet started with: ${airdroppedAmount} lamports (airdropped)`);
    console.log(`Platform wallet current balance: ${currentPlatformBalance} lamports`);
    console.log(`Total fees collected: ${totalFeesCollected} lamports`);
    console.log(`Expected total fees: ${expectedTotalFees} lamports`);
    console.log(`Breakdown: Board creation (10) + First feedback (1) + Second feedback (1) = 12 lamports`);
    
    // CRITICAL: Total fees collected must equal expected amount
    assert.equal(totalFeesCollected, expectedTotalFees, 
      `Platform must have collected exactly ${expectedTotalFees} lamports total (10 for board creation + 1 + 1 for feedback submissions)`);
    
    console.log(`✅ Total platform fee verification passed - collected ${totalFeesCollected} lamports as expected`);
  });

  it("Fails to submit feedback with empty IPFS CID", async () => {
    // Derive the PDA for the feedback board
    const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        creator.publicKey.toBuffer(),
        Buffer.from(boardId),
      ],
      program.programId
    );

    const emptyIpfsCid = "";

    try {
      await program.methods
        .submitFeedback(emptyIpfsCid)
        .accounts({
          feedbackBoard: feedbackBoardPda,
          feedbackGiver: feedbackGiver.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([feedbackGiver])
        .rpc();
      
      assert.fail("Should have failed when submitting feedback with empty IPFS CID");
    } catch (error) {
      // Should fail due to empty IPFS CID
      console.log("Expected error for empty IPFS CID in feedback:", error.message);
      assert.include(error.toString().toLowerCase(), "empty");
    }
  });

  it("Fails to submit feedback with invalid IPFS CID format", async () => {
    // Derive the PDA for the feedback board
    const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        creator.publicKey.toBuffer(),
        Buffer.from(boardId),
      ],
      program.programId
    );

    const invalidIpfsCid = "InvalidCidFormatThatDoesNotStartWithQmOrB123456789";

    try {
      await program.methods
        .submitFeedback(invalidIpfsCid)
        .accounts({
          feedbackBoard: feedbackBoardPda,
          feedbackGiver: feedbackGiver.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([feedbackGiver])
        .rpc();
      
      assert.fail("Should have failed when submitting feedback with invalid IPFS CID format");
    } catch (error) {
      // Should fail due to invalid IPFS CID format
      console.log("Expected error for invalid IPFS CID format:", error.message);
      assert.include(error.toString().toLowerCase(), "invalid");
    }
  });

  it("Fails to submit feedback with too short IPFS CID", async () => {
    // Derive the PDA for the feedback board
    const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        creator.publicKey.toBuffer(),
        Buffer.from(boardId),
      ],
      program.programId
    );

    const tooShortIpfsCid = "QmShort123";

    try {
      await program.methods
        .submitFeedback(tooShortIpfsCid)
        .accounts({
          feedbackBoard: feedbackBoardPda,
          feedbackGiver: feedbackGiver.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([feedbackGiver])
        .rpc();
      
      assert.fail("Should have failed when submitting feedback with too short IPFS CID");
    } catch (error) {
      // Should fail due to invalid IPFS CID length
      console.log("Expected error for too short IPFS CID:", error.message);
      assert.include(error.toString().toLowerCase(), "length");
    }
  });

  it("Fails to submit feedback to non-existent board", async () => {
    const nonExistentBoardId = "non-existent-board-feedback";
    
    const [nonExistentBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        creator.publicKey.toBuffer(),
        Buffer.from(nonExistentBoardId),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitFeedback(updatedIpfsCid)
        .accounts({
          feedbackBoard: nonExistentBoardPda,
          feedbackGiver: feedbackGiver.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([feedbackGiver])
        .rpc();
      
      assert.fail("Should have failed when submitting feedback to non-existent board");
    } catch (error) {
      // Should fail because account doesn't exist
      console.log("Expected error for non-existent board:", error.message);
      // Anchor error for non-existent account
      assert.include(error.toString().toLowerCase(), "account");
    }
  });

  it("Fails to submit feedback with insufficient funds", async () => {
    const poorFeedbackGiver = anchor.web3.Keypair.generate();
    
    // Give minimal funds to feedback giver (less than needed for fees)
    await airdrop(provider.connection, poorFeedbackGiver.publicKey, 0.0001 * anchor.web3.LAMPORTS_PER_SOL);
    
    // Derive the PDA for the feedback board
    const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback_board"),
        creator.publicKey.toBuffer(),
        Buffer.from(boardId),
      ],
      program.programId
    );

    try {
      await program.methods
        .submitFeedback(updatedIpfsCid)
        .accounts({
          feedbackBoard: feedbackBoardPda,
          feedbackGiver: poorFeedbackGiver.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([poorFeedbackGiver])
        .rpc();
      
      assert.fail("Should have failed when feedback giver has insufficient funds");
    } catch (error) {
      // Should fail due to insufficient funds
      console.log("Expected error for insufficient funds:", error.message);
      assert.include(error.toString().toLowerCase(), "insufficient");
    }
  });

  // it("Submits feedback and updates IPFS CID", async () => {
  //   // Derive the PDA for the feedback board
  //   const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("feedback_board"),
  //       creator.publicKey.toBuffer(),
  //       Buffer.from(boardId),
  //     ],
  //     program.programId
  //   );

  //   // Get initial balances
  //   const initialFeedbackGiverBalance = await provider.connection.getBalance(feedbackGiver.publicKey);
  //   const initialPlatformBalance = await provider.connection.getBalance(platformWallet);

  //   // Submit feedback
  //   const tx = await program.methods
  //     .submitFeedback(updatedIpfsCid)
  //     .accounts({
  //       feedbackBoard: feedbackBoardPda,
  //       feedbackGiver: feedbackGiver.publicKey,
  //       platformWallet: platformWallet,
  //       systemProgram: SystemProgram.programId,
  //     })
  //     .signers([feedbackGiver])
  //     .rpc();

  //   console.log("Submit feedback transaction:", tx);

  //   // Verify the IPFS CID was updated
  //   const feedbackBoardAccount = await program.account.feedbackBoard.fetch(feedbackBoardPda);
    
  //   assert.equal(feedbackBoardAccount.creator.toString(), creator.publicKey.toString());
  //   assert.equal(feedbackBoardAccount.ipfsCid, updatedIpfsCid);
  //   assert.equal(feedbackBoardAccount.boardId, boardId);

  //   // Verify platform fee was transferred
  //   const finalFeedbackGiverBalance = await provider.connection.getBalance(feedbackGiver.publicKey);
  //   const finalPlatformBalance = await provider.connection.getBalance(platformWallet);
    
  //   // Feedback giver should have less SOL (paid fees)
  //   assert.isTrue(finalFeedbackGiverBalance < initialFeedbackGiverBalance);
    
  //   // Platform wallet should have received some fee
  //   assert.isTrue(finalPlatformBalance >= initialPlatformBalance);
    
  //   console.log(`Platform fee collected: ${finalPlatformBalance - initialPlatformBalance} lamports`);
  // });

  // it("Handles multiple feedback submissions", async () => {
  //   // Derive the PDA for the feedback board
  //   const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("feedback_board"),
  //       creator.publicKey.toBuffer(),
  //       Buffer.from(boardId),
  //     ],
  //     program.programId
  //   );

  //   const newIpfsCid = "QmTestMultipleFeedbackCid111222333";

  //   // Submit another feedback
  //   const tx = await program.methods
  //     .submitFeedback(newIpfsCid)
  //     .accounts({
  //       feedbackBoard: feedbackBoardPda,
  //       feedbackGiver: feedbackGiver.publicKey,
  //       platformWallet: platformWallet,
  //       systemProgram: SystemProgram.programId,
  //     })
  //     .signers([feedbackGiver])
  //     .rpc();

  //   console.log("Multiple feedback transaction:", tx);

  //   // Verify the IPFS CID was updated again
  //   const feedbackBoardAccount = await program.account.feedbackBoard.fetch(feedbackBoardPda);
  //   assert.equal(feedbackBoardAccount.ipfsCid, newIpfsCid);
  // });

  // it("Creates multiple feedback boards from same creator", async () => {
  //   const secondBoardId = "test-board-2";
  //   const secondIpfsCid = "QmTestSecondBoardCid456789";

  //   // Derive PDA for second board
  //   const [secondFeedbackBoardPda] = PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("feedback_board"),
  //       creator.publicKey.toBuffer(),
  //       Buffer.from(secondBoardId),
  //     ],
  //     program.programId
  //   );

  //   // Create second feedback board
  //   const tx = await program.methods
  //     .createFeedbackBoard(secondBoardId, secondIpfsCid)
  //     .accounts({
  //       feedbackBoard: secondFeedbackBoardPda,
  //       creator: creator.publicKey,
  //       platformWallet: platformWallet,
  //       systemProgram: SystemProgram.programId,
  //     })
  //     .signers([creator])
  //     .rpc();

  //   console.log("Second feedback board transaction:", tx);

  //   // Verify both boards exist and are independent
  //   const firstBoard = await program.account.feedbackBoard.fetch(
  //     PublicKey.findProgramAddressSync(
  //       [
  //         Buffer.from("feedback_board"),
  //         creator.publicKey.toBuffer(),
  //         Buffer.from(boardId),
  //       ],
  //       program.programId
  //     )[0]
  //   );

  //   const secondBoard = await program.account.feedbackBoard.fetch(secondFeedbackBoardPda);

  //   assert.equal(firstBoard.boardId, boardId);
  //   assert.equal(secondBoard.boardId, secondBoardId);
  //   assert.equal(secondBoard.ipfsCid, secondIpfsCid);
  //   assert.notEqual(firstBoard.ipfsCid, secondBoard.ipfsCid);
  // });

  // it("Fails when trying to create duplicate board", async () => {
  //   const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("board"),
  //       Buffer.from(boardId),
  //     ],
  //     program.programId
  //   );

  //   try {
  //     await program.methods
  //       .createFeedbackBoard(boardId, "QmDuplicateCid")
  //       .accounts({
  //         feedbackBoard: feedbackBoardPda,
  //         creator: creator.publicKey,
  //         platformWallet: platformWallet,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .signers([creator])
  //       .rpc();
      
  //     assert.fail("Should have failed when creating duplicate board");
  //   } catch (error) {
  //     // Should fail because account already exists
  //     assert.include(error.toString().toLowerCase(), "already in use");
  //   }
  // });

  // it("Fails when submitting feedback to non-existent board", async () => {
  //   const nonExistentBoardId = "non-existent-board";
    
  //   const [nonExistentBoardPda] = PublicKey.findProgramAddressSync(
  //     [
  //       Buffer.from("feedback_board"),
  //       creator.publicKey.toBuffer(),
  //       Buffer.from(nonExistentBoardId),
  //     ],
  //     program.programId
  //   );

  //   try {
  //     await program.methods
  //       .submitFeedback("QmNonExistentCid")
  //       .accounts({
  //         feedbackBoard: nonExistentBoardPda,
  //         feedbackGiver: feedbackGiver.publicKey,
  //         platformWallet: platformWallet,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .signers([feedbackGiver])
  //       .rpc();
      
  //     assert.fail("Should have failed when submitting to non-existent board");
  //   } catch (error) {
  //     // Should fail because account doesn't exist
  //     assert.include(error.toString().toLowerCase(), "account does not exist");
  //   }
  // });
});

async function airdrop(connection: any, address: any, amount = 100 * anchor.web3.LAMPORTS_PER_SOL) {
  await connection.confirmTransaction(await connection.requestAirdrop(address, amount), "confirmed");
}
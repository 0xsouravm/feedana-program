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
  const initialIpfsCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
  const updatedIpfsCid = "QmPGBVJFnXhYMSuNcbswQRJWtqRznUvKQPZF9EfAb3Tx4M";

  before(async () => {    
    // Airdrop SOL to test accounts
    await airdrop(provider.connection, creator.publicKey);
    await airdrop(provider.connection, feedbackGiver.publicKey);
    
    // Airdrop SOL to platform wallet to ensure it can receive transfers
    await airdrop(provider.connection, platformWallet, 10 * anchor.web3.LAMPORTS_PER_SOL);
  });

  describe("Create Feedback Board", () => {
    it("Creates a feedback board successfully", async () => {
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
      
      // Platform account must have received exactly 10 lamports
      assert.equal(platformBalanceIncrease, 10, "Platform wallet must receive exactly 10 lamports platform fee");
      
      // Creator account must have decreased by at least 10 lamports (platform fee + transaction costs)
      assert.isTrue(creatorBalanceDecrease >= 10, `Creator balance must decrease by at least 10 lamports (platform fee), actual decrease: ${creatorBalanceDecrease}`);

      // Verify the FeedbackBoardCreated event was emitted
      const txResponse = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
      });
      
      // Check if event logs contain our event data
      if (txResponse && txResponse.meta && txResponse.meta.logMessages) {
        const eventLogs = txResponse.meta.logMessages.filter(log => 
          log.includes("Program data:") || log.includes("FeedbackBoardCreated")
        );
        assert.isTrue(eventLogs.length > 0, "FeedbackBoardCreated event should be emitted");
      }
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
        assert.include(error.toString().toLowerCase(), "empty");
      }
    });

    it("Fails to create feedback board with too long board ID", async () => {
      const tooLongBoardId = "this-board-id-is-very-very-very-long";
      const validIpfsCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

      try {
        // Try to derive the PDA for the feedback board - this will fail
        const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("feedback_board"),
            creator.publicKey.toBuffer(),
            Buffer.from(tooLongBoardId),
          ],
          program.programId
        );

        await program.methods
          .createFeedbackBoard(tooLongBoardId, validIpfsCid)
          .accounts({
            feedbackBoard: feedbackBoardPda,
            creator: creator.publicKey,
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();
        
        assert.fail("Should have failed when creating board with too long ID");
      } catch (error) {
        assert.include(error.toString().toLowerCase(), "max seed length exceeded");
      }
    });

    it("Fails to create feedback board with invalid board ID characters", async () => {
      const invalidBoardId = "invalid@board#id!";
      const validIpfsCid = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
      
      // Derive the PDA for the feedback board
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          creator.publicKey.toBuffer(),
          Buffer.from(invalidBoardId),
        ],
        program.programId
      );

      try {
        await program.methods
          .createFeedbackBoard(invalidBoardId, validIpfsCid)
          .accounts({
            feedbackBoard: feedbackBoardPda,
            creator: creator.publicKey,
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();
        
        assert.fail("Should have failed when creating board with invalid characters");
      } catch (error) {
        assert.include(error.toString().toLowerCase(), "invalid");
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
        assert.include(error.toString().toLowerCase(), "insufficient");
      }
    });
  });

  describe("Submit Feedback", () => {
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
      
      // Platform account must have received exactly 1 lamport
      assert.equal(platformBalanceIncrease, 1, "Platform wallet must receive exactly 1 lamport platform fee");
      
      // Feedback giver account must have decreased by at least 1 lamport (platform fee + transaction costs)
      assert.isTrue(feedbackGiverBalanceDecrease >= 1, `Feedback giver balance must decrease by at least 1 lamport (platform fee), actual decrease: ${feedbackGiverBalanceDecrease}`);

      // Verify the FeedbackSubmitted event was emitted
      const txResponse = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
      });
      
      // Check if event logs contain our event data
      if (txResponse && txResponse.meta && txResponse.meta.logMessages) {
        const eventLogs = txResponse.meta.logMessages.filter(log => 
          log.includes("Program data:") || log.includes("FeedbackSubmitted")
        );
        assert.isTrue(eventLogs.length > 0, "FeedbackSubmitted event should be emitted");
      }
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

      // Verify the IPFS CID was updated again
      const feedbackBoardAccount = await program.account.feedbackBoard.fetch(feedbackBoardPda);
      assert.equal(feedbackBoardAccount.ipfsCid, newIpfsCid);

      // Verify balance changes for second feedback submission
      const finalFeedbackGiverBalance = await provider.connection.getBalance(feedbackGiver.publicKey);
      const finalPlatformBalance = await provider.connection.getBalance(platformWallet);
      
      const feedbackGiverBalanceDecrease = initialFeedbackGiverBalance - finalFeedbackGiverBalance;
      const platformBalanceIncrease = finalPlatformBalance - initialPlatformBalance;
      
      // Platform account must have received exactly 1 lamport for second submission
      assert.equal(platformBalanceIncrease, 1, "Platform wallet must receive exactly 1 lamport for second feedback submission");
      
      // Feedback giver account must have decreased by at least 1 lamport
      assert.isTrue(feedbackGiverBalanceDecrease >= 1, `Feedback giver balance must decrease by at least 1 lamport, actual decrease: ${feedbackGiverBalanceDecrease}`);

      // Verify the FeedbackSubmitted event was emitted for second submission
      const txResponse = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
      });
      
      // Check if event logs contain our event data
      if (txResponse && txResponse.meta && txResponse.meta.logMessages) {
        const eventLogs = txResponse.meta.logMessages.filter(log => 
          log.includes("Program data:") || log.includes("FeedbackSubmitted")
        );
        assert.isTrue(eventLogs.length > 0, "FeedbackSubmitted event should be emitted for second submission");
      }
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
      
      // Total fees collected must equal expected amount
      assert.equal(totalFeesCollected, expectedTotalFees, 
        `Platform must have collected exactly ${expectedTotalFees} lamports total (10 for board creation + 1 + 1 for feedback submissions)`);
    });

    it("Fails when creator tries to submit feedback on their own board", async () => {
      // Derive the PDA for the feedback board (using the board created in the first test)
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          creator.publicKey.toBuffer(),
          Buffer.from(boardId),
        ],
        program.programId
      );

      const testIpfsCid = "QmTestCreatorSubmitCid123456789012345678901234";

      try {
        // Try to submit feedback as the creator (should fail)
        await program.methods
          .submitFeedback(testIpfsCid)
          .accounts({
            feedbackBoard: feedbackBoardPda,
            feedbackGiver: creator.publicKey, // Creator trying to submit on their own board
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([creator])
          .rpc();
        
        assert.fail("Should have failed when creator tries to submit feedback on their own board");
      } catch (error) {
        assert.include(error.toString().toLowerCase(), "creator");
      }
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
        assert.include(error.toString().toLowerCase(), "insufficient");
      }
    });
  });

  // Shared upvote/downvote test board setup
  const upvoteBoardId = "test-board-upvote";
  const upvoteCreator = anchor.web3.Keypair.generate();

  describe("Upvote Feedback", () => {
    // Create a new test board for upvote tests since the main board is archived
    const voter = anchor.web3.Keypair.generate();
    const upvoteIpfsCid = "QmUpvoteTestCid123456789012345678901234567890";
    
    before(async () => {
      // Airdrop SOL to test accounts
      await airdrop(provider.connection, upvoteCreator.publicKey);
      await airdrop(provider.connection, voter.publicKey);
      
      // Create a feedback board for upvote tests
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          upvoteCreator.publicKey.toBuffer(),
          Buffer.from(upvoteBoardId),
        ],
        program.programId
      );

      await program.methods
        .createFeedbackBoard(upvoteBoardId, initialIpfsCid)
        .accounts({
          feedbackBoard: feedbackBoardPda,
          creator: upvoteCreator.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([upvoteCreator])
        .rpc();
    });

    it("Upvotes feedback successfully", async () => {
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          upvoteCreator.publicKey.toBuffer(),
          Buffer.from(upvoteBoardId),
        ],
        program.programId
      );

      // Get initial balances
      const initialVoterBalance = await provider.connection.getBalance(voter.publicKey);
      const initialPlatformBalance = await provider.connection.getBalance(platformWallet);

      // Upvote feedback
      const tx = await program.methods
        .upvoteFeedback(upvoteIpfsCid)
        .accounts({
          feedbackBoard: feedbackBoardPda,
          voter: voter.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([voter])
        .rpc();

      // Verify the IPFS CID was updated
      const feedbackBoardAccount = await program.account.feedbackBoard.fetch(feedbackBoardPda);
      assert.equal(feedbackBoardAccount.ipfsCid, upvoteIpfsCid);
      assert.equal(feedbackBoardAccount.creator.toString(), upvoteCreator.publicKey.toString());
      assert.equal(feedbackBoardAccount.boardId, upvoteBoardId);

      // Verify balance changes
      const finalVoterBalance = await provider.connection.getBalance(voter.publicKey);
      const finalPlatformBalance = await provider.connection.getBalance(platformWallet);
      
      const voterBalanceDecrease = initialVoterBalance - finalVoterBalance;
      const platformBalanceIncrease = finalPlatformBalance - initialPlatformBalance;
      
      // Platform account must have received exactly 1 lamport
      assert.equal(platformBalanceIncrease, 1, "Platform wallet must receive exactly 1 lamport upvote fee");
      
      // Voter account must have decreased by at least 1 lamport
      assert.isTrue(voterBalanceDecrease >= 1, `Voter balance must decrease by at least 1 lamport, actual decrease: ${voterBalanceDecrease}`);

      // Verify the FeedbackUpvoted event was emitted
      const txResponse = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
      });
      
      if (txResponse && txResponse.meta && txResponse.meta.logMessages) {
        const eventLogs = txResponse.meta.logMessages.filter(log => 
          log.includes("Program data:") || log.includes("FeedbackUpvoted")
        );
        assert.isTrue(eventLogs.length > 0, "FeedbackUpvoted event should be emitted");
      }
    });

    it("Fails to upvote with empty IPFS CID", async () => {
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          upvoteCreator.publicKey.toBuffer(),
          Buffer.from(upvoteBoardId),
        ],
        program.programId
      );

      try {
        await program.methods
          .upvoteFeedback("")
          .accounts({
            feedbackBoard: feedbackBoardPda,
            voter: voter.publicKey,
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([voter])
          .rpc();
        
        assert.fail("Should have failed when upvoting with empty IPFS CID");
      } catch (error) {
        // Check for EmptyIpfsCid error (code 6003)
        assert.include(error.toString(), "6003");
        assert.include(error.message || error.toString(), "IPFS CID cannot be empty");
      }
    });

    it("Fails to upvote with invalid IPFS CID format", async () => {
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          upvoteCreator.publicKey.toBuffer(),
          Buffer.from(upvoteBoardId),
        ],
        program.programId
      );

      const invalidCid = "InvalidUpvoteCidFormat123456789012345678901234";

      try {
        await program.methods
          .upvoteFeedback(invalidCid)
          .accounts({
            feedbackBoard: feedbackBoardPda,
            voter: voter.publicKey,
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([voter])
          .rpc();
        
        assert.fail("Should have failed when upvoting with invalid IPFS CID format");
      } catch (error) {
        // Check for InvalidIpfsCid error (code 6000)
        assert.include(error.toString(), "6000");
      }
    });

    it("Fails to upvote with insufficient funds", async () => {
      const poorVoter = anchor.web3.Keypair.generate();
      
      // Give minimal funds
      await airdrop(provider.connection, poorVoter.publicKey, 0.0001 * anchor.web3.LAMPORTS_PER_SOL);
      
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          upvoteCreator.publicKey.toBuffer(),
          Buffer.from(upvoteBoardId),
        ],
        program.programId
      );

      try {
        await program.methods
          .upvoteFeedback(upvoteIpfsCid)
          .accounts({
            feedbackBoard: feedbackBoardPda,
            voter: poorVoter.publicKey,
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([poorVoter])
          .rpc();
        
        assert.fail("Should have failed when voter has insufficient funds");
      } catch (error) {
        assert.include(error.toString().toLowerCase(), "insufficient");
      }
    });
  });

  describe("Downvote Feedback", () => {
    // Use the same test board from upvote tests for consistency and speed
    const downvoteBoardId = "test-board-upvote"; // Reuse upvote board
    const downvoter = anchor.web3.Keypair.generate();
    const downvoteIpfsCid = "QmDownvoteTestCid12345678901234567890123456789";

    before(async () => {
      // Airdrop SOL to downvoter
      await airdrop(provider.connection, downvoter.publicKey);
    });

    it("Downvotes feedback successfully", async () => {
      // Use the existing upvote test board (already created)
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          upvoteCreator.publicKey.toBuffer(),
          Buffer.from(downvoteBoardId),
        ],
        program.programId
      );

      // Get initial balances
      const initialDownvoterBalance = await provider.connection.getBalance(downvoter.publicKey);
      const initialPlatformBalance = await provider.connection.getBalance(platformWallet);

      // Downvote feedback
      const tx = await program.methods
        .downvoteFeedback(downvoteIpfsCid)
        .accounts({
          feedbackBoard: feedbackBoardPda,
          voter: downvoter.publicKey,
          platformWallet: platformWallet,
          systemProgram: SystemProgram.programId,
        })
        .signers([downvoter])
        .rpc();

      // Verify the IPFS CID was updated
      const feedbackBoardAccount = await program.account.feedbackBoard.fetch(feedbackBoardPda);
      assert.equal(feedbackBoardAccount.ipfsCid, downvoteIpfsCid);
      assert.equal(feedbackBoardAccount.creator.toString(), upvoteCreator.publicKey.toString());
      assert.equal(feedbackBoardAccount.boardId, downvoteBoardId);

      // Verify balance changes
      const finalDownvoterBalance = await provider.connection.getBalance(downvoter.publicKey);
      const finalPlatformBalance = await provider.connection.getBalance(platformWallet);
      
      const downvoterBalanceDecrease = initialDownvoterBalance - finalDownvoterBalance;
      const platformBalanceIncrease = finalPlatformBalance - initialPlatformBalance;
      
      // Platform account must have received exactly 1 lamport
      assert.equal(platformBalanceIncrease, 1, "Platform wallet must receive exactly 1 lamport downvote fee");
      
      // Downvoter account must have decreased by at least 1 lamport
      assert.isTrue(downvoterBalanceDecrease >= 1, `Downvoter balance must decrease by at least 1 lamport, actual decrease: ${downvoterBalanceDecrease}`);

      // Verify the FeedbackDownvoted event was emitted
      const txResponse = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
      });
      
      if (txResponse && txResponse.meta && txResponse.meta.logMessages) {
        const eventLogs = txResponse.meta.logMessages.filter(log => 
          log.includes("Program data:") || log.includes("FeedbackDownvoted")
        );
        assert.isTrue(eventLogs.length > 0, "FeedbackDownvoted event should be emitted");
      }
    });

    it("Fails to downvote with empty IPFS CID", async () => {
      // Use the existing upvote test board
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          upvoteCreator.publicKey.toBuffer(),
          Buffer.from(downvoteBoardId),
        ],
        program.programId
      );

      try {
        await program.methods
          .downvoteFeedback("")
          .accounts({
            feedbackBoard: feedbackBoardPda,
            voter: downvoter.publicKey,
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([downvoter])
          .rpc();
        
        assert.fail("Should have failed when downvoting with empty IPFS CID");
      } catch (error) {
        // Check for EmptyIpfsCid error (code 6003)
        assert.include(error.toString(), "6003");
        assert.include(error.message || error.toString(), "IPFS CID cannot be empty");
      }
    });

    it("Fails to downvote with invalid IPFS CID format", async () => {
      // Use the existing upvote test board
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          upvoteCreator.publicKey.toBuffer(),
          Buffer.from(downvoteBoardId),
        ],
        program.programId
      );

      const invalidCid = "InvalidDownvoteCidFormat1234567890123456789012";

      try {
        await program.methods
          .downvoteFeedback(invalidCid)
          .accounts({
            feedbackBoard: feedbackBoardPda,
            voter: downvoter.publicKey,
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([downvoter])
          .rpc();
        
        assert.fail("Should have failed when downvoting with invalid IPFS CID format");
      } catch (error) {
        // Check for InvalidIpfsCid error (code 6000)
        assert.include(error.toString(), "6000");
      }
    });

    it("Fails to downvote with insufficient funds", async () => {
      const poorDownvoter = anchor.web3.Keypair.generate();
      
      // Give minimal funds
      await airdrop(provider.connection, poorDownvoter.publicKey, 0.0001 * anchor.web3.LAMPORTS_PER_SOL);
      
      // Use the existing upvote test board
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          upvoteCreator.publicKey.toBuffer(),
          Buffer.from(downvoteBoardId),
        ],
        program.programId
      );

      try {
        await program.methods
          .downvoteFeedback(downvoteIpfsCid)
          .accounts({
            feedbackBoard: feedbackBoardPda,
            voter: poorDownvoter.publicKey,
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([poorDownvoter])
          .rpc();
        
        assert.fail("Should have failed when downvoter has insufficient funds");
      } catch (error) {
        assert.include(error.toString().toLowerCase(), "insufficient");
      }
    });
  });

  describe("Archive Feedback Board", () => {
    it("Archives a feedback board successfully", async () => {
      // Use the existing board from the first test
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          creator.publicKey.toBuffer(),
          Buffer.from(boardId),
        ],
        program.programId
      );

      // Verify board is not archived initially
      let feedbackBoardAccount = await program.account.feedbackBoard.fetch(feedbackBoardPda);
      assert.equal(feedbackBoardAccount.isArchived, false);

      // Archive the board
      const tx = await program.methods
        .archiveFeedbackBoard()
        .accounts({
          feedbackBoard: feedbackBoardPda,
          creator: creator.publicKey,
        })
        .signers([creator])
        .rpc();

      // Verify the board is now archived
      feedbackBoardAccount = await program.account.feedbackBoard.fetch(feedbackBoardPda);
      assert.equal(feedbackBoardAccount.isArchived, true);
      assert.equal(feedbackBoardAccount.creator.toString(), creator.publicKey.toString());
      assert.equal(feedbackBoardAccount.boardId, boardId);

      // Verify the FeedbackBoardArchived event was emitted
      const txResponse = await provider.connection.getTransaction(tx, {
        commitment: "confirmed",
      });
      
      if (txResponse && txResponse.meta && txResponse.meta.logMessages) {
        const eventLogs = txResponse.meta.logMessages.filter(log => 
          log.includes("Program data:") || log.includes("FeedbackBoardArchived")
        );
        assert.isTrue(eventLogs.length > 0, "FeedbackBoardArchived event should be emitted");
      }
    });

    it("Fails when non-creator tries to archive board", async () => {
      // Use the existing main test board
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          creator.publicKey.toBuffer(),
          Buffer.from(boardId),
        ],
        program.programId
      );

      try {
        // Try to archive with feedbackGiver (not the creator)
        await program.methods
          .archiveFeedbackBoard()
          .accounts({
            feedbackBoard: feedbackBoardPda,
            creator: feedbackGiver.publicKey, // Not the actual creator
          })
          .signers([feedbackGiver])
          .rpc();
        
        assert.fail("Should have failed when non-creator tries to archive");
      } catch (error) {
        assert.include(error.toString().toLowerCase(), "unauthorized");
      }
    });

    it("Fails to archive already archived board", async () => {
      // Use the existing board (now archived from the first test)
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          creator.publicKey.toBuffer(),
          Buffer.from(boardId),
        ],
        program.programId
      );

      try {
        // Try to archive the already archived board
        await program.methods
          .archiveFeedbackBoard()
          .accounts({
            feedbackBoard: feedbackBoardPda,
            creator: creator.publicKey,
          })
          .signers([creator])
          .rpc();
        
        assert.fail("Should have failed when trying to archive already archived board");
      } catch (error) {
        assert.include(error.toString().toLowerCase(), "already archived");
      }
    });

    it("Prevents feedback submission to archived board", async () => {
      // Use the existing archived board
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          creator.publicKey.toBuffer(),
          Buffer.from(boardId),
        ],
        program.programId
      );

      const testFeedbackCid = updatedIpfsCid;

      try {
        // Try to submit feedback to archived board
        await program.methods
          .submitFeedback(testFeedbackCid)
          .accounts({
            feedbackBoard: feedbackBoardPda,
            feedbackGiver: feedbackGiver.publicKey,
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([feedbackGiver])
          .rpc();
        
        assert.fail("Should have failed when submitting feedback to archived board");
      } catch (error) {
        assert.include(error.toString().toLowerCase(), "archived");
      }
    });

    it("Prevents upvoting on archived board", async () => {
      // Use the existing archived board
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          creator.publicKey.toBuffer(),
          Buffer.from(boardId),
        ],
        program.programId
      );

      const testUpvoteCid = "QmArchivedUpvoteTest123456789012345678901234567890";

      try {
        // Try to upvote on archived board
        await program.methods
          .upvoteFeedback(testUpvoteCid)
          .accounts({
            feedbackBoard: feedbackBoardPda,
            voter: feedbackGiver.publicKey,
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([feedbackGiver])
          .rpc();
        
        assert.fail("Should have failed when upvoting on archived board");
      } catch (error) {
        // Check for CannotUpvoteInArchivedBoard error (code 6013)
        assert.include(error.toString(), "6013");
        assert.include(error.message || error.toString(), "Cannot upvote feedback in archived board");
      }
    });

    it("Prevents downvoting on archived board", async () => {
      // Use the existing archived board
      const [feedbackBoardPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback_board"),
          creator.publicKey.toBuffer(),
          Buffer.from(boardId),
        ],
        program.programId
      );

      const testDownvoteCid = "QmArchivedDownvoteTest12345678901234567890123456789";

      try {
        // Try to downvote on archived board
        await program.methods
          .downvoteFeedback(testDownvoteCid)
          .accounts({
            feedbackBoard: feedbackBoardPda,
            voter: feedbackGiver.publicKey,
            platformWallet: platformWallet,
            systemProgram: SystemProgram.programId,
          })
          .signers([feedbackGiver])
          .rpc();
        
        assert.fail("Should have failed when downvoting on archived board");
      } catch (error) {
        // Check for CannotDownvoteInArchivedBoard error (code 6014)
        assert.include(error.toString(), "6014");
        assert.include(error.message || error.toString(), "Cannot downvote feedback in archived board");
      }
    });

  });
});

async function airdrop(connection: any, address: any, amount = 100 * anchor.web3.LAMPORTS_PER_SOL) {
  await connection.confirmTransaction(await connection.requestAirdrop(address, amount), "confirmed");
}
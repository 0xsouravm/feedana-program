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
});

async function airdrop(connection: any, address: any, amount = 100 * anchor.web3.LAMPORTS_PER_SOL) {
  await connection.confirmTransaction(await connection.requestAirdrop(address, amount), "confirmed");
}
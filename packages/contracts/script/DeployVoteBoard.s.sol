// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VoteBoard} from "../src/VoteBoard.sol";

/// @notice Deploy the shared VoteBoard and seed persona votes for the multi-voter DAO demo.
///         The deployer becomes owner (can re-seed). Personas are seeded on the SAME proposal id
///         the app/orchestrator use, so the board is already populated before any judge connects.
///
/// Run (broadcast is your step — your funded DEPLOYER_PK never leaves your machine):
///   forge script script/DeployVoteBoard.s.sol \
///     --rpc-url "$BASE_SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PK" --broadcast
contract DeployVoteBoard is Script {
    // The shared demo proposal id (kept equal to the Governor proposal for continuity).
    uint256 constant PROPOSAL_ID =
        99019252316370500923492472570053420635813165261460609212982482510530266843538;

    function run() external returns (VoteBoard board) {
        vm.startBroadcast(msg.sender);
        board = new VoteBoard(msg.sender); // deployer owns (can re-seed)

        // 5 DAO personas already on record: 3 For, 1 Against, 1 Abstain.
        address[] memory voters = new address[](5);
        uint8[] memory supportVals = new uint8[](5);
        voters[0] = 0x1e7868c6c3d0E441ACC28ee04a021a17438f364e;
        supportVals[0] = 1; // Alice  · For
        voters[1] = 0xcefdaEeDe499AB111643E644283b949D0bec19eF;
        supportVals[1] = 1; // Bob    · For
        voters[2] = 0x6f4DAa10107D0F88C8FA206E28BF671950F60c5F;
        supportVals[2] = 0; // Carol  · Against
        voters[3] = 0x7Dd2820b2F3155Bd96a90bAb2A434CE930377d32;
        supportVals[3] = 1; // Dao    · For
        voters[4] = 0x1D4d5B8164A7cE3447B122787E8076092276762a;
        supportVals[4] = 2; // Eve    · Abstain
        board.ownerSeed(PROPOSAL_ID, voters, supportVals);

        vm.stopBroadcast();

        (uint256 against, uint256 forV, uint256 abstain) = board.getTally(PROPOSAL_ID);
        console2.log("VoteBoard       :", address(board));
        console2.log("seeded For      :", forV);
        console2.log("seeded Against  :", against);
        console2.log("seeded Abstain  :", abstain);
        console2.log("voterCount      :", board.voterCount(PROPOSAL_ID));
        require(board.voterCount(PROPOSAL_ID) == 5, "seed failed");
    }
}

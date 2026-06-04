// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {VotesToken} from "../src/VotesToken.sol";
import {MandateGovernor} from "../src/MandateGovernor.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Deploy VotesToken + MandateGovernor and seed voting power to the USER smart account.
///         The mint auto self-delegates, so the voter has active power without its own UserOp.
///
/// Run (broadcast is the user's step — their funded deployer key never leaves their machine):
///   VOTER_ADDRESS=0x<userDemoSA> forge script script/Deploy.s.sol \
///     --rpc-url "$BASE_SEPOLIA_RPC_URL" --private-key "$DEPLOYER_PK" --broadcast
contract Deploy is Script {
    function run() external returns (VotesToken token, MandateGovernor governor, MockUSDC payment) {
        address voter = vm.envAddress("VOTER_ADDRESS");
        uint256 seed = vm.envOr("SEED_VOTES", uint256(1000 ether));
        uint256 budget = vm.envOr("SEED_MUSDC", uint256(1000e6)); // 1000 mUSDC x402 budget (6 decimals)
        string memory name = vm.envOr("GOVERNOR_NAME", string("Mandate Governor"));

        vm.startBroadcast(msg.sender);
        token = new VotesToken(msg.sender); // deployer is owner (can re-seed)
        governor = new MandateGovernor(token, name);
        token.mint(voter, seed); // mints + auto self-delegates the voter
        payment = new MockUSDC(msg.sender); // x402 spending money, SEPARATE from voting power
        payment.mint(voter, budget); // fund the voter's smart account x402 budget
        vm.stopBroadcast();

        console2.log("VotesToken      :", address(token));
        console2.log("MandateGovernor :", address(governor));
        console2.log("MockUSDC        :", address(payment));
        console2.log("voter           :", voter);
        console2.log("voter getVotes  :", token.getVotes(voter));
        console2.log("voter mUSDC     :", payment.balanceOf(voter));
        require(token.getVotes(voter) == seed, "voter not seeded");
        require(payment.balanceOf(voter) == budget, "voter mUSDC not funded");
    }
}

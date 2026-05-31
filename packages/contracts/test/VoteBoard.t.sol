// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {VoteBoard} from "../src/VoteBoard.sol";

contract VoteBoardTest is Test {
    VoteBoard board;
    address owner = address(0xABCD);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        vm.prank(owner);
        board = new VoteBoard(owner);
    }

    function test_castVote_records_tally_and_voter() public {
        uint256 pid = 42;
        vm.prank(alice);
        board.castVote(pid, 1); // For
        (uint256 against, uint256 forV, uint256 abstain) = board.getTally(pid);
        assertEq(against, 0);
        assertEq(forV, 1);
        assertEq(abstain, 0);
        assertEq(board.getVote(pid, alice), 2); // 2 = For
        assertEq(board.voterCount(pid), 1);
        assertEq(board.getVoters(pid)[0], alice);
    }

    function test_one_vote_per_address_change_updates_not_doubles() public {
        uint256 pid = 7;
        vm.prank(alice);
        board.castVote(pid, 1); // For
        vm.prank(alice);
        board.castVote(pid, 0); // change to Against
        (uint256 against, uint256 forV,) = board.getTally(pid);
        assertEq(forV, 0);
        assertEq(against, 1);
        assertEq(board.voterCount(pid), 1); // still a single voter
    }

    function test_ownerSeed_populates_personas() public {
        uint256 pid = 99;
        address[] memory vs = new address[](2);
        vs[0] = alice;
        vs[1] = bob;
        uint8[] memory ss = new uint8[](2);
        ss[0] = 1; // For
        ss[1] = 0; // Against
        vm.prank(owner);
        board.ownerSeed(pid, vs, ss);
        (uint256 against, uint256 forV,) = board.getTally(pid);
        assertEq(forV, 1);
        assertEq(against, 1);
        assertEq(board.voterCount(pid), 2);
    }

    function test_ownerSeed_only_owner() public {
        uint256 pid = 1;
        address[] memory vs = new address[](1);
        vs[0] = alice;
        uint8[] memory ss = new uint8[](1);
        ss[0] = 1;
        vm.prank(alice);
        vm.expectRevert();
        board.ownerSeed(pid, vs, ss);
    }

    function test_invalid_support_reverts() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VoteBoard.InvalidSupport.selector, uint8(3)));
        board.castVote(1, 3);
    }

    function test_selector_matches_governor_castVote() public pure {
        assertEq(VoteBoard.castVote.selector, bytes4(keccak256("castVote(uint256,uint8)")));
        assertEq(VoteBoard.castVote.selector, bytes4(0x56781388));
    }
}

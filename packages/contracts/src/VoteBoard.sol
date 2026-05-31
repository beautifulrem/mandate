// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title VoteBoard
/// @notice A lightweight SHARED governance board for the Mandate demo. ANY address (smart account
///         or EOA) casts ONE vote per proposal — no token balance, no snapshot gating — so anyone,
///         including a judge connecting their own wallet, can join the SAME proposal and watch the
///         live tally move.
///
///         castVote(uint256,uint8) deliberately matches the OpenZeppelin Governor selector
///         (0x56781388). The exact same ERC-7710 scoped delegation + DelegationManager
///         .redeemDelegations path that votes on the Governor therefore votes here too, retargeted
///         only by address (AllowedTargets -> VoteBoard). HACKATHON DEMO — NO REAL VALUE.
contract VoteBoard is Ownable {
    // support: 0 = Against, 1 = For, 2 = Abstain (mirrors GovernorCountingSimple).
    // _ballot stores support+1, so 0 means "has not voted".
    mapping(uint256 => mapping(address => uint8)) private _ballot;
    mapping(uint256 => address[]) private _voters;
    mapping(uint256 => uint256[3]) private _tally; // [against, for, abstain]

    event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support);

    error InvalidSupport(uint8 support);
    error LengthMismatch();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Cast (or change) your vote on a proposal. One vote per address.
    /// @dev Signature matches Governor.castVote so a delegation scoped to that selector redeems
    ///      straight into here. Returns 1 (the headcount weight) to mirror Governor's uint256.
    function castVote(uint256 proposalId, uint8 support) external returns (uint256) {
        _record(proposalId, msg.sender, support);
        return 1;
    }

    /// @notice Owner-only batch seed of persona votes (populate the demo board before judging).
    function ownerSeed(uint256 proposalId, address[] calldata voters, uint8[] calldata supportVals)
        external
        onlyOwner
    {
        if (voters.length != supportVals.length) revert LengthMismatch();
        for (uint256 i = 0; i < voters.length; i++) {
            _record(proposalId, voters[i], supportVals[i]);
        }
    }

    function _record(uint256 proposalId, address voter, uint8 support) internal {
        if (support > 2) revert InvalidSupport(support);
        uint8 prev = _ballot[proposalId][voter];
        if (prev == 0) {
            _voters[proposalId].push(voter);
        } else {
            _tally[proposalId][prev - 1] -= 1; // changing a vote: drop the previous bucket
        }
        _ballot[proposalId][voter] = support + 1;
        _tally[proposalId][support] += 1;
        emit VoteCast(proposalId, voter, support);
    }

    // --- views ---------------------------------------------------------------

    /// @return against For-count is the middle return; order is (against, for, abstain).
    function getTally(uint256 proposalId) external view returns (uint256, uint256, uint256) {
        uint256[3] storage t = _tally[proposalId];
        return (t[0], t[1], t[2]);
    }

    function getVoters(uint256 proposalId) external view returns (address[] memory) {
        return _voters[proposalId];
    }

    function voterCount(uint256 proposalId) external view returns (uint256) {
        return _voters[proposalId].length;
    }

    /// @return 0 = not voted, 1 = Against, 2 = For, 3 = Abstain
    function getVote(uint256 proposalId, address voter) external view returns (uint8) {
        return _ballot[proposalId][voter];
    }
}

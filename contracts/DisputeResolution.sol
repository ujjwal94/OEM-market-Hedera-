// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DisputeResolution {
    address public admin;

    enum Status { None, Filed, Resolved }

    struct Dispute {
        uint productId;
        address buyer;
        string reason;
        Status status;
    }

    mapping(uint => Dispute) public disputes;
    uint public disputeCount;

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    function fileDispute(uint productId, string memory reason) public {
        disputes[disputeCount] = Dispute(productId, msg.sender, reason, Status.Filed);
        disputeCount++;
    }

    function resolveDispute(uint disputeId) public onlyAdmin {
        disputes[disputeId].status = Status.Resolved;
    }

    function getDispute(uint disputeId) public view returns (Dispute memory) {
        return disputes[disputeId];
    }
}

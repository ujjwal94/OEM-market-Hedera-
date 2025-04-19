// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OEMRegistry {
    address public admin;

    enum Role { None, OEM, Buyer }
    mapping(address => Role) public users;

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    function registerUser(address user, Role role) public onlyAdmin {
        users[user] = role;
    }

    function getUserRole(address user) public view returns (Role) {
        return users[user];
    }

    function isOEM(address user) public view returns (bool) {
        return users[user] == Role.OEM;
    }

    function isBuyer(address user) public view returns (bool) {
        return users[user] == Role.Buyer;
    }
}

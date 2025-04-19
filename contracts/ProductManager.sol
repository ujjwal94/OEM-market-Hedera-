// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./OEMRegistry.sol";

contract ProductManager {
    OEMRegistry public registry;

    struct Product {
        uint id;
        string name;
        string description;
        uint price;
        address seller;
        bool available;
    }

    uint public productCounter = 0;
    mapping(uint => Product) public products;

    constructor(address registryAddress) {
        registry = OEMRegistry(registryAddress);
    }

    modifier onlyOEM() {
        require(registry.isOEM(msg.sender), "Not an OEM");
        _;
    }

    function addProduct(string memory name, string memory description, uint price) public onlyOEM {
        products[productCounter] = Product(productCounter, name, description, price, msg.sender, true);
        productCounter++;
    }

    function getProduct(uint id) public view returns (Product memory) {
        return products[id];
    }
}

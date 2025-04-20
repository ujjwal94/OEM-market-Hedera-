// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./OEMRegistry.sol";

contract ProductManager {
    OEMRegistry public registry;
    
    // Store the marketplace address
    address public marketplace;
    
    struct Product {
        uint id;
        string name;
        string description;
        uint price;
        address seller;
        bool available;
    }
    
    uint public productCounter;
    mapping(uint => Product) private products;
    
    event ProductAdded(uint id, string name, uint price, address seller);
    event ProductUpdated(uint id, bool available);
    
    constructor(address registryAddress) {
        registry = OEMRegistry(registryAddress);
        productCounter = 0;
    }
    
    modifier onlyOEM() {
        require(registry.isOEM(msg.sender), "Not an OEM");
        _;
    }
    
    // Define the onlyMarketplace modifier
    modifier onlyMarketplace() {
        require(msg.sender == marketplace, "Only marketplace can call");
        _;
    }
    
    // Set the marketplace address (call this after deploying Marketplace)
    function setMarketplace(address marketplaceAddress) external {
        // For testing, allow this to be set by anyone
        marketplace = marketplaceAddress;
    }
    
    function addProduct(string memory name, string memory description, uint price) public onlyOEM returns (uint) {
        productCounter++;
        products[productCounter] = Product(
            productCounter,
            name,
            description,
            price,
            msg.sender,
            true
        );
        
        emit ProductAdded(productCounter, name, price, msg.sender);
        return productCounter;
    }
    
    function getProduct(uint id) public view returns (Product memory) {
        require(id > 0 && id <= productCounter, "Invalid product ID");
        return products[id];
    }
    
    // Function to mark a product as unavailable after purchase
    function markProductUnavailable(uint id) external onlyMarketplace {
        require(id > 0 && id <= productCounter, "Invalid product ID");
        require(products[id].available, "Product already unavailable");
        
        products[id].available = false;
        
        emit ProductUpdated(id, false);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./OEMRegistry.sol";
import "./ProductManager.sol";

contract Marketplace {
    OEMRegistry public registry;
    ProductManager public productManager;

    event Purchase(address buyer, uint productId);

    constructor(address registryAddress, address productManagerAddress) {
        registry = OEMRegistry(registryAddress);
        productManager = ProductManager(productManagerAddress);
    }

    modifier onlyBuyer() {
        require(registry.isBuyer(msg.sender), "Not a buyer");
        _;
    }

    function purchaseProduct(uint productId) public payable onlyBuyer {
        ProductManager.Product memory product = productManager.getProduct(productId);
        require(product.available, "Product not available");
        require(msg.value >= product.price, "Insufficient payment");

        // Transfer payment to seller
        payable(product.seller).transfer(product.price);
        
        // Mark product as sold/unavailable
        productManager.markProductUnavailable(productId);
        
        emit Purchase(msg.sender, productId);
    }
}
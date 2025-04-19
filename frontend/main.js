let provider, signer;
let OEMRegistry, productManager, marketplace, disputeResolution;
let availableProducts = [];

// Your wallet address - will be used for registration
const YOUR_ADDRESS = "0xd1E77a74d017391888A8137892d53f814Dcb7B14";

// Contract addresses
const registryAddress = "0xb16Fb8Cef433811caB8f08c1e82DdC06678D244D";
const productManagerAddress = "0xa4952F14fa54E41334f0d915a0a54162E3a215a1";
const marketplaceAddress = "0xe090ed0325F9dE97e10F6A7c03bB735083644079";
const disputeAddress = "0xA6f95F7F53a921eaF430630FbEaBC631e1BdC710";

// Custom provider for Hedera
const HEDERA_RPC_URL = "https://testnet.hashio.io/api";

// Hedera-specific config based on error message
const HEDERA_MIN_GAS_PRICE = "570000000000"; // 570 Gwei - minimum required by Hedera testnet

// Role definitions based on the OEMRegistry contract
const ROLE_ADMIN = 0;
const ROLE_OEM = 1;
const ROLE_BUYER = 2;

async function connectWallet() {
  const statusDiv = document.getElementById("wallet");

  try {
    // Use direct provider with private key for guaranteed connection
    provider = new ethers.providers.JsonRpcProvider(HEDERA_RPC_URL);
    
    // Use private key (only for testing/development!)
    // const privateKey = "e6fb347bcef5a6aa9a1479e5d3acce6221b97da9e0fd88f4e45144bf667fb629";
    const privateKey = "6901cd9c45d64376247b89d35d153d128511bc81b2508f10c1321e62e7028ce0";
    signer = new ethers.Wallet(privateKey, provider);
    
    if (signer.address !== YOUR_ADDRESS) {
      console.warn("Warning: Connected wallet address doesn't match expected address.");
      console.log("Connected:", signer.address);
      console.log("Expected:", YOUR_ADDRESS);
    }
    
    statusDiv.innerText = `✅ Connected: ${signer.address}`;
    console.log("Connected wallet:", signer.address);

    // Initialize contracts
    try {
      console.log("Loading contract ABIs...");
      const [oemABI, prodABI, marketABI, dispABI] = await Promise.all([
        fetch("./abi/OEMRegistry.json").then(res => {
          if (!res.ok) throw new Error(`Failed to load OEMRegistry ABI: ${res.status}`);
          return res.json();
        }),
        fetch("./abi/ProductManager.json").then(res => {
          if (!res.ok) throw new Error(`Failed to load ProductManager ABI: ${res.status}`);
          return res.json();
        }),
        fetch("./abi/Marketplace.json").then(res => {
          if (!res.ok) throw new Error(`Failed to load Marketplace ABI: ${res.status}`);
          return res.json();
        }),
        fetch("./abi/DisputeResolution.json").then(res => {
          if (!res.ok) throw new Error(`Failed to load DisputeResolution ABI: ${res.status}`);
          return res.json();
        })
      ]);

      // Extract ABIs safely
      const oemAbiData = oemABI.abi || oemABI;
      const prodAbiData = prodABI.abi || prodABI;
      const marketAbiData = marketABI.abi || marketABI;
      const dispAbiData = dispABI.abi || dispABI;

      // Connect to contracts
      OEMRegistry = new ethers.Contract(registryAddress, oemAbiData, signer);
      productManager = new ethers.Contract(productManagerAddress, prodAbiData, signer);
      marketplace = new ethers.Contract(marketplaceAddress, marketAbiData, signer);
      disputeResolution = new ethers.Contract(disputeAddress, dispAbiData, signer);

      console.log("Successfully connected to all contracts");
      
      // Check current roles
      await checkUserRoles();
      
      // Load available products
      await loadAvailableProducts();
      
    } catch (abiError) {
      console.error("Error loading or parsing ABIs:", abiError);
      alert(`Failed to load contract definitions: ${abiError.message}`);
    }
  } catch (error) {
    console.error("❌ Connection failed:", error);
    statusDiv.innerText = "❌ Failed to connect.";
    alert(`Connection failed: ${error.message}`);
  }
}

async function checkUserRoles() {
  if (!OEMRegistry) {
    console.log("OEMRegistry not initialized. Please connect wallet first.");
    return;
  }
  
  try {
    // Check if user is an OEM
    const isOEM = await OEMRegistry.isOEM(YOUR_ADDRESS);
    console.log("Is OEM:", isOEM);
    
    // Check if user is a Buyer
    const isBuyer = await OEMRegistry.isBuyer(YOUR_ADDRESS);
    console.log("Is Buyer:", isBuyer);
    
    // Get user role
    const role = await OEMRegistry.getUserRole(YOUR_ADDRESS);
    console.log("User Role:", role.toString());
    
    const roleMap = {
      "0": "Admin",
      "1": "OEM",
      "2": "Buyer"
    };
    
    const roleStatus = document.getElementById("roleStatus");
    if (roleStatus) {
      roleStatus.innerHTML = `
        <strong>Current Roles:</strong><br>
        OEM: ${isOEM ? '✅' : '❌'}<br>
        Buyer: ${isBuyer ? '✅' : '❌'}<br>
        Role: ${roleMap[role.toString()] || 'Unknown'}
      `;
    }
    
    return { isOEM, isBuyer, role: role.toString() };
  } catch (error) {
    console.error("Error checking user roles:", error);
    return null;
  }
}

async function loadAvailableProducts() {
  if (!productManager) {
    console.log("ProductManager not initialized. Please connect wallet first.");
    return;
  }
  
  try {
    // Get product counter (total number of products)
    const productCounter = await productManager.productCounter();
    console.log("Total products:", productCounter.toString());
    
    // Create an array to store all product promises
    const productPromises = [];
    
    // Loop through all product IDs and fetch their details
    for (let i = 1; i <= productCounter; i++) {
      productPromises.push(productManager.getProduct(i));
    }
    
    // Wait for all product details to be fetched
    const products = await Promise.all(productPromises);
    console.log("All products:", products);
    
    // Filter for available products
    availableProducts = products.filter(product => {
      // Check if available flag is true (could be at index 5 or as a named property)
      const isAvailable = product.available !== undefined ? product.available : product[5];
      return isAvailable;
    });
    
    console.log("Available products:", availableProducts);
    
    // Populate dropdown menus
    populateProductDropdowns(availableProducts);
    
  } catch (error) {
    console.error("Error loading products:", error);
    alert(`Error loading products: ${error.message}`);
  }
}

function populateProductDropdowns(products) {
  // Get all dropdown elements
  const buyDropdown = document.getElementById("productDropdown");
  const disputeDropdown = document.getElementById("disputeProductDropdown");
  const infoDropdown = document.getElementById("infoProductDropdown");
  
  // Clear existing options except the first one
  buyDropdown.innerHTML = `<option value="">-- Select a product --</option>`;
  disputeDropdown.innerHTML = `<option value="">-- Select a product --</option>`;
  infoDropdown.innerHTML = `<option value="">-- Select a product --</option>`;
  
  // Add products to dropdowns
  products.forEach(product => {
    const id = product.id ? product.id.toString() : product[0].toString();
    const name = product.name || product[1] || "Unknown Product";
    const price = product.price ? ethers.utils.formatEther(product.price) : 
                ethers.utils.formatEther(product[3]);
    
    // Create option element
    const option = `<option value="${id}">${id} - ${name} (${price} HBAR)</option>`;
    
    // Add to all dropdowns
    buyDropdown.innerHTML += option;
    disputeDropdown.innerHTML += option;
    infoDropdown.innerHTML += option;
  });
  
  // Add event listeners to update details when dropdown changes
  buyDropdown.addEventListener("change", updateSelectedProductDetails);
  infoDropdown.addEventListener("change", getSelectedProductInfo);
}

function updateSelectedProductDetails() {
  const selectedId = document.getElementById("productDropdown").value;
  const detailsDiv = document.getElementById("selectedProductDetails");
  
  if (!selectedId) {
    detailsDiv.innerHTML = "No product selected";
    return;
  }
  
  // Find the selected product in the available products array
  const selectedProduct = availableProducts.find(product => {
    const id = product.id ? product.id.toString() : product[0].toString();
    return id === selectedId;
  });
  
  if (!selectedProduct) {
    detailsDiv.innerHTML = "Product not found";
    return;
  }
  
  // Extract product details
  const id = selectedProduct.id ? selectedProduct.id.toString() : selectedProduct[0].toString();
  const name = selectedProduct.name || selectedProduct[1] || "Unknown Product";
  const description = selectedProduct.description || selectedProduct[2] || "No description";
  const price = selectedProduct.price ? ethers.utils.formatEther(selectedProduct.price) : 
              ethers.utils.formatEther(selectedProduct[3]);
  const seller = selectedProduct.seller || selectedProduct[4];
  
  // Update buy amount input with the product price
  document.getElementById("buyAmount").value = price;
  
  // Display product details
  detailsDiv.innerHTML = `
    <strong>Product ID:</strong> ${id}<br>
    <strong>Name:</strong> ${name}<br>
    <strong>Price:</strong> ${price} HBAR<br>
  `;
}

function showDebugInfo() {
  const debugDiv = document.getElementById("debug-output");
  
  if (!OEMRegistry || !productManager || !marketplace || !disputeResolution) {
    debugDiv.innerHTML = "Please connect your wallet first to see contract functions.";
    return;
  }
  
  let debugInfo = "<h3>Available Contract Functions</h3>";
  
  debugInfo += "<h4>OEMRegistry</h4>";
  debugInfo += "<pre>" + Object.keys(OEMRegistry.functions).join("\n") + "</pre>";
  
  debugInfo += "<h4>ProductManager</h4>";
  debugInfo += "<pre>" + Object.keys(productManager.functions).join("\n") + "</pre>";
  
  debugInfo += "<h4>Marketplace</h4>";
  debugInfo += "<pre>" + Object.keys(marketplace.functions).join("\n") + "</pre>";
  
  debugInfo += "<h4>DisputeResolution</h4>";
  debugInfo += "<pre>" + Object.keys(disputeResolution.functions).join("\n") + "</pre>";
  
  debugDiv.innerHTML = debugInfo;
}

async function checkProductAvailability() {
  const debugDiv = document.getElementById("debug-output");
  
  // Get the selected product ID from any of the dropdowns
  const buyDropdownId = document.getElementById("productDropdown").value;
  const infoDropdownId = document.getElementById("infoProductDropdown").value;
  const disputeDropdownId = document.getElementById("disputeProductDropdown").value;
  
  const productId = buyDropdownId || infoDropdownId || disputeDropdownId;
  
  if (!productId) {
    debugDiv.innerHTML = "Please select a product to check first.";
    return;
  }
  
  if (!productManager) {
    debugDiv.innerHTML = "Please connect wallet first.";
    return;
  }
  
  try {
    // Get the product details
    const product = await productManager.getProduct(productId);
    
    // Extract availability info
    const isAvailable = product.available !== undefined ? product.available : product[5];
    const seller = product.seller || product[4];
    const price = product.price || product[3];
    
    // Try a static call to check if purchase would succeed
    let callResult = "Not attempted";
    try {
      await marketplace.callStatic.purchaseProduct(productId, {
        value: price,
        gasLimit: ethers.utils.hexlify(2000000),
        gasPrice: ethers.BigNumber.from(HEDERA_MIN_GAS_PRICE)
      });
      callResult = "✅ Static call succeeded - transaction should work";
    } catch (callError) {
      callResult = "❌ Static call failed: " + callError.message;
    }
    
    // Check if the seller is the zero address
    const isZeroAddress = seller === "0x0000000000000000000000000000000000000000";
    
    // Check if you're trying to buy your own product
    const isOwnProduct = seller.toLowerCase() === YOUR_ADDRESS.toLowerCase();
    
    const debugHTML = `
      <h3>Product ${productId} Debug Info</h3>
      <pre>
Available: ${isAvailable ? "✅ Yes" : "❌ No"}
Seller: ${seller}
Price: ${ethers.utils.formatEther(price)} HBAR
Zero Address Seller: ${isZeroAddress ? "⚠️ Yes" : "✅ No"}
Your Own Product: ${isOwnProduct ? "⚠️ Yes" : "✅ No"}
Static Purchase Call: ${callResult}
      </pre>
    `;
    
    debugDiv.innerHTML = debugHTML;
    
  } catch (error) {
    console.error("Error checking product:", error);
    debugDiv.innerHTML = `Error checking product: ${error.message}`;
  }
}

async function registerOEM() {
  if (!OEMRegistry) {
    alert("Please connect wallet first.");
    return;
  }

  try {
    console.log("Attempting to register as OEM with address:", YOUR_ADDRESS);
    
    // First check if already registered
    const isAlreadyOEM = await OEMRegistry.isOEM(YOUR_ADDRESS);
    console.log("Is already OEM?", isAlreadyOEM);
    
    if (isAlreadyOEM) {
      alert("Address is already registered as OEM!");
      return;
    }
    
    // Add gas configuration for Hedera
    const overrides = {
      gasLimit: ethers.utils.hexlify(1000000),
      gasPrice: ethers.BigNumber.from(HEDERA_MIN_GAS_PRICE)
    };
    
    console.log("Using gas price:", ethers.utils.formatUnits(HEDERA_MIN_GAS_PRICE, "gwei"), "Gwei");
    
    // Register user as OEM (role = 1)
    const tx = await OEMRegistry.registerUser(YOUR_ADDRESS, ROLE_OEM, overrides);
    console.log("Registration transaction sent:", tx.hash);
    
    alert("OEM registration transaction submitted. Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ OEM Registration confirmed:", receipt);
    
    // Check roles again
    await checkUserRoles();
    
    alert("Successfully registered as OEM!");
    
  } catch (error) {
    console.error("❌ Error in OEM registration process:", error);
    
    if (error.message && error.message.includes("Not admin")) {
      alert("Failed to register: Only the admin can register users. Contact the admin to register you.");
    } else if (error.message && error.message.includes("gas price")) {
      alert("Gas price error: Hedera requires a minimum gas price of 570 Gwei. Please try again.");
    } else {
      alert(`Registration failed: ${error.message}`);
    }
  }
}

async function registerAsBuyer() {
  if (!OEMRegistry) {
    alert("Please connect wallet first.");
    return;
  }

  try {
    console.log("Attempting to register as buyer with address:", YOUR_ADDRESS);
    
    // First check if already registered
    const isAlreadyBuyer = await OEMRegistry.isBuyer(YOUR_ADDRESS);
    console.log("Is already buyer?", isAlreadyBuyer);
    
    if (isAlreadyBuyer) {
      alert("Address is already registered as buyer!");
      return;
    }
    
    // Add gas configuration for Hedera
    const overrides = {
      gasLimit: ethers.utils.hexlify(1000000),
      gasPrice: ethers.BigNumber.from(HEDERA_MIN_GAS_PRICE)
    };
    
    console.log("Using gas price:", ethers.utils.formatUnits(HEDERA_MIN_GAS_PRICE, "gwei"), "Gwei");
    
    // Register user as Buyer (role = 2)
    const tx = await OEMRegistry.registerUser(YOUR_ADDRESS, ROLE_BUYER, overrides);
    console.log("Registration transaction sent:", tx.hash);
    
    alert("Buyer registration transaction submitted. Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ Buyer Registration confirmed:", receipt);
    
    // Check roles again
    await checkUserRoles();
    
    alert("Successfully registered as buyer!");
    
  } catch (error) {
    console.error("❌ Error in buyer registration process:", error);
    
    if (error.message && error.message.includes("Not admin")) {
      alert("Failed to register: Only the admin can register users. Contact the admin to register you.");
    } else if (error.message && error.message.includes("gas price")) {
      alert("Gas price error: Hedera requires a minimum gas price of 570 Gwei. Please try again.");
    } else {
      alert(`Registration failed: ${error.message}`);
    }
  }
}

async function addProduct() {
  if (!productManager) {
    alert("Please connect wallet first.");
    return;
  }

  const name = document.getElementById("prodName").value.trim();
  const desc = document.getElementById("prodDesc").value.trim();
  const priceInHBAR = document.getElementById("prodPrice").value.trim();

  if (!name || !desc || !priceInHBAR || isNaN(Number(priceInHBAR))) {
    alert("Please enter valid product details.");
    return;
  }

  try {
    // Check if user is an OEM
    const isOEM = await OEMRegistry.isOEM(YOUR_ADDRESS);
    if (!isOEM) {
      alert("You must be registered as an OEM to add products!");
      return;
    }
    
    console.log(`Adding product: ${name}, ${desc}, ${priceInHBAR} HBAR`);
    
    // Convert HBAR price to wei (10^18)
    const priceBN = ethers.utils.parseEther(priceInHBAR);
    console.log("Price in wei:", priceBN.toString());
    
    // Add gas configuration for Hedera with CORRECT minimum gas price
    const overrides = {
      gasLimit: ethers.utils.hexlify(1000000),
      gasPrice: ethers.BigNumber.from(HEDERA_MIN_GAS_PRICE)
    };
    
    // Add the product
    const tx = await productManager.addProduct(name, desc, priceBN, overrides);
    console.log("Transaction sent:", tx.hash);
    
    alert("Product addition transaction submitted. Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);
    
    if (receipt.status === 1) {
      alert("Product added successfully.");
      // Clear inputs
      document.getElementById("prodName").value = "";
      document.getElementById("prodDesc").value = "";
      document.getElementById("prodPrice").value = "";
      
      // Reload available products
      await loadAvailableProducts();
    } else {
      alert("Transaction completed but may have failed. Check the console for details.");
    }
  } catch (err) {
    console.error("❌ Error adding product:", err);
    
    // Better error handling
    if (err.message && err.message.includes("Not an OEM")) {
      alert("Error: You must be registered as an OEM to add products.");
    } else if (err.message && err.message.includes("gas required exceeds")) {
      alert("Transaction failed: Gas estimation failed. The transaction might revert on the blockchain.");
    } else if (err.message && err.message.includes("insufficient funds")) {
      alert("Transaction failed: Insufficient funds for gas.");
    } else {
      alert(`Error adding product: ${err.message}`);
    }
  }
}

async function buySelectedProduct() {
  if (!marketplace) {
    alert("Please connect wallet first.");
    return;
  }

  const idSelect = document.getElementById("productDropdown");
  const id = idSelect.value;
  const amount = document.getElementById("buyAmount").value.trim();

  if (!id) {
    alert("Please select a product to buy.");
    return;
  }

  if (!amount || isNaN(Number(amount))) {
    alert("Invalid amount. Please enter a valid number.");
    return;
  }

  try {
    // Check if user is a buyer
    const isBuyer = await OEMRegistry.isBuyer(YOUR_ADDRESS);
    if (!isBuyer) {
      alert("You must be registered as a buyer to purchase products!");
      return;
    }
    
    console.log(`Buying product ID: ${id} with amount: ${amount} HBAR`);
    
    // Convert to BigNumber for safety
    const idBN = ethers.BigNumber.from(id);
    
    // Convert from HBAR to wei directly using parseEther
    let amountBN = ethers.utils.parseEther(amount);
    
    console.log("Product ID:", idBN.toString());
    console.log("Amount in wei:", amountBN.toString());
    
    // Verify product exists and get its details
    let productPrice;
    try {
      const product = await productManager.getProduct(idBN);
      console.log("Complete product details:", product);
      
      // Extract price (index 3 or price property)
      productPrice = product.price || product[3];
      console.log("Product price:", productPrice.toString());
      
      // Make sure we're sending enough
      if (productPrice.gt(amountBN)) {
        const requiredAmount = ethers.utils.formatEther(productPrice);
        alert(`Product costs ${requiredAmount} HBAR but you're only sending ${amount} HBAR. Please increase your amount.`);
        return;
      }
      
      // Check if you're the seller
      const seller = product.seller || product[4];
      if (seller.toLowerCase() === YOUR_ADDRESS.toLowerCase()) {
        if (!confirm("You are the seller of this product. Most marketplaces don't allow buying your own products. Try anyway?")) {
          return;
        }
      }
      
      // Add a small buffer to the price (sometimes contracts require a bit more to cover fees)
      const buffer = ethers.utils.parseEther("0.001"); // 0.001 HBAR buffer
      amountBN = productPrice.add(buffer);
      console.log("Sending with buffer:", ethers.utils.formatEther(amountBN), "HBAR");
    } catch (productError) {
      console.error("Error fetching product:", productError);
      alert("Error fetching product details. The product may not exist.");
      return;
    }
    
    // Add gas configuration for Hedera with higher gas limit and price
    const overrides = {
      value: amountBN,
      gasLimit: ethers.utils.hexlify(3000000), // Higher gas limit
      gasPrice: ethers.BigNumber.from(HEDERA_MIN_GAS_PRICE)
    };
    
    // Try a different approach - buy with a different wallet if available
    const tx = await marketplace.purchaseProduct(idBN, overrides);
    console.log("Transaction sent:", tx.hash);
    
    alert("Purchase transaction submitted. Waiting for confirmation...");
    
    try {
      const receipt = await tx.wait();
      console.log("Transaction receipt:", receipt);
      
      if (receipt.status === 0) {
        throw new Error("Transaction reverted on the blockchain. See console for details.");
      }
      
      alert("Purchase successful!");
      
      // Reload available products after purchase
      await loadAvailableProducts();
    } catch (receiptError) {
      console.error("Transaction failed after submission:", receiptError);
      throw new Error("Transaction failed: " + receiptError.message);
    }
    
  } catch (error) {
    console.error("❌ Purchase failed:", error);
    
    // Improved error handling for common errors
    if (error.message && error.message.includes("Not a buyer")) {
      alert("Error: You are not registered as a buyer. Please register as a buyer first.");
    } else if (error.message && error.message.includes("Product not available")) {
      alert("Error: This product is not available for purchase.");
    } else if (error.message && error.message.includes("Insufficient payment")) {
      alert("Error: The payment amount is insufficient to buy this product.");
    } else if (error.message && error.message.includes("transaction failed")) {
      // This is a reverted transaction
      alert("Transaction was reverted by the smart contract. This could be due to:\n" +
            "1. The product doesn't exist or is already sold\n" +
            "2. You're not authorized to buy this product\n" +
            "3. There's an issue with the product price vs. the amount sent\n" +
            "4. The contract might have a restriction against buying your own products\n" +
            "Check the console for more details.");
    } else if (error.message && error.message.includes("10_000_000_000 wei")) {
      alert("Transaction failed: Hedera requires a minimum transaction value of 0.0001 HBAR (1 tinybar).");
    } else {
      alert(`Purchase failed: ${error.message}`);
    }
  }
}

async function fileDisputeForSelected() {
  if (!disputeResolution) {
    alert("Please connect wallet first.");
    return;
  }

  const idSelect = document.getElementById("disputeProductDropdown");
  const id = idSelect.value;
  const reason = document.getElementById("disputeReason").value.trim();

  if (!id) {
    alert("Please select a product to file a dispute for.");
    return;
  }

  if (!reason) {
    alert("Please enter a reason for the dispute.");
    return;
  }

  try {
    console.log(`Filing dispute for product ${id}: ${reason}`);
    
    // Convert to BigNumber
    const idBN = ethers.BigNumber.from(id);
    
    // Add gas configuration for Hedera with CORRECT minimum gas price
    const overrides = {
      gasLimit: ethers.utils.hexlify(1000000),
      gasPrice: ethers.BigNumber.from(HEDERA_MIN_GAS_PRICE)
    };
    
    const tx = await disputeResolution.fileDispute(idBN, reason, overrides);
    console.log("Transaction sent:", tx.hash);
    
    alert("Dispute submission in progress. Please wait for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);
    
    if (receipt.status === 1) {
      alert("Dispute filed successfully.");
      // Clear inputs
      document.getElementById("disputeProductDropdown").value = "";
      document.getElementById("disputeReason").value = "";
    } else {
      alert("Transaction completed but may have failed. Check the console for details.");
    }
  } catch (error) {
    console.error("❌ Error filing dispute:", error);
    
    if (error.message && error.message.includes("transaction failed")) {
      alert("Filing dispute failed. The transaction was reverted by the contract. You may not have permission or the product ID may be invalid.");
    } else {
      alert(`Error filing dispute: ${error.message}`);
    }
  }
}

async function getSelectedProductInfo() {
  if (!productManager) {
    alert("Please connect wallet first.");
    return;
  }

  const idSelect = document.getElementById("infoProductDropdown");
  const id = idSelect.value;
  const infoDiv = document.getElementById("productInfo");

  if (!id) {
    infoDiv.innerHTML = "Please select a product to view information.";
    return;
  }

  try {
    console.log("Fetching information for product ID:", id);
    
    // Convert to BigNumber
    const idBN = ethers.BigNumber.from(id);
    
    const product = await productManager.getProduct(idBN);
    console.log("Product details:", product);
    
    // Format the product information for display
    let productInfo = "";
    
    if (product) {
      const productId = product.id ? product.id.toString() : (product[0] ? product[0].toString() : "Unknown");
      const name = product.name || product[1] || "Unknown";
      const description = product.description || product[2] || "Unknown";
      const price = product.price ? ethers.utils.formatEther(product.price) : 
                   (product[3] ? ethers.utils.formatEther(product[3]) : "Unknown");
      const seller = product.seller || product[4] || "Unknown";
      const isAvailable = (product.available !== undefined) ? product.available : 
                         ((product[5] !== undefined) ? product[5] : "Unknown");
      
      productInfo = `
        <strong>Product ID:</strong> ${productId}<br>
        <strong>Name:</strong> ${name}<br>
        <strong>Description:</strong> ${description}<br>
        <strong>Price:</strong> ${price} HBAR<br>
        <strong>Seller:</strong> ${seller}<br>
        <strong>Available:</strong> ${isAvailable ? "Yes" : "No"}<br>
      `;
    } else {
      productInfo = "Product not found or data format is unexpected.";
    }
    
    infoDiv.innerHTML = productInfo;
  } catch (error) {
    console.error("❌ Error getting product info:", error);
    infoDiv.innerHTML = `Error fetching product information: ${error.message}`;
  }
}
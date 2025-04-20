let provider, signer;
let OEMRegistry, productManager, marketplace, disputeResolution;
let availableProducts = [];

// Create a Set to track purchased products
const purchasedProducts = new Set();

// Your wallet address - will be used for registration
const YOUR_ADDRESS = "0xF1c0cF6924ECe517667Ea0A3393393391D01b863";
// Buyer wallet address for purchasing products
const BUYER_ADDRESS = "0xd1E77a74d017391888A8137892d53f814Dcb7B14";
let buyerSigner = null;

// Contract addresses
const registryAddress = "0xccEC3be4217c3335390299B290db88cA5Fd47573";
const productManagerAddress = "0x54448C23AE24c7eaE4e0CE47CB31cB75e6AD6F33";
const marketplaceAddress = "0xB284F908Ce1d946bB4ef9A5b0Efc6460cA5d8d5b";
const disputeAddress = "0x6DDBDdeE3598fC4eBD187942048137253E09fFa6";

// OEMRegistry:        0xccEC3be4217c3335390299B290db88cA5Fd47573
// ProductManager:     0x54448C23AE24c7eaE4e0CE47CB31cB75e6AD6F33
// Marketplace:        0xB284F908Ce1d946bB4ef9A5b0Efc6460cA5d8d5b
// DisputeResolution:  0x6DDBDdeE3598fC4eBD187942048137253E09fFa6

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
    const privateKey = "e6fb347bcef5a6aa9a1479e5d3acce6221b97da9e0fd88f4e45144bf667fb629";
    signer = new ethers.Wallet(privateKey, provider);
    
    // Initialize buyer signer with a different wallet
    // This wallet will be used for purchasing products
    // For the demo, we'll initialize it but in production this would be done via MetaMask
    const buyerPrivateKey = "6901cd9c45d64376247b89d35d153d128511bc81b2508f10c1321e62e7028ce0"; // Add a private key for testing or use MetaMask
    buyerSigner = new ethers.Wallet(buyerPrivateKey, provider);
    
    if (signer.address !== YOUR_ADDRESS) {
      console.warn("Warning: Connected wallet address doesn't match expected address.");
      console.log("Connected:", signer.address);
      console.log("Expected:", YOUR_ADDRESS);
    }
    
    statusDiv.innerText = `✅ Connected: ${signer.address}`;
    console.log("Connected wallet:", signer.address);
    console.log("Buyer wallet:", BUYER_ADDRESS);

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


async function setMarketplaceInProductManager() {
  if (!productManager || !marketplace) {
    alert("Please connect wallet first.");
    return;
  }

  try {
    console.log("Setting marketplace address in ProductManager...");
    console.log("Marketplace address:", marketplaceAddress);
    
    // Add gas configuration for Hedera
    const overrides = {
      gasLimit: ethers.utils.hexlify(1000000),
      gasPrice: ethers.BigNumber.from(HEDERA_MIN_GAS_PRICE)
    };
    
    // Set the marketplace address in the ProductManager
    const tx = await productManager.setMarketplace(marketplaceAddress, overrides);
    console.log("Transaction sent:", tx.hash);
    
    alert("Setting marketplace address. Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);
    
    if (receipt.status === 1) {
      alert("Marketplace address set successfully.");
      
      // Verify the setting
      const setAddress = await productManager.marketplace();
      console.log("Verified marketplace address:", setAddress);
      
      if (setAddress.toLowerCase() === marketplaceAddress.toLowerCase()) {
        console.log("✅ Marketplace address correctly set in ProductManager");
      } else {
        console.warn("⚠️ Marketplace address mismatch!", setAddress, marketplaceAddress);
      }
    } else {
      alert("Transaction completed but may have failed. Check the console for details.");
    }
  } catch (error) {
    console.error("❌ Error setting marketplace address:", error);
    alert(`Error: ${error.message}`);
  }
}

// Modified checkUserRoles function to check both YOUR_ADDRESS and BUYER_ADDRESS
async function checkUserRoles() {
  if (!OEMRegistry) {
    console.log("OEMRegistry not initialized. Please connect wallet first.");
    return;
  }
  
  try {
    // Check if YOUR_ADDRESS is an OEM
    const isOEM = await OEMRegistry.isOEM(YOUR_ADDRESS);
    console.log("Is OEM:", isOEM);
    
    // Check if YOUR_ADDRESS is a Buyer
    const isBuyer = await OEMRegistry.isBuyer(YOUR_ADDRESS);
    console.log("Is Buyer:", isBuyer);
    
    // Get YOUR_ADDRESS role
    const role = await OEMRegistry.getUserRole(YOUR_ADDRESS);
    console.log("Your Role:", role.toString());
    
    // Check if BUYER_ADDRESS is registered as a buyer
    let isBuyerRegistered = false;
    let buyerRole = "Unknown";
    try {
      isBuyerRegistered = await OEMRegistry.isBuyer(BUYER_ADDRESS);
      buyerRole = await OEMRegistry.getUserRole(BUYER_ADDRESS);
      console.log("Is Buyer address registered:", isBuyerRegistered);
      console.log("Buyer address role:", buyerRole.toString());
    } catch (e) {
      console.log("Could not check buyer address registration", e);
    }
    
    const roleMap = {
      "0": "Admin",
      "1": "OEM",
      "2": "Buyer"
    };
    
    const roleStatus = document.getElementById("roleStatus");
    if (roleStatus) {
      roleStatus.innerHTML = `
        <h3>OEM Address (${YOUR_ADDRESS.substring(0, 6)}...${YOUR_ADDRESS.substring(38)})</h3>
        <strong>Status:</strong><br>
        Registered as OEM: ${isOEM ? '✅' : '❌'}<br>
        Role: ${roleMap[role.toString()] || 'Unknown'}<br>
        
        <h3>Buyer Address (${BUYER_ADDRESS.substring(0, 6)}...${BUYER_ADDRESS.substring(38)})</h3>
        <strong>Status:</strong><br>
        Registered as Buyer: ${isBuyerRegistered ? '✅' : '❌'}<br>
        Role: ${roleMap[buyerRole.toString()] || 'Unknown'}
      `;
    }
    
    return { 
      yourAddress: {
        isOEM, 
        isBuyer, 
        role: role.toString()
      },
      buyerAddress: {
        isBuyerRegistered,
        role: buyerRole.toString()
      }
    };
  } catch (error) {
    console.error("Error checking user roles:", error);
    return null;
  }
}

// Improved loadAvailableProducts function
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
    
    // Filter for available products with more robust checking
    availableProducts = products.filter(product => {
      // Check if the product is properly formed
      if (!product) return false;
      
      // Extract the availability property regardless of structure
      let isAvailable;
      if (typeof product.available !== 'undefined') {
        isAvailable = product.available;
      } else if (typeof product[5] !== 'undefined') {
        isAvailable = product[5];
      } else {
        console.warn(`Product ${product.id || product[0]} has no availability property`);
        return false;
      }
      
      // Also check that the seller isn't zero address which might indicate a deleted or invalid product
      const seller = product.seller || product[4];
      const isValidSeller = seller && seller !== "0x0000000000000000000000000000000000000000";
      
      return isAvailable && isValidSeller;
    });
    
    console.log("Available products:", availableProducts);
    
    // Populate dropdown menus
    populateProductDropdowns(availableProducts);
    
    // Update UI to show the count of available products
    const countElem = document.getElementById("availableProductCount");
    if (countElem) {
      countElem.innerText = `${availableProducts.length} available products`;
    }
    
    return availableProducts;
  } catch (error) {
    console.error("Error loading products:", error);
    alert(`Error loading products: ${error.message}`);
    return [];
  }
}


// Improved function to populate product dropdowns with better handling
function populateProductDropdowns(products) {
  // Get all dropdown elements
  const buyDropdown = document.getElementById("productDropdown");
  const disputeDropdown = document.getElementById("disputeProductDropdown");
  const infoDropdown = document.getElementById("infoProductDropdown");
  
  // Store current selections before clearing
  const buySelected = buyDropdown ? buyDropdown.value : "";
  const disputeSelected = disputeDropdown ? disputeDropdown.value : "";
  const infoSelected = infoDropdown ? infoDropdown.value : "";
  
  // Clear existing options except the first one
  if (buyDropdown) buyDropdown.innerHTML = `<option value="">-- Select a product --</option>`;
  if (disputeDropdown) disputeDropdown.innerHTML = `<option value="">-- Select a product --</option>`;
  if (infoDropdown) infoDropdown.innerHTML = `<option value="">-- Select a product --</option>`;
  
  // Check if we have any products
  if (!products || products.length === 0) {
    console.log("No products available to populate dropdowns");
    
    // Update any status indicators
    const countElement = document.getElementById("availableProductCount");
    if (countElement) {
      countElement.textContent = "0 available products";
    }
    
    // Clear product details since there are no products
    const detailsDiv = document.getElementById("selectedProductDetails");
    if (detailsDiv) {
      detailsDiv.innerHTML = "No products available at this time";
    }
    
    return;
  }
  
  console.log(`Populating dropdowns with ${products.length} products`);
  
  // Add products to dropdowns
  products.forEach(product => {
    // Safely extract product ID
    let id = "";
    if (product.id) {
      id = product.id.toString();
    } else if (product[0]) {
      id = product[0].toString();
    } else {
      console.warn("Product has no ID, skipping", product);
      return;
    }
    
    // Safely extract product name
    const name = product.name || product[1] || "Unknown Product";
    
    // Safely extract product price
    let price = "Unknown";
    try {
      if (product.price) {
        price = ethers.utils.formatEther(product.price);
      } else if (product[3]) {
        price = ethers.utils.formatEther(product[3]);
      }
    } catch (e) {
      console.warn("Error formatting price for product", id, e);
    }
    
    // Create option element
    const option = `<option value="${id}">${id} - ${name} (${price} HBAR)</option>`;
    
    // Add to all dropdowns
    if (buyDropdown) buyDropdown.innerHTML += option;
    if (disputeDropdown) disputeDropdown.innerHTML += option;
    if (infoDropdown) infoDropdown.innerHTML += option;
  });
  
  // Update product count indicator
  const countElement = document.getElementById("availableProductCount");
  if (countElement) {
    countElement.textContent = `${products.length} available product${products.length !== 1 ? 's' : ''}`;
  }
  
  // Try to restore previous selections if products still exist
  try {
    if (buySelected && buyDropdown && buyDropdown.querySelector(`option[value="${buySelected}"]`)) {
      buyDropdown.value = buySelected;
      // Manually trigger product details update
      if (typeof window.updateSelectedProductDetails === 'function') {
        window.updateSelectedProductDetails();
      }
    }
    
    if (disputeSelected && disputeDropdown && disputeDropdown.querySelector(`option[value="${disputeSelected}"]`)) {
      disputeDropdown.value = disputeSelected;
    }
    
    if (infoSelected && infoDropdown && infoDropdown.querySelector(`option[value="${infoSelected}"]`)) {
      infoDropdown.value = infoSelected;
      // Manually trigger product info update
      if (typeof window.getSelectedProductInfo === 'function') {
        window.getSelectedProductInfo();
      }
    }
  } catch (e) {
    console.warn("Error restoring selections:", e);
  }
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
      // Create a marketplace contract connected to the buyer wallet
      const marketplaceAsBuyer = marketplace.connect(buyerSigner);
      
      await marketplaceAsBuyer.callStatic.purchaseProduct(productId, {
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
Your Own Product: ${isOwnProduct ? "⚠️ Yes (Will use different buyer address)" : "✅ No"}
Will purchase as: ${BUYER_ADDRESS}
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
    // ONLY register the BUYER_ADDRESS as a buyer
    // Don't register YOUR_ADDRESS as both OEM and Buyer
    console.log("Attempting to register buyer address:", BUYER_ADDRESS);
    
    // Check if already registered
    const isBuyerRegistered = await OEMRegistry.isBuyer(BUYER_ADDRESS);
    console.log("Is buyer already registered?", isBuyerRegistered);
    
    if (isBuyerRegistered) {
      alert("Buyer address is already registered!");
      return;
    }
    
    // Add gas configuration for Hedera
    const overrides = {
      gasLimit: ethers.utils.hexlify(1000000),
      gasPrice: ethers.BigNumber.from(HEDERA_MIN_GAS_PRICE)
    };
    
    // Register ONLY the separate BUYER_ADDRESS as Buyer (role = 2)
    const tx = await OEMRegistry.registerUser(BUYER_ADDRESS, ROLE_BUYER, overrides);
    console.log("Buyer registration transaction sent:", tx.hash);
    
    alert("Buyer registration transaction submitted. Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ Buyer Registration confirmed:", receipt);
    
    // Check roles again
    await checkUserRoles();
    
    alert(`Successfully registered ${BUYER_ADDRESS} as buyer!`);
    
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

// Improved buySelectedProduct function that properly updates the UI after purchase
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
    // We'll now use the separate buyer address for purchases
    console.log(`Buying product ID: ${id} with amount: ${amount} HBAR as address: ${BUYER_ADDRESS}`);
    
    // Convert to BigNumber for safety
    const idBN = ethers.BigNumber.from(id);
    
    // Convert from HBAR to wei directly using parseEther
    let amountBN = ethers.utils.parseEther(amount);
    
    console.log("Product ID:", idBN.toString());
    console.log("Amount in wei:", amountBN.toString());
    
    // Verify product exists and get its details
    let productPrice;
    let originalProduct;
    try {
      originalProduct = await productManager.getProduct(idBN);
      console.log("Complete product details:", originalProduct);

      // Check buyer account is not same as seller
      const seller = originalProduct.seller || originalProduct[4];
      if (seller.toLowerCase() === BUYER_ADDRESS.toLowerCase()) {
        alert("Error: The buyer cannot purchase their own product. Please use a different buyer address.");
        return;
      }
      
      // Instead, add debug information
      console.log("Product seller:", seller);
      console.log("Buyer address:", BUYER_ADDRESS);
      console.log("Your address:", YOUR_ADDRESS);
      
      // Extract price (index 3 or price property)
      productPrice = originalProduct.price || originalProduct[3];
      console.log("Product price:", productPrice.toString());
      
      // Make sure we're sending enough
      if (productPrice.gt(amountBN)) {
        const requiredAmount = ethers.utils.formatEther(productPrice);
        alert(`Product costs ${requiredAmount} HBAR but you're only sending ${amount} HBAR. Please increase your amount.`);
        return;
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
    
    // For development/testing when MetaMask is not available, use the direct approach
    // Make sure buyer signer is properly initialized
    if (!buyerSigner) {
      alert("Buyer wallet not initialized. Connect wallet first.");
      return;
    }
    
    // Check if buyer is registered
    const isBuyerRegistered = await OEMRegistry.isBuyer(BUYER_ADDRESS);
    if (!isBuyerRegistered) {
      alert("The buyer address is not registered. Registering it now as a buyer.");
      try {
        const regOverrides = {
          gasLimit: ethers.utils.hexlify(1000000),
          gasPrice: ethers.BigNumber.from(HEDERA_MIN_GAS_PRICE)
        };
        const buyerTx = await OEMRegistry.registerUser(BUYER_ADDRESS, ROLE_BUYER, regOverrides);
        await buyerTx.wait();
        console.log("Buyer registered successfully");
      } catch (regError) {
        console.error("Failed to register buyer:", regError);
        alert(`Failed to register buyer: ${regError.message}`);
        return;
      }
    }
    
    // Create a marketplace contract connected to the buyer wallet
    const marketplaceAsBuyer = marketplace.connect(buyerSigner);
    
    // Make the purchase
    alert("Purchase transaction submitting. Please wait...");
    const tx = await marketplaceAsBuyer.purchaseProduct(idBN, overrides);
    console.log("Transaction sent as buyer:", tx.hash);
    
    // Show user the transaction is in progress
    const detailsDiv = document.getElementById("selectedProductDetails");
    detailsDiv.innerHTML = `
      <strong>Purchase in progress...</strong><br>
      Transaction Hash: ${tx.hash}<br>
      Please wait for confirmation.
    `;
    
    try {
      const receipt = await tx.wait();
      console.log("Transaction receipt:", receipt);
      
      if (receipt.status === 0) {
        throw new Error("Transaction reverted on the blockchain. See console for details.");
      }
      
      // Purchase successful - update UI immediately
      alert("Purchase successful!");
      
      // 1. Remove the purchased product from the availableProducts array directly
      availableProducts = availableProducts.filter(product => {
        const productId = product.id ? product.id.toString() : product[0].toString();
        return productId !== id;
      });
      
      // 2. Clear the selection and details
      idSelect.value = "";
      detailsDiv.innerHTML = "Purchase successful! Product has been removed from available products.";
      document.getElementById("buyAmount").value = "";
      
      // 3. Update all dropdowns with the filtered list
      populateProductDropdowns(availableProducts);
      
      // 4. Reload available products from blockchain after a short delay to ensure synced state
      setTimeout(() => {
        loadAvailableProducts();
      }, 2000);
      
    } catch (receiptError) {
      console.error("Transaction failed after submission:", receiptError);
      throw new Error("Transaction failed: " + receiptError.message);
    }
  } catch (error) {
    console.error("❌ Purchase failed:", error);
    
    // Improved error handling for common errors
    if (error.message && error.message.includes("Not a buyer")) {
      alert("Error: The buyer address is not registered as a buyer. Please register as a buyer first.");
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
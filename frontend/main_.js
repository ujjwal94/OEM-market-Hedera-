// Global variables to track state
let provider, signer;
let OEMRegistry, productManager, marketplace, disputeResolution;
let availableProducts = [];
let currentMode = null;

// Wallet addresses and private keys
const OEM_ADDRESS = "0xF1c0cF6924ECe517667Ea0A3393393391D01b863";
const OEM_PRIVATE_KEY = "e6fb347bcef5a6aa9a1479e5d3acce6221b97da9e0fd88f4e45144bf667fb629";

// Fixed the BUYER_ADDRESS with proper checksum
const BUYER_ADDRESS = "0xd1E77a74d017391888A8137892d53f814Dcb7B14";
const BUYER_PRIVATE_KEY = "6901cd9c45d64376247b89d35d153d128511bc81b2508f10c1321e62e7028ce0";

// Current user's address and private key (set when connecting)
let YOUR_ADDRESS;
let YOUR_PRIVATE_KEY;

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

// Initialize UI when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Show mode selection by default
  updateModeDisplay();
  
  // Hide appropriate sections initially
  document.querySelectorAll('.seller-mode, .buyer-mode').forEach(elem => {
    elem.style.display = 'none';
  });
  
  // Add admin button to the debug section
  const debugDiv = document.getElementById("debug-output");
  if (debugDiv) {
    const adminButton = document.createElement('button');
    adminButton.innerHTML = 'Connect as Admin';
    adminButton.onclick = connectAsAdmin;
    adminButton.style.backgroundColor = '#ff9800';
    adminButton.style.color = 'white';
    adminButton.style.marginTop = '10px';
    
    debugDiv.parentNode.insertBefore(adminButton, debugDiv);
  }
});

// Connect as Admin
function connectAsAdmin() {
  YOUR_ADDRESS = ADMIN_ADDRESS;
  YOUR_PRIVATE_KEY = ADMIN_PRIVATE_KEY;
  currentMode = "admin";
  updateModeDisplay();
  connectWallet().then(() => {
    // Show admin control panel
    showAdminPanel();
  });
}

// Show admin control panel for registering users
function showAdminPanel() {
  const debugDiv = document.getElementById("debug-output");
  if (!debugDiv) return;
  
  // Create admin panel
  let adminPanel = `
    <div style="border: 2px solid #ff9800; padding: 15px; margin-top: 15px; border-radius: 5px;">
      <h3>Admin Control Panel</h3>
      <p>As admin, you can register other users as OEM or Buyer.</p>
      
      <div style="margin-bottom: 15px;">
        <h4>Register OEM User</h4>
        <input id="oemAddress" placeholder="OEM Address" value="${OEM_ADDRESS}" style="width: 100%; margin-bottom: 10px;" />
        <button onclick="registerUserAs('${OEM_ADDRESS}', ${ROLE_OEM})">Register as OEM</button>
      </div>
      
      <div style="margin-bottom: 15px;">
        <h4>Register Buyer User</h4>
        <input id="buyerAddress" placeholder="Buyer Address" value="${BUYER_ADDRESS}" style="width: 100%; margin-bottom: 10px;" />
        <button onclick="registerUserAs('${BUYER_ADDRESS}', ${ROLE_BUYER})">Register as Buyer</button>
      </div>
    </div>
  `;
  
  debugDiv.innerHTML = adminPanel;
}

// Connect as OEM/Seller
function connectAsOEM() {
  YOUR_ADDRESS = OEM_ADDRESS;
  YOUR_PRIVATE_KEY = OEM_PRIVATE_KEY;
  currentMode = "oem";
  updateModeDisplay();
  connectWallet();
}

// Connect as Buyer
function connectAsBuyer() {
  YOUR_ADDRESS = BUYER_ADDRESS;
  YOUR_PRIVATE_KEY = BUYER_PRIVATE_KEY;
  currentMode = "buyer";
  updateModeDisplay();
  connectWallet();
}

// Update the UI based on current mode
function updateModeDisplay() {
  const modeDiv = document.getElementById("current-mode");
  if (currentMode === "oem") {
    modeDiv.innerHTML = `<span class="current-mode seller-badge">OEM/Seller Mode</span>`;
    // Show seller sections, hide buyer sections
    document.querySelectorAll('.seller-mode').forEach(elem => {
      elem.style.display = 'block';
    });
    document.querySelectorAll('.buyer-mode').forEach(elem => {
      elem.style.display = 'none';
    });
  } else if (currentMode === "buyer") {
    modeDiv.innerHTML = `<span class="current-mode buyer-badge">Buyer Mode</span>`;
    // Show buyer sections, hide seller sections
    document.querySelectorAll('.buyer-mode').forEach(elem => {
      elem.style.display = 'block';
    });
    document.querySelectorAll('.seller-mode').forEach(elem => {
      elem.style.display = 'none';
    });
  } else if (currentMode === "admin") {
    modeDiv.innerHTML = `<span class="current-mode" style="background-color: #ff9800; color: white;">Admin Mode</span>`;
    // Show both for admin
    document.querySelectorAll('.seller-mode, .buyer-mode').forEach(elem => {
      elem.style.display = 'block';
    });
  } else {
    modeDiv.innerHTML = `<span class="current-mode">No Mode Selected</span>`;
    // Hide both
    document.querySelectorAll('.seller-mode, .buyer-mode').forEach(elem => {
      elem.style.display = 'none';
    });
  }
}

// Function to register a user with a specific role from the admin account
async function registerUserAs(address, role) {
  if (!OEMRegistry) {
    alert("Please connect as admin first");
    return;
  }
  
  if (currentMode !== "admin") {
    alert("Only the admin can register users. Please connect as admin first.");
    return;
  }
  
  try {
    // Get the address from the input field if available
    if (role === ROLE_OEM) {
      const oemInput = document.getElementById("oemAddress");
      if (oemInput) {
        address = oemInput.value.trim();
      }
    } else if (role === ROLE_BUYER) {
      const buyerInput = document.getElementById("buyerAddress");
      if (buyerInput) {
        address = buyerInput.value.trim();
      }
    }
    
    if (!ethers.utils.isAddress(address)) {
      alert("Please enter a valid Ethereum address");
      return;
    }
    
    console.log(`Admin registering address ${address} as role ${role}`);
    
    // Add gas configuration for Hedera
    const overrides = {
      gasLimit: ethers.utils.hexlify(1000000),
      gasPrice: ethers.BigNumber.from(HEDERA_MIN_GAS_PRICE)
    };
    
    // Register the user with the specified role
    const tx = await OEMRegistry.registerUser(address, role, overrides);
    console.log("Registration transaction sent:", tx.hash);
    
    alert(`Registration transaction submitted for ${address} as ${role === ROLE_OEM ? "OEM" : "Buyer"}. Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    console.log("Registration confirmed:", receipt);
    
    if (receipt.status === 1) {
      // Verify the role was set
      const userRole = await OEMRegistry.getUserRole(address);
      console.log(`Address ${address} now has role: ${userRole}`);
      
      if (parseInt(userRole) === role) {
        alert(`Successfully registered ${address} as ${role === ROLE_OEM ? "OEM" : "Buyer"}`);
      } else {
        alert(`Registration transaction succeeded but role verification failed. Expected role ${role}, got ${userRole}.`);
      }
    } else {
      alert("Registration transaction failed on the blockchain.");
    }
  } catch (error) {
    console.error("Error in registration process:", error);
    alert(`Registration failed: ${error.message}`);
  }
}

// Register currently connected user in the desired role
function registerCurrentUser(role) {
  if (!YOUR_ADDRESS) {
    alert("Please connect your wallet first!");
    return;
  }
  
  if (role === 'oem') {
    registerOEM();
  } else if (role === 'buyer') {
    registerAsBuyer();
  }
}

async function connectWallet() {
  const statusDiv = document.getElementById("wallet");

  try {
    // Use direct provider with private key for guaranteed connection
    provider = new ethers.providers.JsonRpcProvider(HEDERA_RPC_URL);
    
    // Use the selected private key
    if (!YOUR_PRIVATE_KEY) {
      throw new Error("No private key selected. Please choose a mode first.");
    }
    
    signer = new ethers.Wallet(YOUR_PRIVATE_KEY, provider);
    
    // Update the YOUR_ADDRESS variable with the actual checksummed address from the wallet
    // This ensures we're using the correct checksummed address throughout the app
    YOUR_ADDRESS = signer.address;
    
    statusDiv.innerText = `✅ Connected: ${signer.address}`;
    console.log("Connected wallet:", signer.address);

    // Initialize contracts
    try {
      console.log("Loading contract ABIs...");
      const [oemABI, prodABI, marketABI, dispABI] = await Promise.all([
        loadABI("./abi/OEMRegistry.json"),
        loadABI("./abi/ProductManager.json"),
        loadABI("./abi/Marketplace.json"),
        loadABI("./abi/DisputeResolution.json")
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
    statusDiv.innerText = "❌ Failed to connect: " + error.message;
    alert(`Connection failed: ${error.message}`);
  }
}

// Helper function to load ABI dynamically
async function loadABI(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ABI from ${url}: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("ABI Loading Error:", error);
    throw error;
  }
}

async function checkUserRoles() {
  if (!OEMRegistry || !YOUR_ADDRESS) {
    console.log("OEMRegistry not initialized or no address selected. Please connect wallet first.");
    return;
  }
  
  try {
    // Ensure the address is properly checksummed
    const checksummedAddress = ethers.utils.getAddress(YOUR_ADDRESS);
    
    // Check if user is an OEM
    const isOEM = await OEMRegistry.isOEM(checksummedAddress);
    console.log("Is OEM:", isOEM);
    
    // Check if user is a Buyer
    const isBuyer = await OEMRegistry.isBuyer(checksummedAddress);
    console.log("Is Buyer:", isBuyer);
    
    // Get user role
    const role = await OEMRegistry.getUserRole(checksummedAddress);
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
    
    // Update status UI even when there's an error
    const roleStatus = document.getElementById("roleStatus");
    if (roleStatus) {
      roleStatus.innerHTML = `
        <strong>Current Roles:</strong><br>
        <span style="color: red">Error checking roles: ${error.message}</span><br>
        <span>You may need to register first.</span>
      `;
    }
    
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
  
  // Add event listener to update details when dropdown changes
  buyDropdown.addEventListener("change", updateSelectedProductDetails);
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
  
  // Add contract inspection button
  debugInfo += `<button onclick="inspectContract()" style="margin-top: 10px;">Inspect OEMRegistry Contract</button>`;
  
  // Add direct role check button
  debugInfo += `<button onclick="checkDirectRoles()" style="margin-top: 10px; margin-left: 10px;">Check Role Directly</button>`;
  
  debugDiv.innerHTML = debugInfo;
}

// Function to directly check roles to debug issues
async function checkDirectRoles() {
  const debugDiv = document.getElementById("debug-output");
  if (!debugDiv) return;
  
  if (!OEMRegistry || !YOUR_ADDRESS) {
    debugDiv.innerHTML = "Please connect wallet first.";
    return;
  }
  
  try {
    let result = "<h3>Direct Role Checks</h3>";
    result += `<p>Current address: ${YOUR_ADDRESS}</p>`;
    
    // Try different ways to check roles
    const isOEM = await OEMRegistry.isOEM(YOUR_ADDRESS);
    result += `<p>isOEM(${YOUR_ADDRESS}): ${isOEM}</p>`;
    
    const isBuyer = await OEMRegistry.isBuyer(YOUR_ADDRESS);
    result += `<p>isBuyer(${YOUR_ADDRESS}): ${isBuyer}</p>`;
    
    const role = await OEMRegistry.getUserRole(YOUR_ADDRESS);
    result += `<p>getUserRole(${YOUR_ADDRESS}): ${role.toString()} (${role.toString() === "0" ? "Admin" : role.toString() === "1" ? "OEM" : role.toString() === "2" ? "Buyer" : "Unknown"})</p>`;
    
    // Try registering with different arguments to see if any variation works
    result += "<h4>Registration Call Test:</h4>";
    result += "<p>Attempting a static call to registerUser to see what happens:</p>";
    
    try {
      await OEMRegistry.callStatic.registerUser(YOUR_ADDRESS, ROLE_BUYER);
      result += "<p style='color: green'>✅ Regular call would succeed!</p>";
    } catch (e) {
      result += `<p style='color: red'>❌ Regular call would fail: ${e.message}</p>`;
      
      if (e.message.includes("Not admin")) {
        result += "<p><strong>This confirms only admins can register users.</strong></p>";
      }
    }
    
    // Show how to use the contract
    result += "<h4>Contract Usage:</h4>";
    result += "<p>Based on testing, it appears that:</p>";
    result += "<ol>";
    result += "<li>Only accounts with the Admin role can register new users</li>";
    result += "<li>Your account needs to be registered as a buyer to purchase products</li>";
    result += "<li>Your account needs to be registered as an OEM to add products</li>";
    result += "</ol>";
    result += "<p>You need to contact the contract admin to register your address with the appropriate role.</p>";
    
    debugDiv.innerHTML = result;
    
  } catch (error) {
    console.error("Error checking roles directly:", error);
    debugDiv.innerHTML = `Error checking roles: ${error.message}`;
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

async function inspectContract() {
  const debugDiv = document.getElementById("debug-output");
  if (!debugDiv) return;
  
  if (!OEMRegistry) {
    debugDiv.innerHTML = "Please connect your wallet first to inspect the contract.";
    return;
  }
  
  try {
    // Get contract owner/admin
    let owner;
    if (OEMRegistry.owner) {
      owner = await OEMRegistry.owner();
      console.log("Contract owner:", owner);
    } else {
      console.log("No owner function found in contract");
    }
    
    // Check if we can find an admin role or similar
    let adminAddress;
    if (OEMRegistry.getAdmin) {
      adminAddress = await OEMRegistry.getAdmin();
      console.log("Admin address:", adminAddress);
    } else {
      console.log("No getAdmin function found in contract");
    }
    
    // Check if there's a specific admin role
    let hasAdminRole = false;
    if (OEMRegistry.hasRole) {
      try {
        // Try with common admin role identifier
        const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
        hasAdminRole = await OEMRegistry.hasRole(ADMIN_ROLE, YOUR_ADDRESS);
        console.log("Has admin role:", hasAdminRole);
      } catch (e) {
        console.log("Error checking hasRole:", e.message);
      }
    }
    
    // Inspect other potential contract information
    let registryInfo = "Contract Inspection:<br>";
    
    if (owner) {
      registryInfo += `Contract owner: ${owner}<br>`;
    }
    
    if (adminAddress) {
      registryInfo += `Admin address: ${adminAddress}<br>`;
    }
    
    // Get all functions
    const functions = Object.keys(OEMRegistry.functions).filter(f => 
      !f.startsWith('0x') && 
      f !== 'constructor' && 
      !f.includes('(')
    );
    
    registryInfo += "<h4>Available Functions:</h4>";
    registryInfo += functions.join('<br>');
    
    debugDiv.innerHTML = registryInfo;
    
    return { owner, adminAddress, functions };
    
  } catch (error) {
    console.error("Error inspecting contract:", error);
    debugDiv.innerHTML = `Error inspecting contract: ${error.message}`;
    return null;
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
      gasLimit: ethers.utils.hexlify(2000000),  // Increased gas limit
      gasPrice: ethers.BigNumber.from(HEDERA_MIN_GAS_PRICE)
    };
    
    console.log("Using gas price:", ethers.utils.formatUnits(HEDERA_MIN_GAS_PRICE, "gwei"), "Gwei");
    
    // Show warning about admin requirement
    alert("Note: This contract might require admin privileges to register users. If registration fails, you'll need to contact the contract admin.");
    
    // Try to get the admin address if possible
    try {
      const adminCheck = await inspectContract();
      console.log("Contract inspection completed");
    } catch (err) {
      console.log("Could not inspect contract:", err.message);
    }
    
    // Try to call the function without actually executing it first
    try {
      await OEMRegistry.callStatic.registerUser(YOUR_ADDRESS, ROLE_BUYER, overrides);
      console.log("Static call to registerUser succeeded, should work!");
    } catch (staticError) {
      console.error("Static call failed:", staticError);
      
      // If we get specific error messages, report them
      if (staticError.message.includes("Not admin") || 
          staticError.message.includes("caller is not the owner") ||
          staticError.message.includes("Ownable:")) {
        alert("This function can only be called by the contract admin/owner. Regular users cannot register themselves.");
        return;
      } else {
        console.warn("Static call failed but proceeding with actual transaction as it might still work");
      }
    }
    
    // Register user as Buyer (role = 2)
    const tx = await OEMRegistry.registerUser(YOUR_ADDRESS, ROLE_BUYER, overrides);
    console.log("Registration transaction sent:", tx.hash);
    
    alert("Buyer registration transaction submitted. Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction receipt:", receipt);
    
    if (receipt.status === 0) {
      throw new Error("Transaction failed on-chain. This likely means only admin can register users.");
    }
    
    // Check roles again
    await checkUserRoles();
    
    // Double-check if the role was properly assigned
    const role = await OEMRegistry.getUserRole(YOUR_ADDRESS);
    console.log("Updated user role:", role.toString());
    
    if (role.toString() !== ROLE_BUYER.toString()) {
      console.warn("Warning: User role is not set to buyer after registration.");
      console.log("Current role:", role.toString());
      console.log("Expected role:", ROLE_BUYER);
      alert("Registration completed but your role may not have changed. The contract might require admin rights to change roles.");
    } else {
      console.log("Successfully verified buyer role assignment.");
      alert("Successfully registered as buyer!");
    }
    
  } catch (error) {
    console.error("❌ Error in buyer registration process:", error);
    
    // Handle different error cases
    if (error.message && error.message.includes("Not admin") || 
        error.message.includes("caller is not the owner") ||
        error.message.includes("Ownable:")) {
      alert("Failed to register: Only the admin can register users. Contact the contract admin to register you.");
    } else if (error.message && error.message.includes("gas price")) {
      alert("Gas price error: Hedera requires a minimum gas price of 570 Gwei. Please try again.");
    } else if (error.message && error.message.includes("Transaction failed on-chain")) {
      alert("Registration failed. This contract likely requires admin privileges to register users.");
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
    
    // Show warning about potential permission issues
    alert("Attempting to purchase product. If the transaction fails with a 'Not a buyer' error, you might need to be registered as a buyer by the admin first. We'll still try to process the transaction.");

    // Try a direct transaction - Hedera sometimes has issues with static calls
    console.log("Executing purchase with configuration:", {
      productId: idBN.toString(),
      value: amountBN.toString(),
      gasLimit: overrides.gasLimit,
      gasPrice: overrides.gasPrice
    });
    
    const tx = await marketplace.purchaseProduct(idBN, overrides);
    console.log("Transaction sent:", tx.hash);
    
    alert("Purchase transaction submitted. Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction receipt:", receipt);
    
    if (receipt.status === 0) {
      // Transaction failed on chain, but we have the hash for reference
      console.error("Transaction reverted on blockchain with hash:", tx.hash);
      
      // Try to get more information about why it failed
      try {
        // Check product availability after the failed transaction
        const productAfter = await productManager.getProduct(idBN);
        const isAvailableAfter = productAfter.available || productAfter[5];
        
        if (!isAvailableAfter) {
          throw new Error("Product is no longer available. It may have been purchased by someone else.");
        }
      } catch (checkError) {
        console.error("Error checking product after failed transaction:", checkError);
      }
      
      throw new Error("Transaction reverted on the blockchain. See console for details.");
    }
    
    alert("Purchase successful!");
    
    // Reload available products after purchase
    await loadAvailableProducts();
    
  } catch (error) {
    console.error("❌ Purchase failed:", error);
    
    // Try to extract more detailed error info
    let errorMessage = error.message;
    
    // Look for specific error patterns in the transaction data
    if (error.message && error.message.includes("transaction failed")) {
      if (error.receipt && error.receipt.logs && error.receipt.logs.length > 0) {
        console.log("Transaction logs:", error.receipt.logs);
      }
      
      // Common marketplace errors
      if (error.message.includes("Not a buyer")) {
        errorMessage = "Error: You are not registered as a buyer. The contract requires registration by the admin before you can make purchases.";
      } else if (error.message.includes("Product not available")) {
        errorMessage = "Error: This product is not available for purchase.";
      } else if (error.message.includes("Insufficient payment")) {
        errorMessage = "Error: The payment amount is insufficient to buy this product.";
      } else {
        // If no specific error, provide general guidance
        errorMessage = "Transaction was reverted by the smart contract. This could be due to:\n" +
            "1. The product doesn't exist or is already sold\n" +
            "2. You're not authorized to buy this product\n" +
            "3. There's an issue with the product price vs. the amount sent\n" +
            "4. The contract has additional rules preventing this purchase\n" +
            "Check the console for more details.";
      }
    }
    
    alert(errorMessage);
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
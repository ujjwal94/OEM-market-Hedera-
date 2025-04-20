const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  // Define the buyer address to register after deployment
  const BUYER_ADDRESS = "0xd1E77a74d017391888A8137892d53f814Dcb7B14";
  
  // Role constants from the OEMRegistry contract
  const ROLE_ADMIN = 0;
  const ROLE_OEM = 1;
  const ROLE_BUYER = 2;

  // Deploy OEMRegistry
  const OEMRegistry = await hre.ethers.getContractFactory("OEMRegistry");
  const registry = await OEMRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("OEMRegistry deployed at:", registryAddress);

  // Deploy ProductManager with OEMRegistry address
  const ProductManager = await hre.ethers.getContractFactory("ProductManager");
  const manager = await ProductManager.deploy(registryAddress);
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  console.log("ProductManager deployed at:", managerAddress);

  // Deploy Marketplace with OEMRegistry and ProductManager addresses
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const market = await Marketplace.deploy(registryAddress, managerAddress);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log("Marketplace deployed at:", marketAddress);

  // Deploy DisputeResolution without constructor parameters
  // Based on the error message, it appears it doesn't take parameters
  const DisputeResolution = await hre.ethers.getContractFactory("DisputeResolution");
  const dispute = await DisputeResolution.deploy();
  await dispute.waitForDeployment();
  const disputeAddress = await dispute.getAddress();
  console.log("DisputeResolution deployed at:", disputeAddress);

  // Register deployer as OEM and buyer address as Buyer
  console.log("\nRegistering accounts with OEMRegistry...");
  
  try {
    // Check if deployer already has admin role
    const deployerRole = await registry.getUserRole(deployer.address);
    
    // If deployer doesn't have the admin role (0), register as admin
    if (deployerRole.toString() !== "0") {
      console.log("Registering deployer as Admin...");
      const tx1 = await registry.registerUser(deployer.address, ROLE_ADMIN);
      await tx1.wait();
      console.log("Deployer registered as Admin");
    } else {
      console.log("Deployer already has Admin role");
    }
    
    // Register deployer as OEM too (if needed)
    const isDeployerOEM = await registry.isOEM(deployer.address);
    if (!isDeployerOEM) {
      console.log("Registering deployer as OEM...");
      const tx2 = await registry.registerUser(deployer.address, ROLE_OEM);
      await tx2.wait();
      console.log("Deployer registered as OEM");
    } else {
      console.log("Deployer already registered as OEM");
    }
    
    // Register buyer address
    console.log(`Registering ${BUYER_ADDRESS} as Buyer...`);
    const isBuyer = await registry.isBuyer(BUYER_ADDRESS);
    if (!isBuyer) {
      const tx3 = await registry.registerUser(BUYER_ADDRESS, ROLE_BUYER);
      await tx3.wait();
      console.log("Buyer address successfully registered");
    } else {
      console.log("Buyer address already registered");
    }
  } catch (error) {
    console.error("Error during user registration:", error.message);
    console.log("Continuing with deployment summary...");
  }

  // Summary of deployed contracts
  console.log("\nDeployment Summary:");
  console.log("==================");
  console.log("OEMRegistry:       ", registryAddress);
  console.log("ProductManager:    ", managerAddress);
  console.log("Marketplace:       ", marketAddress);
  console.log("DisputeResolution: ", disputeAddress);
  console.log("\nRegistered Accounts:");
  console.log("Deployer (Admin+OEM):", deployer.address);
  console.log("Buyer Account:       ", BUYER_ADDRESS);

  // Store addresses in a configuration file
  if (hre.network.name !== 'hardhat') {
    const fs = require('fs');
    const deploymentData = {
      network: hre.network.name,
      timestamp: new Date().toISOString(),
      contracts: {
        OEMRegistry: registryAddress,
        ProductManager: managerAddress,
        Marketplace: marketAddress,
        DisputeResolution: disputeAddress
      },
      accounts: {
        admin: deployer.address,
        buyer: BUYER_ADDRESS
      }
    };

    // Create deployments directory if it doesn't exist
    const path = require('path');
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    // Save deployment info
    fs.writeFileSync(
      path.join(deploymentsDir, `${hre.network.name}_deployment.json`),
      JSON.stringify(deploymentData, null, 2)
    );
    console.log(`\nDeployment info saved to: deployments/${hre.network.name}_deployment.json`);

    // Generate JavaScript module with addresses
    const jsContent = `// Auto-generated on ${new Date().toISOString()}
// ${hre.network.name} deployment
  
const registryAddress = "${registryAddress}";
const productManagerAddress = "${managerAddress}";
const marketplaceAddress = "${marketAddress}";
const disputeAddress = "${disputeAddress}";
const buyerAddress = "${BUYER_ADDRESS}";

export {
  registryAddress,
  productManagerAddress,
  marketplaceAddress,
  disputeAddress,
  buyerAddress
};
`;

    fs.writeFileSync(
      path.join(deploymentsDir, `${hre.network.name}_addresses.js`),
      jsContent
    );
    console.log(`Contract addresses also exported as JavaScript module in: deployments/${hre.network.name}_addresses.js`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);

  const OEMRegistry = await hre.ethers.getContractFactory("OEMRegistry");
  const registry = await OEMRegistry.deploy();
  await registry.waitForDeployment(); // 👈 Replaces .deployed()

  console.log("OEMRegistry deployed at:", await registry.getAddress());

  const ProductManager = await hre.ethers.getContractFactory("ProductManager");
  const manager = await ProductManager.deploy(await registry.getAddress());
  await manager.waitForDeployment();

  console.log("ProductManager deployed at:", await manager.getAddress());

  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const market = await Marketplace.deploy(await registry.getAddress(), await manager.getAddress());
  await market.waitForDeployment();

  console.log("Marketplace deployed at:", await market.getAddress());

  const DisputeResolution = await hre.ethers.getContractFactory("DisputeResolution");
  const dispute = await DisputeResolution.deploy();
  await dispute.waitForDeployment();

  console.log("DisputeResolution deployed at:", await dispute.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

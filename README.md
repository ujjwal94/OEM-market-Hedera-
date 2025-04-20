# Hedera OEM Marketplace

A blockchain-based OEM marketplace built using Solidity and deployed via Hedera's JSON-RPC relay using Hardhat.

## Features

- OEM and Buyer registration
- Product listing and purchasing
- Basic dispute resolution
- Deployable to Hedera Testnet

## Setup

1. Clone or download the repo
2. Install dependencies: `npm install`
3. Set up `.env` with your Hedera testnet private key
4. Compile: `npm run compile`
5. Deploy: `npm run deploy`

## Deloy
npx hardhat run scripts/deploy.js --network hederaTestnet

Deployment Summary:
==================
OEMRegistry:        0xccEC3be4217c3335390299B290db88cA5Fd47573\
ProductManager:     0x54448C23AE24c7eaE4e0CE47CB31cB75e6AD6F33\
Marketplace:        0xB284F908Ce1d946bB4ef9A5b0Efc6460cA5d8d5b\
DisputeResolution:  0x6DDBDdeE3598fC4eBD187942048137253E09fFa6\

Registered Accounts:
Deployer (Admin+OEM): 0xF1c0cF6924ECe517667Ea0A3393393391D01b863\
Buyer Account:        0xd1E77a74d017391888A8137892d53f814Dcb7B14\

Deployment info saved to: deployments/hederaTestnet_deployment.json\
Contract addresses also exported as JavaScript module in: deployments/hederaTestnet_addresses.js\


# Hippo NFT Box
Hippo NFT Box Solidity Version

## 1. Introduction
Hippo NFT Box is a platform that helps users mint NFTs and wrap them into mystery boxes. Users could buy and open mystery boxes to get random NFTs or NFT fragments. There is also an NFT market for users to trade with their NFTs.
Compared with FT, NFT is more complex and expensive, and cannot be standardized and unlimitedly split, which to a certain extent limits the further large-scale development in the NFT market. The NFT mystery box model can overcome the obstacle of the large-scale development of the NFT market.

## 2. Setup

### Installing Node.js and hardhat
We require node >=12.0, if not, you can go to the nodejs website and find out how to install or upgrade.
Or we recommend that you install Node using nvm. Windows users can use nvm-windows instead.

```
npm install
```
### Run a local node

```
npx hardhat node
```

### Compile contracts

compile all contracts
```
npx hardhat compile
```

### Deploy contracts
```
npx hardhat run --network localhost scripts/deploy_proxy.js
```

## 3. Test

Run tests
```
npx hardhat test
```

Run coverage:
```
npx hardhat coverage
```

## License

Hippo NFT Box Contracts are released under the [MIT License](https://github.com/CycanTech/HIPPO_NFT/blob/main/LICENSE)


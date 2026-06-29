# 🛡️ Honeypot Analyzer Bot

A Telegram bot that delivers a comprehensive audit report on ERC-20 tokens on the Ethereum blockchain. Built with Node.js.

## Features

- 🍯 **Honeypot Detection** — Checks if a token is a honeypot before you trade
- 💧 **Liquidity & Market Cap** — Real-time liquidity and market cap in USD
- 🔒 **LP Lock Detection** — Checks liquidity locks on Unicrypt, PinkSale, and TrustSwap
- 🔥 **LP Burn Detection** — Detects if LP tokens are burned
- 👥 **Token Holders** — Top holder distribution and circulating supply
- 👤 **Owner Info** — Shows token owner or renounced status
- ✅ **Contract Verification** — Checks if contract is verified on Etherscan
- 🕐 **Contract Age** — Shows how long the contract has been deployed
- 💰 **Tax Info** — Buy and sell tax percentages
- ⛽ **Gas Fees** — Estimated gas for buy and sell transactions

## Supported Base Pairs

| Base Token | Address |
|------------|---------|
| WETH | `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2` |
| USDC | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` |
| USDT | `0xdac17f958d2ee523a2206206994597c13d831ec7` |
| DAI | `0x6b175474e89094c44da98b954eedeac495271d0f` |

> Currently supports Uniswap V2 pairs only. Uniswap V3 support coming soon.

## Prerequisites

- Node.js v18 or higher
- A Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- An Alchemy or Infura WebSocket RPC URL
- An Etherscan API key

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/Abdullahturk/honeypot-analyzer-bot.git
cd honeypot-analyzer-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your `.env` file

Create a `.env` file in the root directory:

```env
botToken=your_telegram_bot_token
infuraURL=wss://eth-mainnet.g.alchemy.com/v2/your_alchemy_key
etherScanAPI=your_etherscan_api_key
```

#### Getting your API keys:

- **Telegram Bot Token** — Message [@BotFather](https://t.me/BotFather) on Telegram, create a new bot with `/newbot` and copy the token
- **Alchemy RPC URL** — Sign up at [alchemy.com](https://www.alchemy.com), create an Ethereum mainnet app, and copy the WebSocket URL (`wss://`)
- **Etherscan API Key** — Sign up at [etherscan.io](https://etherscan.io), go to API Keys and create a new key

### 4. Run the bot

```bash
node main.js
```

## Usage

1. Start the bot on Telegram
2. Send `/start` to see the welcome message
3. Paste any Ethereum ERC-20 token contract address
4. The bot will analyze the token and return a full audit report

## Project Structure

```
├── main.js                  
├── eventlistner.js          
├── provider.js              
├── abis/
│   └── abi.js               
└── helpers/
    ├── getLockInfo.js      
    ├── getLiquidity.js       
    └── getTokenInfo.js       
    ├── EsService.js           
    └── HpServices.js      
```

## Built By

Built by [@chilltoshi](https://t.me/chilltoshi)

For questions or support, reach out on Telegram: [@chilltoshi](https://t.me/chilltoshi)

## Disclaimer

This bot is provided for informational purposes only. Always do your own research (DYOR) before making any investment decisions. NFA.

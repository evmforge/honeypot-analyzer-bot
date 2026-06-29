require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.WebSocketProvider(process.env.ALCHEMY_URL);
// keepalive ping
setInterval(async () => {
    try {
        await provider.getBlockNumber();
    } catch (error) {
        console.error('Provider keepalive failed:', error.message);
    }
}, 240000);

const etherscanApiKey = process.env.etherScanAPI;
module.exports = { 
    provider, 
    etherscanApiKey 
};
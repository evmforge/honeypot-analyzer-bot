const axios = require('axios');
const { getContractAge } = require('./EsService');


async function getHoneyPotStatus(tokenAddress) {
  try {
  const apiKey = '';
  const response = await axios.get('https://api.honeypot.is/v2/IsHoneypot', {
    params: { address: tokenAddress,
    simulateLiquidity: true,
    chainID: '1'
  },
    headers: {'Authorization': `Bearer ${apiKey}`}
  });

      // Check if the response contains error data
      if (response.data && response.data.error) {
        // Handle the specific error case
        if (response.data.error === 'no provider found to simulate liquidity') {
          return {
            simulationSuccess: false,
            simulationError: 'No liquidity pair found to simulate.'
          };
        }
      }
     // console.log("response data from honeypot API checking honeypot status", response.data);
  return response.data;

} catch (error) {
  console.error('Error fetching honeypotstatus:', error);
  return {
    simulationSuccess: false,
    simulationError: 'An error occured while fetching the honeypot status'
  }
 }
}

const apiKey = '';
async function fetchTotalSupplyandTopHolders(tokenAddress, honeyPotStatusPromise, tokenInfoPromise) {
const [response, honeypotData, tokenInfo]  = await Promise.all([
  axios.get('https://api.honeypot.is/v1/TopHolders', {
  params: { address: tokenAddress, chainID: '1' },
  headers: {'Authorization': `Bearer ${apiKey}`}
}),
  honeyPotStatusPromise,
  tokenInfoPromise
]);

const topHoldersData =  response.data;

const totalSupply = tokenInfo.totalSupplyBigInt;
const totalHolders = honeypotData?.token?.totalHolders || '0';
const decimals = tokenInfo.decimals
console.log("decimals reading from tokenInfo.decimals", decimals);

const holdersWithPercentage = topHoldersData.holders.slice(0, 4).map(holder => {
  const holderBalanceBigInt = BigInt(holder.balance);
  const totalSupplyBigInt = BigInt(totalSupply);
  const decimalsFactor = BigInt(10) ** BigInt(decimals);

  const adjustedHolderBalance = holderBalanceBigInt / decimalsFactor;
  const adjustedTotalSupply = totalSupplyBigInt / decimalsFactor;
// console.log('adjusted total Supply and holder balance', adjustedTotalSupply, adjustedHolderBalance)

  const percentage = Number(adjustedHolderBalance) * 100 / Number(adjustedTotalSupply);
  const formattedPercentage = percentage.toFixed(2); // Format to 2 decimal places
  return {
    percentage: formattedPercentage + '%',
    isContract: holder.isContract
  };
});

const tokenDetails = {
  totalSupply: totalSupply,
  totalHolders: totalHolders,
  holdersWithPercentage: holdersWithPercentage
}
//console.log('data received from fetchTotalSupplyAndHolders', tokenDetails)
return tokenDetails
}

async function GetContractVerification(tokenAddress) {
  const response = await axios.get('https://api.honeypot.is/v2/GetContractVerification', {
    params: { address: tokenAddress, chainID: '1' 
    },
    headers: {'Authorization': `Bearer ${apiKey}`}
  })
  return response;
}

module.exports = {
    GetContractVerification,
    getHoneyPotStatus,
    fetchTotalSupplyandTopHolders
}
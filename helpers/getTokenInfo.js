const { ethers } = require('ethers');
const { provider } = require('../provider');


// Format Numbers
function formatNumber(num) {
  if (Math.abs(num) >= 1.0e+9) {
    return Math.floor(Math.abs(num) / 1.0e+9) + "B"; // In billions
  } else if (Math.abs(num) >= 1.0e+6) {
    return Math.floor(Math.abs(num) / 1.0e+6) + "M"; // In millions
  } else if (Math.abs(num) >= 1.0e+3) {
    return Math.floor(Math.abs(num) / 1.0e+3) + "K"; // In thousands
  }
  return num.toString(); // Return as a string if less than 1000
}

async function getTokenInfo(tokenAddress) { 
    try {
        const tokenContract = new ethers.Contract(tokenAddress, [
        'function name() view returns (string)', 
        'function symbol() view returns (string)', 
        'function decimals() view returns (uint8)',
        'function totalSupply() view returns (uint256)',
        'function owner() view returns (address)',
        'function getOwner() view returns (address)',
        'function balanceOf(address owner) view returns (uint256)'
      ], 
         provider);
        const [name, symbol, decimals, totalSupplyBigInt] = await Promise.all([
          tokenContract.name(), 
          tokenContract.symbol(), 
          tokenContract.decimals(), 
          tokenContract.totalSupply()]);

        const BA1 = '0x000000000000000000000000000000000000dEaD';
        const BA2 = '0x0000000000000000000000000000000000000000';
        const burnedSupply1 = await tokenContract.balanceOf(BA1);
        const burnedSupply2 = await tokenContract.balanceOf(BA2);
        const totalBurnedSupplyBigInt = burnedSupply1 + burnedSupply2;

        // calculate the circulating supply
        const circulatingSupplyBigInt = totalSupplyBigInt - totalBurnedSupplyBigInt;

        const totalSupply = ethers.formatUnits(totalSupplyBigInt, decimals);
        const circulatingSupply = ethers.formatUnits(circulatingSupplyBigInt, decimals);
        const totalSupplyFormatted = formatNumber(Number(totalSupply));
        const circulatingSupplyFormatted = formatNumber(Number(circulatingSupply));


        let owner; 
        try {
           owner = await tokenContract.owner();
        } catch {
           console.error('owner function not available')
           try {
               owner = await tokenContract.getOwner();
           } catch {
               console.error('owner and getOwner both functions not available')
               owner = '0x';
           }
        }
      //  console.log('data recieved from getTokenInfo function', {
      //     name,
      //     symbol,
      //     decimals,
      //     totalSupplyBigInt,
      //     totalSupply,
      //     circulatingSupply,
      //     owner
      // });
      
        return {name, 
            symbol, 
            decimals: Number(decimals),
            totalSupplyBigInt, 
            owner,
            totalSupply: totalSupplyFormatted,
            circulatingSupply: circulatingSupplyFormatted
             // 
         };

    
    } catch (error) {
        console.error('error fetching token information', error);
        return {name: 'N/A', symbol: 'N/A', decimals: 'N/A', owner: 'N/A'}; // default values in case of error
    }
}

module.exports = {
    getTokenInfo
}
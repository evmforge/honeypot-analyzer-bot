  const { ethers } = require('ethers');
  const axios = require('axios');
  const { provider } = require('../provider');
  
const BASE_TOKENS = [
    { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'WETH', decimals: 18, isStable: false },
    { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6, isStable: true },
    { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', symbol: 'USDT', decimals: 6, isStable: true },
    { address: '0x6b175474e89094c44da98b954eedeac495271d0f', symbol: 'DAI', decimals: 18, isStable: true },
];

  // Function to fetch ETH/USD price from CoinGecko
  async function fetchEthUsdPrice() {
      try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const ethUsdPrice = response.data.ethereum.usd;
        return ethUsdPrice;
      } catch (error) {
        console.error('Error fetching ETH/USD price:', error);
        return null; // Return null in case of an error
      }
    }
  
  async function getLiquidityInfo(tokenAddress, tokenInfoPromise) {
    try {
        const factoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
        const factory = new ethers.Contract(factoryAddress, 
            ['function getPair(address tokenA, address tokenB) external view returns (address pair)'], 
            provider);

        // find the correct base
        let pairAddress, baseToken;
        for (const base of BASE_TOKENS) {
            const pair = await factory.getPair(tokenAddress, base.address);
            if (pair && pair !== ethers.ZeroAddress) {
                pairAddress = pair,
                baseToken = base
             //   console.log(`pair found with ${base.address}/${base.symbol}`, pair);
                break; 
            }
        }
        if (!pairAddress) {
            console.log("No supported pair is found for token", tokenAddress);
            return {wethLiquidityInUsd: '0', marketCapInEth: '0', tokenPriceInUsd: '0', marketCapInUsd: '0' }
        }

        // initialize the uniswap pair contract
        const pairContract = new ethers.Contract(pairAddress, [
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)'
    ], provider);

        // retrieve the reserves and other data with promise all
        const [reserves, token0Address, token1Address, ethUsdPrice, tokenInfo] = await Promise.all([
            pairContract.getReserves(),
            pairContract.token0(),
            pairContract.token1(),
            fetchEthUsdPrice(),
            tokenInfoPromise,   
        ])

        const [reserve0, reserve1] = reserves;

        //determine which token is weth Address
        let baseReserve, tokenReserve
        if (token0Address.toLowerCase() === baseToken.address.toLowerCase()) {
            baseReserve = reserve0;
            tokenReserve = reserve1
        } else {
            baseReserve = reserve1;
            tokenReserve = reserve0;
        }


        // calculate the liquidity in USD
        const baseReserveAdjusted = Number(baseReserve) / 10 ** baseToken.decimals;
        const liquidityInUsd = baseToken.isStable 
        ? baseReserveAdjusted
        : (baseReserveAdjusted * ethUsdPrice); // convert ETH to USD  

        // calculate the market cap 
        const tokenReserveAdjusted = Number(tokenReserve) / 10 ** tokenInfo.decimals;
        const tokenPriceInUsd = liquidityInUsd / tokenReserveAdjusted
        const marketCapInUsd = tokenPriceInUsd * parseFloat(ethers.formatUnits(tokenInfo.totalSupplyBigInt, tokenInfo.decimals));
        const marketCapInEth = marketCapInUsd / ethUsdPrice;

        const liquidityPercentage = (liquidityInUsd / marketCapInUsd) * 100;
        const formattedPercentage = liquidityPercentage === 0 ? '0%' : `${liquidityPercentage.toFixed(1)}%`
        // console.log('Data recieved from getLiquidity function', marketCapInUsd, marketCapInEth);

        return { 
            wethLiquidityInUsd: liquidityInUsd,
            marketCapInEth,
            tokenPriceInUsd, 
            marketCapInUsd,
            formattedPercentage,
            pairAddress,
            token0Address,
            token1Address,
            baseToken: baseToken.symbol 
        };
    } catch (error) {
        console.error('error fetching marketcap and liquidity', error);
        return { wethLiquidityInUsd: '0', marketCapInEth: '0', tokenPriceInUsd: '0', marketCapInUsd: '0'}
    }
}

module.exports = {
    getLiquidityInfo
}
const fs = require('fs');
const  axios = require('axios');
const { ethers } = require('ethers');
const { Telegraf, Markup } = require('telegraf');
const { provider, etherscanApiKey } = require('./provider')
const { getLockInfo } = require('./helpers/getLockInfo');
const { getTokenInfo } = require('./helpers/getTokenInfo');
const { getLiquidityInfo } = require('./helpers/getLiquidityInfo')
const { getSourceCode, getContractAge } = require('./helpers/EsService');
const { GetContractVerification, getHoneyPotStatus, fetchTotalSupplyandTopHolders} = require('./helpers/HpService');

const BASE_TOKENS = [
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
    '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
    '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
];


async function getTokenAddressFromPair(pairAddress, provider) {
  try {

      // Initialize the contract with the pair contract's ABI
      const pairContract = new ethers.Contract(pairAddress, [
          'function token0() external view returns (address)',
          'function token1() external view returns (address)'
      ], provider);

      const [token0Address, token1Address] = await Promise.all([
          pairContract.token0(),
          pairContract.token1()
      ]);

      // Adjust this logic based on your specific requirements
      if (BASE_TOKENS.includes(token0Address.toLowerCase())) {
        return token1Address; 
      } else {
        return token0Address;
      }

  } catch (error) {
    if (error.code === 'CALL_EXCEPTION') {
      return pairAddress; // Return the original address
    } else {
    console.error('Unexpected error determining if address is a pair:', error);
    return pairAddress;
    }
  }
}

   function escapeMarkdownV2Text(text, escapeAsterisks = true) {
      if (typeof text !== 'string') {
        text = String(text);
      }
      // Escape all MarkdownV2 special characters in text
      let pattern = escapeAsterisks ? /[_*[\]()~>#+\-|=\.{}!]/g : /[_[\]()~>#+\-|=\.{}!]/g;
      return text.replace(pattern, '\\$&');
    }

async function processEthTokenAddress(ctx, tokenAddress) {
  console.time('FullScriptTime');

      // Check if the address is a pair and get the correct token address
     // console.log('Calling getLiquidity with:', tokenAddress);

      tokenAddress = await getTokenAddressFromPair(tokenAddress, provider);
          // Send an initial response to the user
      const initialMessage = await ctx.reply("⏱ Generating token result, please wait...");

      const honeyPotStatusPromise = getHoneyPotStatus(tokenAddress);
      const tokenInfoPromise = getTokenInfo(tokenAddress);
      const contractAgePromise =  getContractAge(tokenAddress);
      const totalSupplyPromise = fetchTotalSupplyandTopHolders(tokenAddress, honeyPotStatusPromise, tokenInfoPromise);
      const liquidityDataPromise = getLiquidityInfo(tokenAddress, tokenInfoPromise);
      const sourceCodeLinkPromise = getSourceCode(tokenAddress); 
      const contractVerificationPromise = GetContractVerification(tokenAddress);

      const[liquidityData, honeyPotStatus, tokenInfo, contractAge, processedLinks, tokenHolderData, contractVerification] = await Promise.all([
          liquidityDataPromise,  
          honeyPotStatusPromise,
          tokenInfoPromise,
          contractAgePromise,
          sourceCodeLinkPromise,
          totalSupplyPromise.catch(error => {
              console.error('error while fetching liquidity and marketcap data', error);
              return {  totalSupply: '0', totalHolders: '0', holdersWithPercentage: '0' }
          }),
          contractVerificationPromise.catch(error => {
            console.error('Error fetching contract verification');
            return undefined;
          })
      ]);

      const escapedLpPercentage = escapeMarkdownV2Text(liquidityData.formattedPercentage);
      const lpPairAddress = liquidityData.pairAddress;
      const lockInfo = await getLockInfo(lpPairAddress);
     const linksToDisplay = processedLinks.join(' \\| ');
     const percentageString = tokenHolderData.holdersWithPercentage
     .map(h => `${escapeMarkdownV2Text(h.percentage)} ${h.isContract ? '📄' : '👤'}`)
     .join(' \\| ');
      //console.log('Percentage string', percentageString);

const holdersAddressLink = `**[${tokenHolderData.totalHolders}](https://etherscan.io/token/${tokenAddress}#balances)**`;

const formattedLiquidity = liquidityData.wethLiquidityInUsd.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
const formattedMarketCap = isNaN(liquidityData.marketCapInUsd) ? '0' : liquidityData.marketCapInUsd.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});

let ownerInfo = '';
if (tokenInfo.owner === '0x0000000000000000000000000000000000000000' || tokenInfo.owner === '0x000000000000000000000000000000000000dEaD') {
  ownerInfo = '\\*\\*\\*RENOUNCED\\*\\*\\*';
} else if (tokenInfo.owner === '0x') {
  ownerInfo = `[0x](https://etherscan.io/address/${tokenInfo.owner})`
} else {
   // Construct the ownerAddressLink with full URL
   ownerInfo = `[${tokenInfo.owner.substring(0, 4)}\\.\\.\\.${tokenInfo.owner.substring(tokenInfo.owner.length - 4)}](https://etherscan.io/address/${tokenInfo.owner})`;
   console.log(ownerInfo);    
}

function formatTax(tax) {
// check if the tax is a number
return typeof tax === 'number' ? tax.toFixed(1) : tax
}

const buyTax = formatTax(honeyPotStatus.simulationResult?.buyTax);
const sellTax = formatTax(honeyPotStatus.simulationResult?.sellTax);

let contractVerificationStatus = 'CA: Verification Status Unknown ❔';
if (contractVerification && contractVerification.data) {
  // Check if the contract has proxy calls
  if (contractVerification.data.summary && contractVerification.data.summary.hasProxyCalls) {
      contractVerificationStatus = '⛔ Proxy Contract ⛔ ';
  } else if (contractVerification.data.isRootOpenSource === true) {
      contractVerificationStatus = 'Yes ✅';
  } else if (contractVerification.data.isRootOpenSource === false) {
      contractVerificationStatus = 'No 🔴';
  }
}
if (honeyPotStatus) {

  let formattedMessage = ''; 


  if (honeyPotStatus.simulationSuccess === false && honeyPotStatus.simulationError === 'execution reverted: LIQ_SIM_FAILED') {

      formattedMessage = `
*Token Name: ${escapeMarkdownV2Text(tokenInfo.name)} \\(${escapeMarkdownV2Text(tokenInfo.symbol)}\\)*
*💯Total Supply ${escapeMarkdownV2Text(tokenInfo.totalSupply)}*, *♻️Circ\\. Supply: ${escapeMarkdownV2Text(tokenInfo.circulatingSupply)}*  
*🔹ETH:* \`${tokenAddress}\`
*👨‍💻Owner:* ${ownerInfo}
*👥Holders* ${holdersAddressLink} \\| ${percentageString}
*⚙️Contract Verified:* ${contractVerificationStatus}
*🍯HoneyPot:* Yes 🔴
*🧠REASON* Simulation Failed 🔴
*💧Liquid:* $${formattedLiquidity}
*💲MCap:* $${formattedMarketCap}
*📑TAX B/S:* 0 / 0
*🔒LP Lock:* ${escapeMarkdownV2Text(lockInfo.message, false)}
*🌐Socials:* ${linksToDisplay}
*⏰Age:* ${contractAge}`;
formattedMessage += `\n\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_
\`\\(DYOR\\)\\. NFA\\. Make informed decisions.\\.\`
*Promotion:* [Your Ad here](https://t.me/chilltoshi)`;

} else if (honeyPotStatus.simulationSuccess === true && honeyPotStatus.honeypotResult.isHoneypot === false ) {
let warningTax = '';
let honeyPotStatusMessage = '*🍯HoneyPot:* No ✅';
let maxBuyInfo = '';
let sniperBotsInfo = '';
// Define URLs for sniper bots
const maestroUrl = escapeMarkdownV2Text(`https://t.me/MaestroSniperBot?start=${tokenAddress}`);
const maestroProUrl = escapeMarkdownV2Text(`https://t.me/MaestroProBot?start=${tokenAddress}`);
const bananaUrl = escapeMarkdownV2Text(`https://t.me/BananaGunSniper_bot?start=${tokenAddress}`);
const wagieUrl = escapeMarkdownV2Text(`https://t.me/wagiebot?start=${tokenAddress}`);

if (honeyPotStatus.flags && honeyPotStatus.flags.includes('medium_tax')) {
    warningTax = 'HIGH TAX 🔴';
}
      // Check if simulationResult and maxBuy are defined
      if (honeyPotStatus.simulationResult && honeyPotStatus.simulationResult.maxBuy) {
        // Fallback to tokenInfo if the decimals are zero
        const tokenDecimals = honeyPotStatus.token.decimals > 0 ? honeyPotStatus.token.decimals : tokenInfo.decimals;
      //  console.log('token decimals value', tokenDecimals);
        const rawTokenAmount  = honeyPotStatus.simulationResult.maxBuy.token 
     //   console.log('token Amount'. rawTokenAmount);
          maxBuyInfo = `👝Max Buy: \`${rawTokenAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}\` (${honeyPotStatus.simulationResult.maxBuy.withToken.toFixed(3)} WETH)`;
        //  console.log('Max Buy Info:', maxBuyInfo);
      }
      if (honeyPotStatus.flags.includes('EXTREMELY_LOW_SELL_LIMIT')) {
        // Update the honeypot status message to indicate failure due to extremely low sell limit
        honeyPotStatusMessage = '*🍯HoneyPot:* *Yes\\!* Extremely Low Sell Limit 🔴';
      } else if (honeyPotStatus.flags.includes('EFFECTIVE_HONEYPOT_LOW_SELL_LIMIT')) {
      honeyPotStatusMessage = '*🍯HoneyPot:* *Yes\\!* Effective HoneyPot with Low Sell Limit 🔴';
      } else if (honeyPotStatus.flags.includes('EXTREMELY_HIGH_TAXES') && (buyTax > 30 || sellTax > 40)) {
      honeyPotStatusMessage = '*🍯HoneyPot:* *Yes\\!* Extremely high tax 🔴';
  } else {
      honeyPotStatusMessage = '*🍯HoneyPot:* No ✅';
      sniperBotsInfo = `\n🎯*Snipe:* [Maestro](${maestroUrl})\\([PRO](${maestroProUrl})\\) \\| [Banana](${bananaUrl}) \\| [Wagie](${wagieUrl})`;
}

formattedMessage = `*Token Name: ${escapeMarkdownV2Text(tokenInfo.name)} \\(${escapeMarkdownV2Text(tokenInfo.symbol)}\\)*
*💯Total Supply ${escapeMarkdownV2Text(tokenInfo.totalSupply)}*, *♻️Circ\\. Supply: ${escapeMarkdownV2Text(tokenInfo.circulatingSupply)}*   
*🔹ETH:* \`${tokenAddress}\`
*👨‍💻Owner:* ${ownerInfo}
*👥Holders:* ${holdersAddressLink} \\| ${percentageString}
*⚙️Contract Verified:* ${contractVerificationStatus}
${honeyPotStatusMessage}
*💧Liquid:* $${formattedLiquidity} / \\(${escapedLpPercentage}\\)
*💲MCap:* $${formattedMarketCap}
*📑Tax B/S:* ${escapeMarkdownV2Text(buyTax)}% / ${escapeMarkdownV2Text(sellTax)}% ${warningTax}`;

// Add maxBuyInfo only if it's not empty
if (maxBuyInfo) {
    formattedMessage += `\n${escapeMarkdownV2Text(maxBuyInfo)}`;
}

formattedMessage += `
*⛽️Gas:* \`${honeyPotStatus.simulationResult.buyGas} / ${honeyPotStatus.simulationResult.sellGas}\`
*🔒LP Lock:* ${escapeMarkdownV2Text(lockInfo.message, false)}
*🌐Socials:* ${linksToDisplay}
*⏰Age:* ${contractAge}`;

if (sniperBotsInfo) {
formattedMessage += sniperBotsInfo;
}
formattedMessage += `\n\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_
\`\\(DYOR\\)\\. NFA\\. Make informed decisions.\\.\`
*Promotion:* [Your Ad here](https://t.me/chilltoshi)`;

} else if (honeyPotStatus.simulationSuccess === true && honeyPotStatus.honeypotResult.isHoneypot === true ) {
formattedMessage = `*Token Name: ${escapeMarkdownV2Text(tokenInfo.name)} \\(${escapeMarkdownV2Text(tokenInfo.symbol)}\\)*
*💯Total Supply ${escapeMarkdownV2Text(tokenInfo.totalSupply)}*, *♻️Circ\\. Supply: ${escapeMarkdownV2Text(tokenInfo.circulatingSupply)}* 
*🔹ETH:* \`${tokenAddress}\`
*👨‍💻Owner:* ${ownerInfo}
*👥Holders* ${holdersAddressLink} \\| ${percentageString}
*⚙️Contract Verfied:* ${contractVerificationStatus}
*🍯HoneyPot:* Yes 🔴
*💧Liquid:* $${formattedLiquidity} / \\(${escapedLpPercentage}\\)
*💲MCap:* $${formattedMarketCap}
*📑Tax B/S:* ${escapeMarkdownV2Text(buyTax)}% / ${escapeMarkdownV2Text(sellTax)}%
*⛽️Gas:* ${honeyPotStatus.simulationResult.buyGas} / ${honeyPotStatus.simulationResult.sellGas}
*🔒LP Lock:* ${escapeMarkdownV2Text(lockInfo.message, false)}
*🌐Socials:* ${linksToDisplay}
*⏰Age:* ${contractAge}`;
formattedMessage += `\n\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_
\`\\(DYOR\\)\\. NFA\\. Make informed decisions.\\.\`
*Promotion:* [Your Ad here](https://t.me/chilltoshi)`;

}  else if (honeyPotStatus.simulationSuccess === false && honeyPotStatus.simulationError === 'execution reverted: UniswapV2Library: INSUFFICIENT_LIQUIDITY' ) {
const subscriberIds = readSubscriberIdSync();
const isPremiumUser = subscriberIds.includes(ctx.from.id.toString());

if (isPremiumUser) {
  formattedMessage = `*Token Name: ${escapeMarkdownV2Text(tokenInfo.name)} \\(${escapeMarkdownV2Text(tokenInfo.symbol)}\\)*
  *💯Total Supply ${escapeMarkdownV2Text(tokenInfo.totalSupply)}*, *♻️Circ\\. Supply: ${escapeMarkdownV2Text(tokenInfo.circulatingSupply)}* 
*🔹ETH:* \`${tokenAddress}\`
*👨‍💻Owner:* ${ownerInfo}
*👥Holders* ${holdersAddressLink} \\| ${percentageString}
*⚙️Contract Verified:* ${contractVerificationStatus}
*🍯HoneyPot:* Insufficient Liquidity\\!
*📑Tax B/S:* \\- / \\-
*💧Liquid:* $${formattedLiquidity}
*💲MCap:* $${formattedMarketCap}
*🔒LP Lock:* ${escapeMarkdownV2Text(lockInfo.message)}
*🌐Socials:* ${linksToDisplay}
*⏰Age:* ${contractAge}`;
formattedMessage += `\n\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_
\`\\(DYOR\\)\\. NFA\\. Make informed decisions.\\.\`
*Promotion:* [Your Ad here](https://t.me/chilltoshi)`;
} else {

    formattedMessage = `*Token Name: ${escapeMarkdownV2Text(tokenInfo.name)} \\(${escapeMarkdownV2Text(tokenInfo.symbol)}\\)*\n*❗️ The token don't have liquidity yet\\.*`
  }
} else if (honeyPotStatus.simulationSuccess === false && honeyPotStatus.simulationError === 'execution reverted: HP: BUY_FAILED' ) {
formattedMessage = `*Token Name: ${escapeMarkdownV2Text(tokenInfo.name)} \\(${escapeMarkdownV2Text(tokenInfo.symbol)}\\)*
*💯Total Supply ${escapeMarkdownV2Text(tokenInfo.totalSupply)}*, *♻️Circ\\. Supply: ${escapeMarkdownV2Text(tokenInfo.circulatingSupply)}*   
*🔹ETH:* \`${tokenAddress}\`
*👨‍💻Owner:* ${ownerInfo}
*👥Holders* ${holdersAddressLink} \\| ${percentageString}
*⚙️Contract Verfied:* ${contractVerificationStatus}
*🍯HoneyPot:* Yes 🔴
*🧠REASON:* Buy Failed
*💧Liquid:* $${formattedLiquidity} / \\(${escapedLpPercentage}\\)
*💲MCap:* $${formattedMarketCap}
*📑TAX B/S:* 0 / 0
*🔒LP Lock:* ${escapeMarkdownV2Text(lockInfo.message)}
*🌐Socials:* ${linksToDisplay}
*⏰Age:* ${contractAge}`;

formattedMessage += `\n\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_\\_
\`\\(DYOR\\)\\. NFA\\. Make informed decisions.\\.\`
*Promotion:* [Your Ad here](https://t.me/chilltoshi)`;

} else {
    formattedMessage = 'status not found'
  }
 // console.log('Formatted Message:', formattedMessage);
const inlineKeyboardMarkup = {
inline_keyboard: [
    [
        { text: '📈 Chart', url: `https://www.dextools.io/app/en/ether/pair-explorer/${tokenAddress}` },
        { text: '🔎 Etherscan', url: `https://etherscan.io/address/${tokenAddress}` }
    ],

    [ 
      { text: '🕵️‍♂️ Tax Watcher', callback_data: 'taxfarm_coming_soon' }, // This button won't lead anywhere for now
      { text: '🔹 ETH Trend', callback_data: 'ethtrend_coming_soon' }
  ],
]
};

  ctx.telegram.editMessageText(
    ctx.chat.id, 
    initialMessage.message_id, 
    null, 
    formattedMessage, 
    { disable_web_page_preview: true, 
      parse_mode: "MarkdownV2", 
      reply_markup: inlineKeyboardMarkup });

 // console.log('done');
}
console.timeEnd('FullScriptTime');
}

module.exports = {processEthTokenAddress};

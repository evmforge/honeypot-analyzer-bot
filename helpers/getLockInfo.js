const { ethers } = require("ethers");
const axios  = require('axios');
const { provider, etherscanApiKey } = require('../provider')
const { unicryptABI, pinksaleABI, trustSwapABI, BURN_ADDRESS, erc20ABI, UnicryptAddress, pinksaleAddress, TrustSwapAddress } = require('../abis/abi.js');
const { getInitialLiquidityProvider } = require('./EsService');

//const index = 0;
function calculatePercentage(lockedAmount, totalSupply) {
return Math.round(Number(lockedAmount * 10000n / totalSupply) / 100);
}

function calculateRemainingTime(unlockTimeUnix) {
const currentTime = new Date();
const unlockTime = new Date(Number(unlockTimeUnix) * 1000); 
const timeDiff = unlockTime - currentTime;

let timeRemaining;
if (timeDiff < 0) {
  timeRemaining = "Lock has expired";
} else {
  const daysRemaining = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
 // If more than 13 hours are remaining, count it as an extra day
 const adjustedDaysRemaining = hoursRemaining > 12 ? daysRemaining + 1 : daysRemaining;
 const daysText = adjustedDaysRemaining === 1 ? 'day' : 'days';
 timeRemaining = `${adjustedDaysRemaining} ${daysText}`;
}

return timeRemaining;
}  

async function fetchTrustSwapLock(tokenAddress, trustSwapABI, lpTokenContract) {
  try {
      const ownerAddress = await getInitialLiquidityProvider(tokenAddress)
      if (!ownerAddress) {
        console.log("Liquidity provider is not found, skipping Team.finance check")
        return; 
      }
      const trustSwapContract = new ethers.Contract(TrustSwapAddress, trustSwapABI, provider);
      const depositIds = await trustSwapContract.getDepositsByWithdrawalAddress(ownerAddress);
      if (!depositIds || depositIds.length === 0) {
    console.log('No TrustSwap deposits found for this wallet, skipping...');
    return null;
}
      const ids = depositIds.toString().split(',');
     // console.log("deposit IDs in team.finance:", depositIds.toString());

      let maxLockedAmount = BigInt(0);
      let maxLockInfo = null;
      let burnedPercentage = 0;
      let lockedPercentage = 0

      // Fetch total supply
      const totalSupplyLP = await lpTokenContract.totalSupply();
      console.log('Total Lp supply', totalSupplyLP.toString());

      for (const id of ids) {
          const lockDetails = await trustSwapContract.getDepositDetails(id.trim());
          // console.log('lock details of trust swap', lockDetails);
          if (lockDetails._tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && lockDetails._tokenAmount > maxLockedAmount) {
              maxLockedAmount = lockDetails._tokenAmount;
              maxLockInfo = { unlockDate: lockDetails._unlockTime };
          //    console.log('max locked amount in trustswap', maxLockedAmount, maxLockInfo);

              lockedPercentage = calculatePercentage(maxLockedAmount, totalSupplyLP);
             // console.log('Locked Percentage inside TrustSwap function', lockedPercentage);

              if (lockedPercentage < 50) {
                const burnedAmount = await lpTokenContract.balanceOf(BURN_ADDRESS);
                console.log('Burned percentage inside trustswap function', burnedAmount.toString());

                burnedPercentage =  calculatePercentage(burnedAmount, totalSupplyLP);
              //  console.log('Burned Percentage', burnedPercentage);
              }
          }
      }

      if (maxLockInfo) {
          return {
              amount: maxLockedAmount,
              info: maxLockInfo,
              platform: "*TrustSwap*",
              lockedPercentage,
              burnedPercentage

          };
      } else {
          console.log("No lock found on TrustSwap for this token.");
      }
  } catch (error) {
      console.error("team finance error:", error.message);
  }
  return null;
}


async function fetchUnicryptLock(tokenAddress, cachedUnicryptABI, lpTokenContract) {
  try {
      const unicryptContract = new ethers.Contract(UnicryptAddress, cachedUnicryptABI, provider);
       // Fetch total supply of the LP tokens
      const totalSupplyLP = await lpTokenContract.totalSupply();
      const lockCount = await unicryptContract.getNumLocksForToken(tokenAddress);
      if (lockCount === 0n) {
        console.log("No lock found on unicrypt for this token, skipping...");
        return null
      }

      const lock = await unicryptContract.tokenLocks(tokenAddress, 0);
 //     console.log('lock info from unicrypt', lock.amount.toString());
      if (lock) {
        const lockedAmount = BigInt(lock.amount);

         // Calculate locked percentage
         const lockedPercentage =  calculatePercentage(lockedAmount, totalSupplyLP);
         let burnedPercentage = null;

         if (lockedPercentage < 50) {
             // Check burned supply
             const burnedAmount = await lpTokenContract.balanceOf(BURN_ADDRESS);
             burnedPercentage = calculatePercentage(burnedAmount, totalSupplyLP);

             if (burnedPercentage > 50) {
                 console.log(`${burnedPercentage.toFixed(2)}% of supply burned`);
             } else {
                 console.log("Status: Unknown Lock");
             }
         }

         return {
             amount: lockedAmount,
             info: { unlockDate: lock.unlockDate },
             platform: "*Unicrypt*",
             lockedPercentage,
             burnedPercentage
         };
     } else {
         console.log("No lock found on Unicrypt for this token.");
     }
 } catch (error) {
     console.error("Error fetching Unicrypt lock:", error.message);
 }
 return null;
}

async function fetchPinkSaleLock(tokenAddress, cachedPinksaleABI, lpTokenContract) {
  try {
      const pinksaleContract = new ethers.Contract(pinksaleAddress, cachedPinksaleABI, provider);
      const lockCount = await pinksaleContract.totalLockCountForToken(tokenAddress);
      if (lockCount === 0n) {
        console.log("No lock found on pinksale for this Token skipping...");
        return null;
      }
      const lockDetails = await pinksaleContract.getLocksForToken(tokenAddress, 0, 0);

      if (lockDetails.length > 0) {
          const firstLock = lockDetails[0];
          const lockedAmount = BigInt(firstLock.amount);
          console.log(`locked Amount on Pinksale: ${lockedAmount.toString()}`);
          console.log('unlockTime in uinx', firstLock[5].toString());

          // Fetch total supply of the LP tokens
          const totalSupplyLP = await lpTokenContract.totalSupply();
        //  console.log('TotalSupply in pinksale function', totalSupplyLP.toString());

           // Calculate locked percentage
           const lockedPercentage = calculatePercentage(lockedAmount, totalSupplyLP);
        //   console.log('Locked Percentage', lockedPercentage.toString());
           let burnedPercentage = null;

           if (lockedPercentage < 20) {
            // check the burned supply
            const burnedAmount = await lpTokenContract.balanceOf(BURN_ADDRESS);
            console.log('Burned Amount for Pinksale lock', burnedAmount.toString());
            burnedPercentage = calculatePercentage(burnedAmount, totalSupplyLP);

            if (burnedPercentage > 50) {
              console.log(`${burnedPercentage.toFixed[2]}% of supply burned`)
            } else {
              console.log('Unknown Lock')
            }

           }
    
          return {
              amount: lockedAmount,
              info: { unlockDate: firstLock[5].toString() },
              platform: "*PinkSale*",
              lockedPercentage,
              burnedPercentage
          };
      } else {
          console.log("No lock found on PinkSale for this token.");
      }

  } catch (error) {
      console.error("Pinksale error:", error.message);
  }
  return null;
}


async function getLockInfo(tokenAddress) {
  let result = {};
    try {
        let lockedAmount = BigInt(0);
        let lockInfo = null;
        let lockPlatform = ""; 
        let burnedPercentage = 0;
        let lockedPercentage = 0;

      const lpTokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
      const [unicryptLock, trustSwapLock, pinksaleLock, totalSupply, decimals] = await Promise.all([
          fetchUnicryptLock(tokenAddress, unicryptABI, lpTokenContract),
          fetchTrustSwapLock(tokenAddress, trustSwapABI, lpTokenContract),
          fetchPinkSaleLock(tokenAddress, pinksaleABI, lpTokenContract),
          lpTokenContract.totalSupply(),
          lpTokenContract.decimals()
      ]);

         // Process lock details from each platform
         [unicryptLock, trustSwapLock, pinksaleLock].forEach(lock => {
          if (lock && lock.amount > lockedAmount) {
              lockedAmount = lock.amount;
              lockInfo = lock.info;
              lockPlatform = lock.platform;
              lockedPercentage = lock.lockedPercentage;
              burnedPercentage = lock.burnedPercentage || 0;
          }
      });

       // Final calculation and logging
       if (lockInfo) {
        const timeRemaining = calculateRemainingTime(lockInfo.unlockDate);
        if (timeRemaining === 'Lock has expired') {
          result = {
            status: "Expired", 
            message: `Lock on *${lockPlatform}* has expired`
          };
        } else if (burnedPercentage && burnedPercentage > 50) {
            result = {
                status: "Burned",
                percentage: burnedPercentage,
                message: `*${burnedPercentage.toFixed(2)}% of LP burned*`
            };
            }  else if (lockedPercentage >= 20) {
          let formattedMessage = `*${lockedPercentage.toFixed(2)}%* for *${timeRemaining}* on ${lockPlatform}`;
            result = {
                status: "Locked",
                message: formattedMessage
            };
        } else {
            result = { message: "*Unknown Lock*" };
        }
    } else {
        const burnedAmount = await lpTokenContract.balanceOf(BURN_ADDRESS);
        burnedPercentage = calculatePercentage(burnedAmount, totalSupply);

        if (burnedPercentage >= 50) {
            result = {
                status: "Burned",
                percentage: burnedPercentage,
                message: `*${burnedPercentage.toFixed(2)}% LP BURNED*`
            };
        } else {
            result = { message: "*Unknown Lock*" };
        }
    }
} catch (error) {
    console.error("Error fetching lock info:", error);
    result = { status: "Error", message: "*Unknown Lock*" };
}

return result; 
}

module.exports = {
    getLockInfo
}
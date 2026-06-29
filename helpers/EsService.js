const axios = require('axios');

const etherscanApiKey = process.env.etherScanAPI;

const urlPattern = /(https?:\/\/[\w\d\-._~:/?#[\]@!$&'()*+,;=%]+|www\.[\w\d\-._~:/?#[\]@!$&'()*+,;=%]+|t\.me\/[\w\d\-._~:/?#[\]@!$&'()*+,;=%]+|twitter\.com\/[\w\d\-._~:/?#[\]@!$&'()*+,;=%]+)/gi;

const blocklistPattern = new RegExp([
  'zeppelin', 'eips', 'malicious-backdoors', 'solidity.readthedocs.io',
  'eth_getstorageat', 'consensys.net', 'diligence.consensys.net', 
  'ethereum/solidity/issues/', 'erc20-generator', 'oraclize/ethereum-api', 
  'TokenMarketNet', 'bitbond.com', 'github.com', 'web3js', 'ethers.io', 
  'github.io', 'eth.wiki', 'metamask', 'stackexchange', 'wikipedia', 
  'twitch', 'xn--2-umb.com', 'hardhat'
].join('|'), 'i');

const allowlistPattern = new RegExp([
  'x.com', 'facebook', 'gitbook', 'youtube', 'tiktok', 'linkedin', 
  'instagram', 't.me', 'twitter', 'snapchat', 'wechat', 'medium.com', 
  'quora', 'reddit', 'discord', 'kwai', 'app.ens.domains', 'bot', 'http'
].join('|'), 'i');

  const getSocials = (ContractsourceCode) => {
    const lowerCaseSource = ContractsourceCode.toLowerCase();

    const allComments = lowerCaseSource.match(/(\/\*[\s\S]*?\*\/|\/\/.*)/g) || [];
   //  console.log('All comments from the source', allComments);

   return Array.from(new Set(allComments.flatMap(comment => {
    const urls = comment.match(urlPattern) || [];
    return urls.filter(url => !blocklistPattern.test(url) && allowlistPattern.test(url));
   })))
    }
   
    const processSocialLinks = (socialLinks) => {
      const linkCounts = {};
   //  console.log('Entered Process Social Links', socialLinks);
      return socialLinks.map(link => {
        const match = link.match(/(https?:\/\/[^\s]+)/i);
        const cleanLink = match ? match[0] : link;

        const serviceNames = {
          'twitter': 'Twitter',
          't.me': 'Telegram',
          'gitbook': 'Gitbook',
          'linkedin': 'LinkedIn',
          'youtube': 'YouTube',
          'tiktok': 'TikTok',
          'facebook': 'Facebook',
          'x.com': 'X\\.com',
          'instagram': 'Instagram',
          'kwai': 'Kwai',
          'app.ens.domains': 'ENS',
          'discord': 'Discord',
          'snapchat': 'Snapchat',
          'reddit': 'Reddit',
          'quora': 'Quora',
          'medium.com': 'Medium',
          'wechat': 'WeChat',
          'linktr': 'LinkTree'
          // Add more mappings as needed
        };
        const serviceNameMatch = cleanLink.match(/(twitter|t\.me|gitbook|linkedin|youtube|tiktok|facebook|x\.com|instagram|kwai|app\.ens\.domains|discord|snapchat|reddit|quora|medium\.com|wechat|linktr)/i);
        const serviceNameKey = serviceNameMatch ? serviceNameMatch[0].toLowerCase() : 'website';
        const baseServiceName = serviceNames[serviceNameKey] || 'Web';

        // Count the occurence of each service
        linkCounts[baseServiceName] = (linkCounts[baseServiceName] || 0) + 1;
        const serviceName = linkCounts[baseServiceName] > 1 ? `${baseServiceName}${linkCounts[baseServiceName]}` : baseServiceName;

       // console.log('Data recieved from process social links', serviceName, cleanLink);
        return `[${serviceName}](${cleanLink})`
      });
    }

    const getSourceCode = async (tokenAddress) => {
    const contractAddress = tokenAddress;
    const url = `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=${contractAddress}&apikey=${etherscanApiKey}`;
    const response = await axios.get(url)
    //console.log('response from get source code using etherscan api', response.data);
    const sourceCode = response.data.result[0].SourceCode
  
    const socialLinks = getSocials(sourceCode)
    const processedLinks = processSocialLinks(socialLinks)
    return processedLinks;
  }


  function getTimeDifference(startDate, endDate) {
    let delta = Math.abs(endDate - startDate) / 1000;

    const days = Math.floor(delta / 86400); 
    delta -= days * 86400;

    const hours = Math.floor(delta / 3600) % 24;
    delta -= hours * 3600;

    const minutes = Math.floor(delta / 60) % 60;
    delta -= minutes * 60;

    let seconds = delta % 60;
    seconds = seconds.toFixed(0);

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

async function getContractAge(tokenAddress) {
    const url = `https://api.etherscan.io/v2/api?chainid=1`;
    const apiClient = axios.create({
        baseURL: url,
        params: {
            module: 'account',
            action: 'txlist',
            address: tokenAddress,
            page: 1,
            offset: 1,
            sort: 'asc',
            apiKey: etherscanApiKey
        }
    })
  
      try {
        const startTime = performance.now(); 
        const { data } = await apiClient.get('');
        const endTime = performance.now();
        const apiReponse = (endTime - startTime).toFixed(3);
        console.log(`Api Response Time for getContractAge: ${apiReponse}ms`);
  
      if (data.status === '1' && data.result.length > 0) {
        const { timeStamp } = data.result[0];
        const creationDate = new Date(timeStamp * 1000) // convert to miliseconds
        const currentDate = new Date();
       // console.log('current Date:', currentDate)
        const difference =  getTimeDifference(creationDate, currentDate)
        return difference;
      } else {
        console.log('No Transactions Found')
      }
    } catch (error) {
      console.error('error fetching timestamp', error);
    }
  }

  async function getInitialLiquidityProvider(lpTokenAddress) {
    try {
    const url = `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getcontractcreation&contractaddresses=${lpTokenAddress}&apikey=${etherscanApiKey}`;
    const response = await axios.get(url);
    
    if (response.data.status !== '1' || response.data.result.length === 0 ) {
        console.log("no creator found for pair:", lpTokenAddress);
        return null;
    }
        const contractCreator = response.data.result[0].contractCreator;
        return contractCreator;
} catch (error) {
        console.log("get Initial liquidity provider error:", error.message);
    }

return null;
}


  module.exports = {
    getSourceCode,
    getContractAge,
    getInitialLiquidityProvider
  }
 
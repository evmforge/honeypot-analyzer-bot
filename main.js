const { Telegraf, Markup } = require('telegraf');
const { processEthTokenAddress } = require('./processTokenRequest'); 
const bot = new Telegraf(process.env.botToken);
const { provider } = require('./provider');

async function isContractAddress(address) {
  try {
      const code = await provider.getCode(address);
      //console.log('data recieved from isContractAddress function', code)
        // EIP-7702 delegation designator - treat as EOA
        if (code.startsWith('0xef0100')) {
            console.log('EIP-7702 delegated EOA detected');
            return false;
        }
      return code !== '0x' && code !== '0x0';
  } catch (error) {
      console.error('Error checking if address is a contract', error);
      return false;
  }
}

function isValidEthAddress(address) {
  return address.length === 42 && address.startsWith('0x');
}

async function validateAndProcess(ctx, address) {
 if (!isValidEthAddress(address)) {
    return ctx.reply("Invalid address. Please send a valid Ethereum contract address.");
  }
  const isContract = await isContractAddress(address);
  console.log('checking if the address is contract or EOA', isContract);
  if (!isContract) {
    return ctx.reply('This appears to be wallet address not a token contract');
  }
  const timeoutId = setTimeout(() => {
    ctx.reply('⏱ Request timed out. Please try again.');

  }, 10000);
  try {
    await processEthTokenAddress(ctx, address);
  } catch (error) {
    console.error('Error processing token:', error.message);
    ctx.reply('An error occured. Please try again');
  } finally {
    clearTimeout(timeoutId);
  }
}

bot.command('start', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const tokenAddress = args.length > 1 ? args[1] : null;
  const firstName = ctx.from.first_name;

  if (tokenAddress) {
    await validateAndProcess(ctx, tokenAddress)
  } else {
      // The response message when the user sends '/start'
  const welcomeMessage = `
  *Hi ${firstName},* 👋
Welcome to the Safe Analyzer Bot! This bot delivers a comprehensive audit report on ERC-20 tokens on the Ethereum blockchain. Here's how to use it:
  1. Send an ERC-20 token contract address.
  2. The bot will then analyze and furnish details on honeypot status, liquidity, market cap, and more.

Remember to send a valid Ethereum contract address without any spaces or commands.

Official contact @chilltoshi

For direct inquiries: @chilltoshi
    `;
    console.log('Welcome Message', welcomeMessage);
    ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
  }
});

bot.help((ctx) => {
  const helpMessage = `Here are the commands and button actions you can use with this bot:\n\n` +
  `*Commands:*\n` +
  `/start \\- Get an introduction and instructions on how to use the bot\\.\n`;

  ctx.reply(helpMessage, { parse_mode: 'MarkdownV2' });
});

bot.on('text', async (ctx) => {
    const input = ctx.message.text.trim();
    if (input.startsWith('/')) return; // ignore commands
    await validateAndProcess(ctx, input);
});


bot.on('callback_query', (ctx) => {
  const action = ctx.callbackQuery.data;

  if (action === 'ethtrend_coming_soon') {
    ctx.answerCbQuery();
    ctx.reply('Coming Soon!');

  } else if (action === 'taxfarm_coming_soon') {
    ctx.answerCbQuery();
    ctx.reply('Coming Soon!');
  }
});


bot.launch({ dropPendingUpdates: true});
console.log("bot is running")

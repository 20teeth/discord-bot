require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { DISCORD_TOKEN } = require('./config');
const { registerCommands } = require('./services/commands');
const { ensureVerificationMessage } = require('./services/verificationMessage');
const { handleInteractionCreate } = require('./handlers/interactionCreate');
const { handleMessageCreate } = require('./handlers/messageCreate');

if (!DISCORD_TOKEN) {
  console.error('Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try {
    await registerCommands(client);
    await ensureVerificationMessage(client);
  } catch (error) {
    console.error('Failed to initialize bot:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    await handleInteractionCreate(interaction);
  } catch (error) {
    console.error('Interaction handler failed:', error);
  }
});

client.on('messageCreate', async (message) => {
  await handleMessageCreate(message);
});

client.login(DISCORD_TOKEN);

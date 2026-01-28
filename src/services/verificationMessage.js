const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { GUILD_ID, CHANNEL_ID } = require('../config');
const { BOT_EMBED_TITLE, BUTTON_ID } = require('../constants');
const { getChannelState, setChannelState } = require('../storage/stateStore');

function buildVerificationPayload() {
  const embed = new EmbedBuilder()
    .setTitle(BOT_EMBED_TITLE)
    .setColor(0x3b82f6)
    .setDescription(
      [
        'Welcome to 20t, a nonprofit club built by curious people who love to create.',
        'We keep things simple and welcoming. Here are the quick steps to join:',
        '',
        '1) Join Hack Club: https://hack.club/join/AJPAGQ',
        '2) Click **Done**, then join the official Slack: https://hackclub.enterprise.slack.com/archives/C0AB46SAF43',
        '3) You will be asked for your Slack ID (it starts with **U**).',
        '',
        'Thanks for joining us. We are excited to build with you.',
      ].join('\n'),
    )
    .setFooter({ text: 'Need help? Ask a mod.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_ID)
      .setLabel('Done!')
      .setStyle(ButtonStyle.Success),
  );

  return { embeds: [embed], components: [row] };
}

function isVerificationMessage(message, botId) {
  if (!message || message.author?.id !== botId) {
    return false;
  }

  return message.components?.some((row) =>
    row.components?.some((component) => component.customId === BUTTON_ID),
  );
}

async function ensureVerificationMessage(client) {
  const channelState = getChannelState(CHANNEL_ID);

  const guild = await client.guilds.fetch(GUILD_ID);
  const channel = await guild.channels.fetch(CHANNEL_ID);
  if (!channel || !channel.isTextBased()) {
    console.warn('Verification channel is missing or not text-based.');
    return;
  }

  let message = null;
  if (channelState.messageId) {
    try {
      message = await channel.messages.fetch(channelState.messageId);
    } catch {
      message = null;
    }
  }

  if (!message) {
    const recent = await channel.messages.fetch({ limit: 50 });
    message = recent.find((msg) => isVerificationMessage(msg, client.user.id));
  }

  const payload = buildVerificationPayload();

  if (!message) {
    const sent = await channel.send(payload);
    setChannelState(CHANNEL_ID, sent.id);
    return;
  }

  try {
    await message.edit(payload);
  } catch (error) {
    console.warn('Failed to update verification message:', error);
  }

  if (message.id !== channelState.messageId) {
    setChannelState(CHANNEL_ID, message.id);
  }
}

module.exports = {
  ensureVerificationMessage,
};

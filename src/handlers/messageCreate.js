const { AUTO_DELETE_CHANNEL_ID, GUILD_ID } = require('../config');

async function handleMessageCreate(message) {
  if (!message.inGuild() || message.guildId !== GUILD_ID) {
    return;
  }

  if (message.channelId !== AUTO_DELETE_CHANNEL_ID) {
    return;
  }

  if (!message.deletable) {
    return;
  }

  try {
    await message.delete();
  } catch (error) {
    console.warn('Failed to auto-delete a message:', error);
  }
}

module.exports = {
  handleMessageCreate,
};

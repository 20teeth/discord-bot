const { MessageFlags } = require('discord.js');

function applyEphemeralFlag(payload) {
  if (!payload?.ephemeral) {
    return payload;
  }

  const { ephemeral, ...rest } = payload;
  const flags =
    typeof rest.flags === 'number'
      ? rest.flags | MessageFlags.Ephemeral
      : MessageFlags.Ephemeral;

  return { ...rest, flags };
}

async function safeReply(interaction, payload) {
  const finalPayload = applyEphemeralFlag(payload);
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(finalPayload);
    }
    return await interaction.reply(finalPayload);
  } catch (error) {
    if (error && (error.code === 10062 || error.code === 40060)) {
      return null;
    }
    throw error;
  }
}

async function safeDefer(interaction, { ephemeral = true } = {}) {
  if (interaction.replied || interaction.deferred) {
    return null;
  }

  try {
    if (ephemeral) {
      return await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
    return await interaction.deferReply();
  } catch (error) {
    if (error && (error.code === 10062 || error.code === 40060)) {
      return null;
    }
    throw error;
  }
}

module.exports = {
  applyEphemeralFlag,
  safeReply,
  safeDefer,
};

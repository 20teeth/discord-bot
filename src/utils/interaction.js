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
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(finalPayload);
  }
  return interaction.reply(finalPayload);
}

module.exports = {
  applyEphemeralFlag,
  safeReply,
};

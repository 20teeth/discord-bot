const { BUTTON_ID, MODAL_ID, APPLY_MODAL_ID, POST_MODAL_ID, APPLY_COMMAND_NAME, COLLAB_COMMAND_NAME, BAN_COMMAND_NAME, UNBAN_COMMAND_NAME, MUTE_COMMAND_NAME, UNMUTE_COMMAND_NAME, PURGE_COMMAND_NAME, POST_COMMAND_NAME } = require('../constants');
const { GUILD_ID } = require('../config');
const { safeReply } = require('../utils/interaction');
const { hasAccessRole } = require('../utils/permissions');
const { handleVerificationButton, handleVerificationModal } = require('../flows/verification');
const { handleApplyCommand, handleApplyModal, handleApplyDecision } = require('../flows/apply');
const { handleCollabCommand } = require('../flows/collab');
const { handleBanCommand, handleUnbanCommand, handleMuteCommand, handleUnmuteCommand, handlePurgeCommand, handleBanButtons, handleMuteAllButtons } = require('../flows/moderation');
const { handlePostCommand, handlePostModal } = require('../flows/post');

async function handleInteractionCreate(interaction) {
  if (interaction.isChatInputCommand()) {
    if (!interaction.inGuild() || interaction.guildId !== GUILD_ID) {
      await safeReply(interaction, {
        content: 'This command only works inside the 20t server.',
        ephemeral: true,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!hasAccessRole(member)) {
      await safeReply(interaction, {
        content:
          'You need the 20t access role before using commands. Please complete verification and jump in with us.',
        ephemeral: true,
      });
      return;
    }

    switch (interaction.commandName) {
      case APPLY_COMMAND_NAME:
        await handleApplyCommand(interaction);
        return;
      case COLLAB_COMMAND_NAME:
        await handleCollabCommand(interaction);
        return;
      case BAN_COMMAND_NAME:
        await handleBanCommand(interaction);
        return;
      case UNBAN_COMMAND_NAME:
        await handleUnbanCommand(interaction);
        return;
      case MUTE_COMMAND_NAME:
        await handleMuteCommand(interaction);
        return;
      case UNMUTE_COMMAND_NAME:
        await handleUnmuteCommand(interaction);
        return;
      case PURGE_COMMAND_NAME:
        await handlePurgeCommand(interaction);
        return;
      case POST_COMMAND_NAME:
        await handlePostCommand(interaction);
        return;
      default:
        return;
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === BUTTON_ID) {
      await handleVerificationButton(interaction);
      return;
    }

    const handledBan = await handleBanButtons(interaction);
    if (handledBan) {
      return;
    }

    const handledMute = await handleMuteAllButtons(interaction);
    if (handledMute) {
      return;
    }

    const handledApply = await handleApplyDecision(interaction);
    if (handledApply) {
      return;
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === MODAL_ID) {
      await handleVerificationModal(interaction);
      return;
    }

    if (interaction.customId === APPLY_MODAL_ID) {
      await handleApplyModal(interaction);
      return;
    }

    if (interaction.customId === POST_MODAL_ID) {
      await handlePostModal(interaction);
    }
  }
}

module.exports = {
  handleInteractionCreate,
};

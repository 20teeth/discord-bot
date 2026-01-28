const { PermissionsBitField } = require('discord.js');
const { safeReply } = require('../utils/interaction');
const {
  canUseProjectCollab,
  getSlackIdRole,
  isProjectChannel,
} = require('../utils/permissions');

async function handleCollabCommand(interaction) {
  if (!isProjectChannel(interaction.channel)) {
    await safeReply(interaction, {
      content: 'Use this command inside a project channel.',
      ephemeral: true,
    });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!canUseProjectCollab(member, interaction.channel)) {
    await safeReply(interaction, {
      content: 'You do not have permission to add collaborators here.',
      ephemeral: true,
    });
    return;
  }

  const targetUser = interaction.options.getUser('user');
  const slackIdInput = interaction.options.getString('slack_id');

  if (!targetUser && !slackIdInput) {
    await safeReply(interaction, {
      content: 'Provide a Discord user or a Slack ID.',
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  await guild.roles.fetch();
  const botMember = await guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    await safeReply(interaction, {
      content: 'I need the Manage Channels permission to add collaborators.',
      ephemeral: true,
    });
    return;
  }

  let slackRole = null;
  if (targetUser) {
    const targetMember = await guild.members.fetch(targetUser.id);
    slackRole = getSlackIdRole(targetMember);
    if (!slackRole) {
      await safeReply(interaction, {
        content: 'That user does not have a Slack ID role yet.',
        ephemeral: true,
      });
      return;
    }
  } else {
    const cleanedSlackId = slackIdInput.trim();
    if (!/^U[0-9A-Z]+$/i.test(cleanedSlackId)) {
      await safeReply(interaction, {
        content: 'Please provide a valid Slack ID that starts with U.',
        ephemeral: true,
      });
      return;
    }

    slackRole = guild.roles.cache.find(
      (role) => role.name.toUpperCase() === cleanedSlackId.toUpperCase(),
    );
    if (!slackRole) {
      await safeReply(interaction, {
        content: 'No Slack ID role found for that ID.',
        ephemeral: true,
      });
      return;
    }
  }

  try {
    await interaction.channel.permissionOverwrites.edit(slackRole.id, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: true,
      AddReactions: true,
      AttachFiles: true,
      EmbedLinks: true,
      CreatePublicThreads: true,
      CreatePrivateThreads: true,
      SendMessagesInThreads: true,
      ManageMessages: true,
      ManageThreads: true,
      UseApplicationCommands: true,
      UseExternalEmojis: true,
      UseExternalStickers: true,
    });

    await safeReply(interaction, {
      content: `Collaborator added. Slack ID role: **${slackRole.name}**.`,
      ephemeral: true,
    });
  } catch (error) {
    console.error('Failed to add collaborator:', error);
    await safeReply(interaction, {
      content:
        'Something went wrong while adding that collaborator. Please contact a server admin.',
      ephemeral: true,
    });
  }
}

module.exports = {
  handleCollabCommand,
};

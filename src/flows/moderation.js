const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} = require('discord.js');
const {
  BAN_CONFIRM_PREFIX,
  BAN_CANCEL_PREFIX,
  MUTE_ALL_APPROVE_PREFIX,
  MUTE_ALL_DENY_PREFIX,
} = require('../constants');
const { safeReply } = require('../utils/interaction');
const { isModerator } = require('../utils/permissions');
const {
  buildReason,
  trySendDm,
  muteAllMembers,
  unmuteAllMembers,
} = require('../utils/moderation');
const { formatDuration } = require('../utils/text');
const { saveAction, updateAction, getAction } = require('../storage/actionsStore');

function collectUserOptions(interaction) {
  const users = [];
  for (let i = 1; i <= 5; i += 1) {
    const user = interaction.options.getUser(`user${i}`);
    if (user && !users.some((existing) => existing.id === user.id)) {
      users.push(user);
    }
  }
  return users;
}

async function handleBanCommand(interaction) {
  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);
  const botMember = await guild.members.fetchMe();

  if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
    await safeReply(interaction, {
      content: 'You do not have permission to ban members.',
      ephemeral: true,
    });
    return;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
    await safeReply(interaction, {
      content: 'I need the Ban Members permission to do that.',
      ephemeral: true,
    });
    return;
  }

  const users = collectUserOptions(interaction);
  if (users.length === 0) {
    await safeReply(interaction, {
      content: 'Please specify at least one user to ban.',
      ephemeral: true,
    });
    return;
  }

  const reasonInput = interaction.options.getString('reason');
  const actionId = `ban_${Date.now()}_${interaction.user.id}`;

  saveAction(actionId, {
    type: 'ban',
    requestedBy: interaction.user.id,
    userIds: users.map((user) => user.id),
    reason: reasonInput || '',
    createdAt: new Date().toISOString(),
    status: 'pending',
  });

  const embed = new EmbedBuilder()
    .setTitle('Confirm Ban')
    .setColor(0xf97316)
    .setDescription(
      [
        'You are about to ban:',
        ...users.map((user) => `- <@${user.id}>`),
        '',
        `Reason: ${reasonInput || 'No reason provided.'}`,
      ].join('\n'),
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BAN_CONFIRM_PREFIX}${actionId}`)
      .setLabel('Confirm Ban')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${BAN_CANCEL_PREFIX}${actionId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  await safeReply(interaction, {
    embeds: [embed],
    components: [row],
    ephemeral: true,
  });
}

async function handleUnbanCommand(interaction) {
  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);
  const botMember = await guild.members.fetchMe();

  if (!member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
    await safeReply(interaction, {
      content: 'You do not have permission to unban members.',
      ephemeral: true,
    });
    return;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
    await safeReply(interaction, {
      content: 'I need the Ban Members permission to do that.',
      ephemeral: true,
    });
    return;
  }

  const userIdRaw = interaction.options.getString('user_id').trim();
  const userId = userIdRaw.replace(/\D/g, '');
  if (!userId) {
    await safeReply(interaction, {
      content: 'Please provide a valid user ID.',
      ephemeral: true,
    });
    return;
  }

  const reasonInput = interaction.options.getString('reason');
  const reason = buildReason(reasonInput, interaction.user.tag);

  try {
    await guild.members.unban(userId, reason);
    await trySendDm(
      interaction.client,
      userId,
      `You were unbanned from 20t. Reason: ${
        reasonInput || 'No reason provided.'
      }`,
    );
    await safeReply(interaction, {
      content: `Unbanned <@${userId}>.`,
      ephemeral: true,
    });
  } catch (error) {
    console.error('Failed to unban:', error);
    await safeReply(interaction, {
      content: 'Failed to unban that user. Check the ID and try again.',
      ephemeral: true,
    });
  }
}

async function handleMuteCommand(interaction) {
  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);
  const botMember = await guild.members.fetchMe();

  if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    await safeReply(interaction, {
      content: 'You do not have permission to mute members.',
      ephemeral: true,
    });
    return;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    await safeReply(interaction, {
      content: 'I need the Moderate Members permission to do that.',
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'users') {
    const users = collectUserOptions(interaction);
    if (users.length === 0) {
      await safeReply(interaction, {
        content: 'Please specify at least one user to mute.',
        ephemeral: true,
      });
      return;
    }

    const minutes = interaction.options.getInteger('minutes');
    const reasonInput = interaction.options.getString('reason');
    const reason = buildReason(reasonInput, interaction.user.tag);
    const durationMs = minutes * 60 * 1000;

    const results = { muted: [], failed: [] };
    for (const user of users) {
      try {
        const target = await guild.members.fetch(user.id);
        if (!target.moderatable) {
          results.failed.push(user.id);
          continue;
        }
        await target.timeout(durationMs, reason);
        results.muted.push(user.id);
        await trySendDm(
          interaction.client,
          user.id,
          `You have been muted in 20t for ${formatDuration(minutes)}. Reason: ${
            reasonInput || 'No reason provided.'
          }`,
        );
      } catch (error) {
        console.error('Failed to mute user:', error);
        results.failed.push(user.id);
      }
    }

    await safeReply(interaction, {
      content: `Muted ${results.muted.length} user(s).${
        results.failed.length > 0
          ? ` Failed: ${results.failed.map((id) => `<@${id}>`).join(', ')}`
          : ''
      }`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === 'all') {
    if (!isModerator(member)) {
      await safeReply(interaction, {
        content: 'Only moderators can request a server-wide mute.',
        ephemeral: true,
      });
      return;
    }

    const minutes = interaction.options.getInteger('minutes');
    const reasonInput = interaction.options.getString('reason');
    const actionId = `muteall_${Date.now()}_${interaction.user.id}`;
    const approvals = [interaction.user.id];

    saveAction(actionId, {
      type: 'mute_all',
      requestedBy: interaction.user.id,
      minutes,
      reason: reasonInput || '',
      approvals,
      createdAt: new Date().toISOString(),
      status: 'pending',
    });

    const embed = new EmbedBuilder()
      .setTitle('Mute All Request')
      .setColor(0xfacc15)
      .setDescription(
        [
          `Requested by <@${interaction.user.id}>`,
          `Duration: ${formatDuration(minutes)}`,
          `Reason: ${reasonInput || 'No reason provided.'}`,
          '',
          `Approvals: ${approvals.length}/3`,
        ].join('\n'),
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${MUTE_ALL_APPROVE_PREFIX}${actionId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${MUTE_ALL_DENY_PREFIX}${actionId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger),
    );

    const approvalMessage = await interaction.channel.send({
      embeds: [embed],
      components: [row],
    });

    updateAction(actionId, { messageId: approvalMessage.id });

    await safeReply(interaction, {
      content: 'Approval request sent. Waiting for 3 moderator approvals.',
      ephemeral: true,
    });
  }
}

async function handleUnmuteCommand(interaction) {
  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);
  const botMember = await guild.members.fetchMe();

  if (!member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    await safeReply(interaction, {
      content: 'You do not have permission to unmute members.',
      ephemeral: true,
    });
    return;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    await safeReply(interaction, {
      content: 'I need the Moderate Members permission to do that.',
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'users') {
    const users = collectUserOptions(interaction);
    if (users.length === 0) {
      await safeReply(interaction, {
        content: 'Please specify at least one user to unmute.',
        ephemeral: true,
      });
      return;
    }

    const reasonInput = interaction.options.getString('reason');
    const reason = buildReason(reasonInput, interaction.user.tag);
    const results = { unmuted: [], failed: [] };

    for (const user of users) {
      try {
        const target = await guild.members.fetch(user.id);
        if (!target.moderatable) {
          results.failed.push(user.id);
          continue;
        }
        await target.timeout(null, reason);
        results.unmuted.push(user.id);
        await trySendDm(
          interaction.client,
          user.id,
          `You have been unmuted in 20t. Reason: ${
            reasonInput || 'No reason provided.'
          }`,
        );
      } catch (error) {
        console.error('Failed to unmute user:', error);
        results.failed.push(user.id);
      }
    }

    await safeReply(interaction, {
      content: `Unmuted ${results.unmuted.length} user(s).${
        results.failed.length > 0
          ? ` Failed: ${results.failed.map((id) => `<@${id}>`).join(', ')}`
          : ''
      }`,
      ephemeral: true,
    });
    return;
  }

  if (subcommand === 'all') {
    if (!isModerator(member)) {
      await safeReply(interaction, {
        content: 'Only moderators can request a server-wide unmute.',
        ephemeral: true,
      });
      return;
    }

    const reasonInput = interaction.options.getString('reason');
    const reason = buildReason(reasonInput, interaction.user.tag);
    const results = await unmuteAllMembers(
      guild,
      reason,
      interaction.client,
    );

    await safeReply(interaction, {
      content: `Unmuted ${results.unmuted} user(s). Skipped: ${results.skipped}. Failed: ${results.failed}.`,
      ephemeral: true,
    });
  }
}

async function handlePurgeCommand(interaction) {
  if (!interaction.channel || !interaction.channel.isTextBased()) {
    await safeReply(interaction, {
      content: 'This command can only be used in text channels.',
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);
  const botMember = await guild.members.fetchMe();

  if (!member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await safeReply(interaction, {
      content: 'You do not have permission to purge messages.',
      ephemeral: true,
    });
    return;
  }

  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    await safeReply(interaction, {
      content: 'I need the Manage Messages permission to do that.',
      ephemeral: true,
    });
    return;
  }

  const count = interaction.options.getInteger('count');
  const targetUser = interaction.options.getUser('user');
  const channel = interaction.channel;

  let messages = await channel.messages.fetch({ limit: 100 });
  if (targetUser) {
    messages = messages.filter((msg) => msg.author.id === targetUser.id);
  }

  const toDelete = messages.first(count);
  if (!toDelete || toDelete.length === 0) {
    await safeReply(interaction, {
      content: 'No messages found to delete.',
      ephemeral: true,
    });
    return;
  }

  try {
    const deleted = await channel.bulkDelete(toDelete, true);
    await safeReply(interaction, {
      content: `Deleted ${deleted.size} message(s).`,
      ephemeral: true,
    });
  } catch (error) {
    console.error('Failed to purge messages:', error);
    await safeReply(interaction, {
      content:
        'Failed to delete messages. Messages older than 14 days cannot be bulk deleted.',
      ephemeral: true,
    });
  }
}

async function handleBanButtons(interaction) {
  const { customId } = interaction;
  const isBanConfirm = customId.startsWith(BAN_CONFIRM_PREFIX);
  const isBanCancel = customId.startsWith(BAN_CANCEL_PREFIX);

  if (!isBanConfirm && !isBanCancel) {
    return false;
  }

  const actionId = isBanConfirm
    ? customId.slice(BAN_CONFIRM_PREFIX.length)
    : customId.slice(BAN_CANCEL_PREFIX.length);
  const action = getAction(actionId);

  if (!action || action.type !== 'ban') {
    await safeReply(interaction, {
      content: 'This ban request is no longer available.',
      ephemeral: true,
    });
    return true;
  }

  if (action.requestedBy !== interaction.user.id) {
    await safeReply(interaction, {
      content: 'Only the request creator can confirm this ban.',
      ephemeral: true,
    });
    return true;
  }

  if (action.status !== 'pending') {
    await safeReply(interaction, {
      content: `This ban request is already ${action.status}.`,
      ephemeral: true,
    });
    return true;
  }

  if (isBanCancel) {
    updateAction(actionId, {
      status: 'cancelled',
      decidedAt: new Date().toISOString(),
      decidedBy: interaction.user.id,
    });

    const embed = new EmbedBuilder()
      .setTitle('Ban Cancelled')
      .setColor(0x9ca3af)
      .setDescription('This ban request was cancelled.');

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${BAN_CONFIRM_PREFIX}${actionId}`)
        .setLabel('Confirm Ban')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`${BAN_CANCEL_PREFIX}${actionId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );

    await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
    await safeReply(interaction, {
      content: 'Ban request cancelled.',
      ephemeral: true,
    });
    return true;
  }

  const guild = interaction.guild;
  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
    await safeReply(interaction, {
      content: 'I need the Ban Members permission to do that.',
      ephemeral: true,
    });
    return true;
  }

  const reason = buildReason(action.reason, interaction.user.tag);
  const results = { banned: [], failed: [] };

  for (const userId of action.userIds) {
    try {
      await guild.members.ban(userId, { reason });
      results.banned.push(userId);
      await trySendDm(
        interaction.client,
        userId,
        `You have been banned from 20t. Reason: ${
          action.reason || 'No reason provided.'
        }`,
      );
    } catch (error) {
      console.error('Failed to ban user:', error);
      results.failed.push(userId);
    }
  }

  updateAction(actionId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    completedBy: interaction.user.id,
  });

  const embed = new EmbedBuilder()
    .setTitle('Ban Completed')
    .setColor(0xef4444)
    .setDescription(
      [
        `Banned: ${results.banned.length}`,
        results.failed.length > 0
          ? `Failed: ${results.failed.map((id) => `<@${id}>`).join(', ')}`
          : 'Failed: 0',
      ].join('\n'),
    );

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BAN_CONFIRM_PREFIX}${actionId}`)
      .setLabel('Confirm Ban')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${BAN_CANCEL_PREFIX}${actionId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );

  await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
  await safeReply(interaction, {
    content: `Ban complete. Banned ${results.banned.length} user(s).`,
    ephemeral: true,
  });
  return true;
}

async function handleMuteAllButtons(interaction) {
  const { customId } = interaction;
  const isMuteAllApprove = customId.startsWith(MUTE_ALL_APPROVE_PREFIX);
  const isMuteAllDeny = customId.startsWith(MUTE_ALL_DENY_PREFIX);

  if (!isMuteAllApprove && !isMuteAllDeny) {
    return false;
  }

  const actionId = isMuteAllApprove
    ? customId.slice(MUTE_ALL_APPROVE_PREFIX.length)
    : customId.slice(MUTE_ALL_DENY_PREFIX.length);
  const action = getAction(actionId);

  if (!action || action.type !== 'mute_all') {
    await safeReply(interaction, {
      content: 'This mute request is no longer available.',
      ephemeral: true,
    });
    return true;
  }

  if (action.status !== 'pending') {
    await safeReply(interaction, {
      content: `This mute request is already ${action.status}.`,
      ephemeral: true,
    });
    return true;
  }

  const moderator = await interaction.guild.members.fetch(interaction.user.id);
  if (!isModerator(moderator)) {
    await safeReply(interaction, {
      content: 'You do not have permission to approve this request.',
      ephemeral: true,
    });
    return true;
  }

  if (isMuteAllDeny) {
    updateAction(actionId, {
      status: 'denied',
      decidedAt: new Date().toISOString(),
      decidedBy: interaction.user.id,
    });

    const embed = new EmbedBuilder()
      .setTitle('Mute All Request - Denied')
      .setColor(0xdc2626)
      .setDescription(
        [
          `Requested by <@${action.requestedBy}>`,
          `Duration: ${formatDuration(action.minutes)}`,
          `Reason: ${action.reason || 'No reason provided.'}`,
          '',
          `Denied by <@${interaction.user.id}>`,
        ].join('\n'),
      );

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${MUTE_ALL_APPROVE_PREFIX}${actionId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`${MUTE_ALL_DENY_PREFIX}${actionId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
    );

    await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
    await trySendDm(
      interaction.client,
      action.requestedBy,
      'Your mute-all request was denied.',
    );
    await safeReply(interaction, {
      content: 'Mute-all request denied.',
      ephemeral: true,
    });
    return true;
  }

  const approvals = Array.isArray(action.approvals) ? action.approvals : [];
  if (!approvals.includes(interaction.user.id)) {
    approvals.push(interaction.user.id);
  }

  updateAction(actionId, { approvals });

  const embed = new EmbedBuilder()
    .setTitle('Mute All Request')
    .setColor(0xfacc15)
    .setDescription(
      [
        `Requested by <@${action.requestedBy}>`,
        `Duration: ${formatDuration(action.minutes)}`,
        `Reason: ${action.reason || 'No reason provided.'}`,
        '',
        `Approvals: ${approvals.length}/3`,
      ].join('\n'),
    );

  if (approvals.length < 3) {
    await interaction.message.edit({ embeds: [embed] });
    await safeReply(interaction, {
      content: `Approval recorded (${approvals.length}/3).`,
      ephemeral: true,
    });
    return true;
  }

  const guild = interaction.guild;
  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
    await safeReply(interaction, {
      content: 'I need the Moderate Members permission to do that.',
      ephemeral: true,
    });
    return true;
  }

  const reason = buildReason(action.reason, interaction.user.tag);
  const results = await muteAllMembers(
    guild,
    action.minutes,
    reason,
    interaction.client,
  );

  updateAction(actionId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    completedBy: interaction.user.id,
  });

  embed
    .setColor(0x16a34a)
    .setTitle('Mute All - Completed')
    .setDescription(
      [
        `Requested by <@${action.requestedBy}>`,
        `Duration: ${formatDuration(action.minutes)}`,
        `Reason: ${action.reason || 'No reason provided.'}`,
        '',
        `Approvals: ${approvals.length}/3`,
        '',
        `Muted: ${results.muted}`,
        `Skipped: ${results.skipped}`,
        `Failed: ${results.failed}`,
      ].join('\n'),
    );

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${MUTE_ALL_APPROVE_PREFIX}${actionId}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${MUTE_ALL_DENY_PREFIX}${actionId}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
  );

  await interaction.message.edit({ embeds: [embed], components: [disabledRow] });
  await trySendDm(
    interaction.client,
    action.requestedBy,
    'Your mute-all request was approved and executed.',
  );
  await safeReply(interaction, {
    content: 'Mute-all executed.',
    ephemeral: true,
  });
  return true;
}

module.exports = {
  handleBanCommand,
  handleUnbanCommand,
  handleMuteCommand,
  handleUnmuteCommand,
  handlePurgeCommand,
  handleBanButtons,
  handleMuteAllButtons,
};

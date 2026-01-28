const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionsBitField,
} = require('discord.js');
const { GUILD_ID, ACCESS_ROLE_ID } = require('../config');
const { MODAL_ID, INPUT_ID } = require('../constants');
const { safeReply, safeDefer } = require('../utils/interaction');

async function handleVerificationButton(interaction) {
  if (!interaction.inGuild() || interaction.guildId !== GUILD_ID) {
    await safeReply(interaction, {
      content: 'This button only works in the verification server.',
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(MODAL_ID)
    .setTitle('Enter your Slack ID');

  const input = new TextInputBuilder()
    .setCustomId(INPUT_ID)
    .setLabel('Slack ID (starts with U)')
    .setPlaceholder('U123ABC456')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  await interaction.showModal(modal);
}

async function handleVerificationModal(interaction) {
  if (!interaction.inGuild() || interaction.guildId !== GUILD_ID) {
    await safeReply(interaction, {
      content: 'This form only works in the verification server.',
      ephemeral: true,
    });
    return;
  }

  await safeDefer(interaction);

  const slackId = interaction.fields.getTextInputValue(INPUT_ID).trim();
  if (!/^U[0-9A-Z]+$/i.test(slackId)) {
    await safeReply(interaction, {
      content: 'Please enter a valid Slack ID that starts with the letter U.',
      ephemeral: true,
    });
    return;
  }

  try {
    const guild = interaction.guild;
    await guild.roles.fetch();
    const botMember = await guild.members.fetchMe();

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      await safeReply(interaction, {
        content:
          'I need the Manage Roles permission to finish verification. Please ask an admin to grant it.',
        ephemeral: true,
      });
      return;
    }

    let idRole = guild.roles.cache.find((role) => role.name === slackId);

    if (!idRole) {
      idRole = await guild.roles.create({
        name: slackId,
        permissions: [],
        mentionable: false,
        reason: 'User identification role',
      });
    }

    const member = await guild.members.fetch(interaction.user.id);
    if (member.id === guild.ownerId) {
      await safeReply(interaction, {
        content:
          "You're the server owner, so I can't adjust your roles automatically. Please ask another admin to assign the verification role.",
        ephemeral: true,
      });
      return;
    }

    if (member.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) {
      await safeReply(interaction, {
        content:
          "I can't modify your roles because your highest role is above mine. Ask an admin to move my bot role higher.",
        ephemeral: true,
      });
      return;
    }

    const accessRole = guild.roles.cache.get(ACCESS_ROLE_ID);
    if (!accessRole) {
      await safeReply(interaction, {
        content:
          'The access role is missing. Please ask an admin to recreate it or update the bot config.',
        ephemeral: true,
      });
      return;
    }

    const canManageRole = (role) =>
      botMember.permissions.has(PermissionsBitField.Flags.ManageRoles) &&
      botMember.roles.highest.comparePositionTo(role) > 0;

    const blockedRoles = [idRole, accessRole].filter(
      (role) => !canManageRole(role),
    );

    if (blockedRoles.length > 0) {
      await safeReply(interaction, {
        content:
          "I can't assign one or more roles because they are above my bot role. Ask an admin to move my bot role higher in the role list.",
        ephemeral: true,
      });
      return;
    }

    const rolesToAdd = [idRole.id, accessRole.id].filter(
      (roleId) => !member.roles.cache.has(roleId),
    );

    if (rolesToAdd.length > 0) {
      await member.roles.add(rolesToAdd, 'Completed verification flow');
    }

    await safeReply(interaction, {
      content: 'You are all set. Welcome to 20t.',
      ephemeral: true,
    });
  } catch (error) {
    console.error('Verification flow failed:', error);
    await safeReply(interaction, {
      content:
        'Something went wrong while adding your roles. Please contact a server admin.',
      ephemeral: true,
    });
  }
}

module.exports = {
  handleVerificationButton,
  handleVerificationModal,
};

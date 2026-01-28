const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionsBitField,
} = require('discord.js');
const {
  GUILD_ID,
  APPLY_CHANNEL_ID,
  MOD_APPROVAL_CHANNEL_ID,
  ACCESS_ROLE_ID,
  PROJECTS_CATEGORY_ID,
} = require('../config');
const {
  APPLY_MODAL_ID,
  APPLY_PROJECT_NAME_ID,
  APPLY_PROJECT_DESC_ID,
  APPLY_PROJECT_EXTRA_ID,
  APPLY_APPROVE_PREFIX,
  APPLY_DENY_PREFIX,
} = require('../constants');
const { safeReply, safeDefer } = require('../utils/interaction');
const {
  getSlackIdRole,
  canModerateApplications,
  getProjectOwnerAllows,
} = require('../utils/permissions');
const { truncateText, slugifyProjectName } = require('../utils/text');
const {
  saveApplication,
  updateApplication,
  getApplication,
} = require('../storage/applicationsStore');

async function handleApplyCommand(interaction) {
  if (interaction.channelId !== APPLY_CHANNEL_ID) {
    await safeReply(interaction, {
      content: `Please use /apply in <#${APPLY_CHANNEL_ID}> so we keep things organized.`,
      ephemeral: true,
    });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const slackRole = getSlackIdRole(member);
  if (!slackRole) {
    await safeReply(interaction, {
      content:
        'Please complete verification first so we can link your Slack ID to your project.',
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(APPLY_MODAL_ID)
    .setTitle('Project Application for 20t');

  const nameInput = new TextInputBuilder()
    .setCustomId(APPLY_PROJECT_NAME_ID)
    .setLabel('Project name')
    .setPlaceholder('e.g. Solar Garden Monitor')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId(APPLY_PROJECT_DESC_ID)
    .setLabel('Describe your idea (full detail)')
    .setPlaceholder('What are you building, why, and how will it work?')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1800)
    .setRequired(true);

  const extraInput = new TextInputBuilder()
    .setCustomId(APPLY_PROJECT_EXTRA_ID)
    .setLabel('Extra details or links (optional)')
    .setPlaceholder('Timeline, links, teammates, inspiration, etc.')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1000)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(nameInput),
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(extraInput),
  );

  await interaction.showModal(modal);
}

async function handleApplyModal(interaction) {
  if (!interaction.inGuild() || interaction.guildId !== GUILD_ID) {
    await safeReply(interaction, {
      content: 'This form only works in the 20t server.',
      ephemeral: true,
    });
    return;
  }

  if (interaction.channelId !== APPLY_CHANNEL_ID) {
    await safeReply(interaction, {
      content: `Please submit applications in <#${APPLY_CHANNEL_ID}>.`,
      ephemeral: true,
    });
    return;
  }

  await safeDefer(interaction);

  const projectName = interaction.fields
    .getTextInputValue(APPLY_PROJECT_NAME_ID)
    .trim();
  const projectDescription = interaction.fields
    .getTextInputValue(APPLY_PROJECT_DESC_ID)
    .trim();
  const projectExtra = interaction.fields
    .getTextInputValue(APPLY_PROJECT_EXTRA_ID)
    .trim();

  if (!projectName || !projectDescription) {
    await safeReply(interaction, {
      content: 'Please provide both a project name and a full description.',
      ephemeral: true,
    });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const slackRole = getSlackIdRole(member);
  if (!slackRole) {
    await safeReply(interaction, {
      content:
        'Please complete verification first so we can link your Slack ID to your project.',
      ephemeral: true,
    });
    return;
  }

  const channelName = slugifyProjectName(projectName, interaction.user.id);
  const applicationId = `app_${Date.now()}_${interaction.user.id}`;

  const embed = new EmbedBuilder()
    .setTitle('New Project Application')
    .setColor(0x22c55e)
    .setDescription(truncateText(projectDescription, 3500))
    .addFields(
      {
        name: 'Applicant',
        value: `<@${interaction.user.id}>`,
        inline: true,
      },
      {
        name: 'Slack ID Role',
        value: slackRole.name,
        inline: true,
      },
      {
        name: 'Project Name',
        value: truncateText(projectName, 256),
      },
      {
        name: 'Proposed Channel',
        value: `#${channelName}`,
      },
    )
    .setFooter({ text: `Application ID: ${applicationId}` })
    .setTimestamp();

  if (projectExtra.length > 0) {
    embed.addFields({
      name: 'Extra Details',
      value: truncateText(projectExtra, 1024),
    });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${APPLY_APPROVE_PREFIX}${applicationId}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${APPLY_DENY_PREFIX}${applicationId}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger),
  );

  try {
    const modChannel = await interaction.guild.channels.fetch(
      MOD_APPROVAL_CHANNEL_ID,
    );
    if (!modChannel || !modChannel.isTextBased()) {
      await safeReply(interaction, {
        content:
          'The mod approval channel is missing. Please contact a server admin.',
        ephemeral: true,
      });
      return;
    }

    const modMessage = await modChannel.send({
      embeds: [embed],
      components: [row],
    });

    saveApplication(applicationId, {
      applicantId: interaction.user.id,
      slackRoleId: slackRole.id,
      slackRoleName: slackRole.name,
      projectName,
      projectDescription,
      projectExtra,
      channelName,
      requestedAt: new Date().toISOString(),
      modMessageId: modMessage.id,
      status: 'pending',
    });

    await safeReply(interaction, {
      content:
        'Thanks for sharing your idea. Your project application is now with the mods for review.',
      ephemeral: true,
    });
  } catch (error) {
    console.error('Failed to submit application:', error);
    await safeReply(interaction, {
      content:
        'Something went wrong while sending your application. Please contact a server admin.',
      ephemeral: true,
    });
  }
}

async function handleApplyDecision(interaction) {
  const { customId } = interaction;
  const isApprove = customId.startsWith(APPLY_APPROVE_PREFIX);
  const isDeny = customId.startsWith(APPLY_DENY_PREFIX);

  if (!isApprove && !isDeny) {
    return false;
  }

  if (!interaction.inGuild() || interaction.guildId !== GUILD_ID) {
    await safeReply(interaction, {
      content: 'This action only works in the 20t server.',
      ephemeral: true,
    });
    return true;
  }

  await safeDefer(interaction);

  const moderator = await interaction.guild.members.fetch(interaction.user.id);
  if (!canModerateApplications(moderator)) {
    await safeReply(interaction, {
      content: 'You do not have permission to approve applications.',
      ephemeral: true,
    });
    return true;
  }

  const applicationId = isApprove
    ? customId.slice(APPLY_APPROVE_PREFIX.length)
    : customId.slice(APPLY_DENY_PREFIX.length);
  const application = getApplication(applicationId);
  if (!application) {
    await safeReply(interaction, {
      content: 'This application is no longer available.',
      ephemeral: true,
    });
    return true;
  }

  if (application.status !== 'pending') {
    await safeReply(interaction, {
      content: `This application is already ${application.status}.`,
      ephemeral: true,
    });
    return true;
  }

  const updatedApplication = updateApplication(applicationId, {
    status: isApprove ? 'approved' : 'denied',
    decidedAt: new Date().toISOString(),
    decidedBy: interaction.user.id,
  });

  let createdChannel = null;
  if (isApprove) {
    try {
      const guild = interaction.guild;
      const existingChannel = guild.channels.cache.find(
        (channel) =>
          channel.type === ChannelType.GuildText &&
          channel.name === updatedApplication.channelName,
      );

      if (existingChannel) {
        createdChannel = existingChannel;
      } else {
        const accessRole = guild.roles.cache.get(ACCESS_ROLE_ID);
        const slackRole = guild.roles.cache.get(updatedApplication.slackRoleId);

        const permissionOverwrites = [];
        if (accessRole) {
          permissionOverwrites.push({
            id: accessRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.ReadMessageHistory,
            ],
            deny: [
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.AddReactions,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.CreatePublicThreads,
              PermissionsBitField.Flags.CreatePrivateThreads,
              PermissionsBitField.Flags.SendMessagesInThreads,
              PermissionsBitField.Flags.ManageMessages,
              PermissionsBitField.Flags.ManageThreads,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.ManageWebhooks,
              PermissionsBitField.Flags.UseApplicationCommands,
              PermissionsBitField.Flags.UseExternalEmojis,
              PermissionsBitField.Flags.UseExternalStickers,
              PermissionsBitField.Flags.MentionEveryone,
            ],
          });
        }

        if (slackRole) {
          permissionOverwrites.push({
            id: slackRole.id,
            allow: getProjectOwnerAllows(),
          });
        }

        createdChannel = await guild.channels.create({
          name: updatedApplication.channelName,
          type: ChannelType.GuildText,
          parent: PROJECTS_CATEGORY_ID,
          permissionOverwrites,
          reason: `Approved project application ${applicationId}`,
        });
      }
    } catch (error) {
      console.error('Failed to create project channel:', error);
    }
  }

  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  const statusText = isApprove ? 'Approved' : 'Denied';
  embed.setColor(isApprove ? 0x16a34a : 0xdc2626);
  embed.addFields({
    name: 'Status',
    value: `${statusText} by <@${interaction.user.id}>`,
  });

  if (isApprove) {
    embed.addFields({
      name: 'Channel',
      value: createdChannel ? `<#${createdChannel.id}>` : 'Channel creation failed.',
    });
  }

  const disabledRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${APPLY_APPROVE_PREFIX}${applicationId}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`${APPLY_DENY_PREFIX}${applicationId}`)
      .setLabel('Deny')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(true),
  );

  await interaction.message.edit({ embeds: [embed], components: [disabledRow] });

  try {
    const applicant = await interaction.client.users.fetch(
      updatedApplication.applicantId,
    );
    if (applicant) {
      const dmText = isApprove
        ? `Your project **${updatedApplication.projectName}** was approved. ${
            createdChannel ? `Your channel is <#${createdChannel.id}>.` : ''
          }`
        : `Your project **${updatedApplication.projectName}** was not approved this time.`;
      await applicant.send(dmText).catch(() => {});
    }
  } catch {
    // Ignore DM failures
  }

  await safeReply(interaction, {
    content: `Application ${statusText.toLowerCase()}.`,
    ephemeral: true,
  });

  return true;
}

module.exports = {
  handleApplyCommand,
  handleApplyModal,
  handleApplyDecision,
};

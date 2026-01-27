const fs = require('fs');
const path = require('path');
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  MessageFlags,
} = require('discord.js');

const GUILD_ID = '1465781098565992510';
const CHANNEL_ID = '1465781284541562913';
const ACCESS_ROLE_ID = '1465787951798554665';
const PROJECTS_CATEGORY_ID = '1465782067869515776';
const APPLY_CHANNEL_ID = '1465782713603854426';
const MOD_APPROVAL_CHANNEL_ID = '1465782234102632479';
const AUTO_DELETE_CHANNEL_ID = APPLY_CHANNEL_ID;

const BOT_EMBED_TITLE = 'Welcome to 20t!';
const BUTTON_ID = 'verification_done';
const MODAL_ID = 'slack_id_modal';
const INPUT_ID = 'slack_id_input';
const APPLY_COMMAND_NAME = 'apply';
const COLLAB_COMMAND_NAME = 'collab';
const APPLY_MODAL_ID = 'apply_project_modal';
const APPLY_PROJECT_NAME_ID = 'apply_project_name';
const APPLY_PROJECT_DESC_ID = 'apply_project_desc';
const APPLY_PROJECT_EXTRA_ID = 'apply_project_extra';
const APPLY_APPROVE_PREFIX = 'apply_approve:';
const APPLY_DENY_PREFIX = 'apply_deny:';

const STATE_PATH = path.join(__dirname, 'data', 'state.json');
const APPLICATIONS_PATH = path.join(__dirname, 'data', 'applications.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function readApplications() {
  try {
    return JSON.parse(fs.readFileSync(APPLICATIONS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function writeApplications(applications) {
  fs.mkdirSync(path.dirname(APPLICATIONS_PATH), { recursive: true });
  fs.writeFileSync(APPLICATIONS_PATH, JSON.stringify(applications, null, 2));
}

function saveApplication(appId, application) {
  const applications = readApplications();
  applications[appId] = application;
  writeApplications(applications);
}

function updateApplication(appId, patch) {
  const applications = readApplications();
  if (!applications[appId]) {
    return null;
  }

  applications[appId] = { ...applications[appId], ...patch };
  writeApplications(applications);
  return applications[appId];
}

function getApplication(appId) {
  const applications = readApplications();
  return applications[appId] || null;
}

function getChannelState(state) {
  return state[CHANNEL_ID] || {};
}

function setChannelState(state, messageId) {
  state[CHANNEL_ID] = { messageId };
  writeState(state);
}

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

function buildVerificationPayload() {
  const embed = new EmbedBuilder()
    .setTitle(BOT_EMBED_TITLE)
    .setColor(0x3b82f6)
    .setDescription(
      [
        "You're almost in! Complete these quick steps:",
        '',
        '1) Join Hack Club: https://hack.club/join/AJPAGQ',
        '2) Click **Done**, then join the official Slack: https://hackclub.enterprise.slack.com/archives/C0AB46SAF43',
        '3) You will be asked for your Slack ID (it starts with **U**).',
        '',
        "Thanks for jumping in - we're excited to have you!",
      ].join('\n'),
    )
    .setFooter({ text: 'Need help? Ping a mod at DM.' });

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

function truncateText(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(maxLength - 3, 0))}...`;
}

function slugifyProjectName(name, fallbackSeed) {
  const normalized = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length > 0) {
    return slug.slice(0, 95);
  }

  return `project-${fallbackSeed}`;
}

function getSlackIdRole(member) {
  return member.roles.cache.find((role) => /^U[0-9A-Z]+$/i.test(role.name));
}

function canModerateApplications(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    member.permissions.has(PermissionsBitField.Flags.ManageChannels)
  );
}

function getProjectOwnerAllows() {
  return [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.ReadMessageHistory,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.AddReactions,
    PermissionsBitField.Flags.AttachFiles,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.CreatePublicThreads,
    PermissionsBitField.Flags.CreatePrivateThreads,
    PermissionsBitField.Flags.SendMessagesInThreads,
    PermissionsBitField.Flags.ManageMessages,
    PermissionsBitField.Flags.ManageThreads,
    PermissionsBitField.Flags.UseApplicationCommands,
    PermissionsBitField.Flags.UseExternalEmojis,
    PermissionsBitField.Flags.UseExternalStickers,
  ];
}

function canUseProjectCollab(member, channel) {
  if (canModerateApplications(member)) {
    return true;
  }

  const slackRole = getSlackIdRole(member);
  if (!slackRole) {
    return false;
  }

  const channelPerms = channel.permissionsFor(member);
  return Boolean(channelPerms?.has(PermissionsBitField.Flags.SendMessages));
}

async function ensureVerificationMessage(client) {
  const state = readState();
  const channelState = getChannelState(state);

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
    setChannelState(state, sent.id);
    return;
  }

  try {
    await message.edit(payload);
  } catch (error) {
    console.warn('Failed to update verification message:', error);
  }

  if (message.id !== channelState.messageId) {
    setChannelState(state, message.id);
  }
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
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const commands = [
      new SlashCommandBuilder()
        .setName(APPLY_COMMAND_NAME)
        .setDescription('Submit a project application for 20t.'),
      new SlashCommandBuilder()
        .setName(COLLAB_COMMAND_NAME)
        .setDescription('Add a collaborator to this project channel.')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Discord user to add (uses their Slack ID role)')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('slack_id')
            .setDescription('Slack ID role to add (e.g. U123ABC456)')
            .setRequired(false),
        ),
    ].map((command) => command.toJSON());

    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
      body: commands,
    });

    await ensureVerificationMessage(client);
  } catch (error) {
    console.error('Failed to ensure verification message:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === APPLY_COMMAND_NAME) {
    if (!interaction.inGuild() || interaction.guildId !== GUILD_ID) {
      await safeReply(interaction, {
        content: 'This command only works in the 20t server.',
        ephemeral: true,
      });
      return;
    }

    if (interaction.channelId !== APPLY_CHANNEL_ID) {
      await safeReply(interaction, {
        content: `Please use /apply in <#${APPLY_CHANNEL_ID}>.`,
        ephemeral: true,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const slackRole = getSlackIdRole(member);
    if (!slackRole) {
      await safeReply(interaction, {
        content:
          'You need a Slack ID role before applying. Please complete the verification steps first.',
        ephemeral: true,
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(APPLY_MODAL_ID)
      .setTitle('Project Application');

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
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === COLLAB_COMMAND_NAME) {
    if (!interaction.inGuild() || interaction.guildId !== GUILD_ID) {
      await safeReply(interaction, {
        content: 'This command only works in the 20t server.',
        ephemeral: true,
      });
      return;
    }

    if (
      !interaction.channel ||
      interaction.channel.type !== ChannelType.GuildText ||
      interaction.channel.parentId !== PROJECTS_CATEGORY_ID
    ) {
      await safeReply(interaction, {
        content:
          'This command can only be used inside a project channel.',
        ephemeral: true,
      });
      return;
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!canUseProjectCollab(member, interaction.channel)) {
      await safeReply(interaction, {
        content:
          'You do not have permission to add collaborators to this channel.',
        ephemeral: true,
      });
      return;
    }

    const targetUser = interaction.options.getUser('user');
    const slackIdInput = interaction.options.getString('slack_id');

    if (!targetUser && !slackIdInput) {
      await safeReply(interaction, {
        content: 'Provide either a Discord user or a Slack ID.',
        ephemeral: true,
      });
      return;
    }

    const guild = interaction.guild;
    await guild.roles.fetch();
    const botMember = await guild.members.fetchMe();

    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
      await safeReply(interaction, {
        content:
          'I need the **Manage Channels** permission to add collaborators.',
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
          content:
            'That user does not have a Slack ID role yet.',
          ephemeral: true,
        });
        return;
      }
    } else {
      const cleanedSlackId = slackIdInput.trim();
      if (!/^U[0-9A-Z]+$/i.test(cleanedSlackId)) {
        await safeReply(interaction, {
          content: 'Please provide a valid Slack ID (starts with U).',
          ephemeral: true,
        });
        return;
      }

      slackRole = guild.roles.cache.find(
        (role) => role.name.toUpperCase() === cleanedSlackId.toUpperCase(),
      );
      if (!slackRole) {
        await safeReply(interaction, {
          content: 'No Slack ID role found with that ID.',
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
        content: `Collaborator added for Slack ID **${slackRole.name}**.`,
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

    return;
  }

  if (interaction.isButton() && interaction.customId === BUTTON_ID) {
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
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
    if (!interaction.inGuild() || interaction.guildId !== GUILD_ID) {
      await safeReply(interaction, {
        content: 'This form only works in the verification server.',
        ephemeral: true,
      });
      return;
    }

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
            'I need the **Manage Roles** permission to finish verification. Please ask an admin to grant it.',
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
            // One day I probably will not be more the server owner, so the message should make sense then, for the next owner :)
            "You're the server owner, so I can't adjust your roles automatically. Please ask another admin to assign the verification role.",
          ephemeral: true,
        });
        return;
      }

      if (
        member.roles.highest.comparePositionTo(botMember.roles.highest) >= 0
      ) {
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
            'I can’t assign one or more roles because they are above my bot role. Ask an admin to move my bot role higher in the role list.',
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
        content: 'Thanks! Your roles have been added.',
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

  if (interaction.isModalSubmit() && interaction.customId === APPLY_MODAL_ID) {
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
          'You need a Slack ID role before applying. Please complete the verification steps first.',
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
          'Thanks! Your project application has been sent to the mods for approval.',
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
    return;
  }

  if (interaction.isButton()) {
    const { customId } = interaction;
    const isApprove = customId.startsWith(APPLY_APPROVE_PREFIX);
    const isDeny = customId.startsWith(APPLY_DENY_PREFIX);

    if (!isApprove && !isDeny) {
      return;
    }

    if (!interaction.inGuild() || interaction.guildId !== GUILD_ID) {
      await safeReply(interaction, {
        content: 'This action only works in the 20t server.',
        ephemeral: true,
      });
      return;
    }

    const moderator = await interaction.guild.members.fetch(interaction.user.id);
    if (!canModerateApplications(moderator)) {
      await safeReply(interaction, {
        content: 'You do not have permission to approve applications.',
        ephemeral: true,
      });
      return;
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
      return;
    }

    if (application.status !== 'pending') {
      await safeReply(interaction, {
        content: `This application is already ${application.status}.`,
        ephemeral: true,
      });
      return;
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
          const slackRole = guild.roles.cache.get(
            updatedApplication.slackRoleId,
          );

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
          ? `Your project **${updatedApplication.projectName}** was approved! ${
              createdChannel ? `Your channel is <#${createdChannel.id}>.` : ''
            }`
          : `Your project **${updatedApplication.projectName}** was not approved this time.`;
        await applicant.send(dmText).catch(() => {});
      }
    } catch {
      // ignore DM failures
    }

    await safeReply(interaction, {
      content: `Application ${statusText.toLowerCase()}.`,
      ephemeral: true,
    });
  }
});

client.on('messageCreate', async (message) => {
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
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}

client.login(token);

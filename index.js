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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField,
  MessageFlags,
} = require('discord.js');

const GUILD_ID = '1465781098565992510';
const CHANNEL_ID = '1465781284541562913';
const ACCESS_ROLE_ID = '1465787951798554665';

const BOT_EMBED_TITLE = 'Welcome to 20t!';
const BUTTON_ID = 'verification_done';
const MODAL_ID = 'slack_id_modal';
const INPUT_ID = 'slack_id_input';

const STATE_PATH = path.join(__dirname, 'data', 'state.json');

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
    await ensureVerificationMessage(client);
  } catch (error) {
    console.error('Failed to ensure verification message:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
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
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('Missing DISCORD_TOKEN environment variable.');
  process.exit(1);
}

client.login(token);

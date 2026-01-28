const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const { PROJECTS_WEBHOOK_URL } = require('../config');
const {
  POST_MODAL_ID,
  POST_TITLE_ID,
  POST_SUMMARY_ID,
  POST_LINK_ID,
  POST_REPO_ID,
} = require('../constants');
const { safeReply } = require('../utils/interaction');
const { isProjectChannel, canUseProjectCollab, isModerator, getSlackIdRole } = require('../utils/permissions');
const { saveProject } = require('../storage/projectsStore');
const { trySendDm } = require('../utils/moderation');

async function handlePostCommand(interaction) {
  if (!isProjectChannel(interaction.channel)) {
    await safeReply(interaction, {
      content: 'This command can only be used inside a project channel.',
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);
  if (!canUseProjectCollab(member, interaction.channel) && !isModerator(member)) {
    await safeReply(interaction, {
      content: 'You do not have permission to publish this project.',
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(POST_MODAL_ID)
    .setTitle('Publish Project to the 20t Showcase');

  const titleInput = new TextInputBuilder()
    .setCustomId(POST_TITLE_ID)
    .setLabel('Project title')
    .setPlaceholder('Short, clear name for the website')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(80)
    .setRequired(true);

  const summaryInput = new TextInputBuilder()
    .setCustomId(POST_SUMMARY_ID)
    .setLabel('Project summary')
    .setPlaceholder('What is it, what does it do, and why is it cool?')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(1500)
    .setRequired(true);

  const linkInput = new TextInputBuilder()
    .setCustomId(POST_LINK_ID)
    .setLabel('Project link')
    .setPlaceholder('Demo, website, or video link')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(200)
    .setRequired(true);

  const repoInput = new TextInputBuilder()
    .setCustomId(POST_REPO_ID)
    .setLabel('Repository link (optional)')
    .setPlaceholder('GitHub / GitLab link')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(200)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(summaryInput),
    new ActionRowBuilder().addComponents(linkInput),
    new ActionRowBuilder().addComponents(repoInput),
  );

  await interaction.showModal(modal);
}

async function handlePostModal(interaction) {
  if (!interaction.inGuild()) {
    await safeReply(interaction, {
      content: 'This form only works in the 20t server.',
      ephemeral: true,
    });
    return;
  }

  if (!isProjectChannel(interaction.channel)) {
    await safeReply(interaction, {
      content: 'This form can only be used inside a project channel.',
      ephemeral: true,
    });
    return;
  }

  const title = interaction.fields.getTextInputValue(POST_TITLE_ID).trim();
  const summary = interaction.fields.getTextInputValue(POST_SUMMARY_ID).trim();
  const link = interaction.fields.getTextInputValue(POST_LINK_ID).trim();
  const repo = interaction.fields.getTextInputValue(POST_REPO_ID).trim();

  if (!title || !summary || !link) {
    await safeReply(interaction, {
      content: 'Please provide a title, summary, and link.',
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  const member = await guild.members.fetch(interaction.user.id);
  if (!canUseProjectCollab(member, interaction.channel) && !isModerator(member)) {
    await safeReply(interaction, {
      content: 'You do not have permission to publish this project.',
      ephemeral: true,
    });
    return;
  }

  const slackRole = getSlackIdRole(member);
  const projectId = `project_${Date.now()}_${interaction.user.id}`;
  const payload = {
    id: projectId,
    title,
    summary,
    link,
    repo: repo || null,
    channelId: interaction.channel.id,
    channelName: interaction.channel.name,
    slackRoleId: slackRole ? slackRole.id : null,
    slackRoleName: slackRole ? slackRole.name : null,
    postedBy: interaction.user.id,
    postedAt: new Date().toISOString(),
  };

  saveProject(projectId, payload);

  let webhookStatus = 'not_configured';
  if (PROJECTS_WEBHOOK_URL) {
    try {
      if (typeof fetch !== 'function') {
        webhookStatus = 'failed';
      } else {
        const response = await fetch(PROJECTS_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        webhookStatus = response.ok ? 'success' : 'failed';
      }
    } catch (error) {
      console.error('Failed to post project webhook:', error);
      webhookStatus = 'failed';
    }
  }

  const responseText =
    webhookStatus === 'success'
      ? 'Project published and synced to the website. Great work.'
      : webhookStatus === 'failed'
        ? 'Project saved locally, but website sync failed. Please contact a mod.'
        : 'Project saved locally. Website sync is not configured yet.';

  await safeReply(interaction, {
    content: responseText,
    ephemeral: true,
  });

  await trySendDm(
    interaction.client,
    interaction.user.id,
    `Your project **${title}** was published. ${responseText}`,
  );
}

module.exports = {
  handlePostCommand,
  handlePostModal,
};

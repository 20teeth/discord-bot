const { PermissionsBitField, ChannelType } = require('discord.js');
const {
  ACCESS_ROLE_ID,
  PROJECTS_CATEGORY_ID,
  MOD_ROLE_IDS,
} = require('../config');

function getSlackIdRole(member) {
  return member.roles.cache.find((role) => /^U[0-9A-Z]+$/i.test(role.name));
}

function hasAccessRole(member) {
  return member.roles.cache.has(ACCESS_ROLE_ID);
}

function canModerateApplications(member) {
  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    member.permissions.has(PermissionsBitField.Flags.ManageChannels)
  );
}

function isModerator(member) {
  if (MOD_ROLE_IDS.some((roleId) => member.roles.cache.has(roleId))) {
    return true;
  }

  return (
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
    member.permissions.has(PermissionsBitField.Flags.ModerateMembers)
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

function isProjectChannel(channel) {
  return (
    channel &&
    channel.type === ChannelType.GuildText &&
    channel.parentId === PROJECTS_CATEGORY_ID
  );
}

module.exports = {
  getSlackIdRole,
  hasAccessRole,
  canModerateApplications,
  isModerator,
  getProjectOwnerAllows,
  canUseProjectCollab,
  isProjectChannel,
};

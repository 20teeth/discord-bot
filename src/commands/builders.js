const { SlashCommandBuilder } = require('discord.js');
const {
  APPLY_COMMAND_NAME,
  COLLAB_COMMAND_NAME,
  BAN_COMMAND_NAME,
  UNBAN_COMMAND_NAME,
  MUTE_COMMAND_NAME,
  UNMUTE_COMMAND_NAME,
  PURGE_COMMAND_NAME,
  POST_COMMAND_NAME,
} = require('../constants');

function buildCommands() {
  return [
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
    new SlashCommandBuilder()
      .setName(BAN_COMMAND_NAME)
      .setDescription('Ban up to 5 users (with confirmation).')
      .addUserOption((option) =>
        option.setName('user1').setDescription('User to ban').setRequired(true),
      )
      .addUserOption((option) =>
        option.setName('user2').setDescription('Another user to ban'),
      )
      .addUserOption((option) =>
        option.setName('user3').setDescription('Another user to ban'),
      )
      .addUserOption((option) =>
        option.setName('user4').setDescription('Another user to ban'),
      )
      .addUserOption((option) =>
        option.setName('user5').setDescription('Another user to ban'),
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Reason for the ban')
          .setRequired(false),
      ),
    new SlashCommandBuilder()
      .setName(UNBAN_COMMAND_NAME)
      .setDescription('Unban a user by ID.')
      .addStringOption((option) =>
        option
          .setName('user_id')
          .setDescription('User ID to unban')
          .setRequired(true),
      )
      .addStringOption((option) =>
        option
          .setName('reason')
          .setDescription('Reason for the unban')
          .setRequired(false),
      ),
    new SlashCommandBuilder()
      .setName(MUTE_COMMAND_NAME)
      .setDescription('Mute users or everyone (requires approvals).')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('users')
          .setDescription('Mute up to 5 users.')
          .addIntegerOption((option) =>
            option
              .setName('minutes')
              .setDescription('Mute duration in minutes (max 40320)')
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(40320),
          )
          .addUserOption((option) =>
            option
              .setName('user1')
              .setDescription('User to mute')
              .setRequired(true),
          )
          .addUserOption((option) =>
            option.setName('user2').setDescription('Another user to mute'),
          )
          .addUserOption((option) =>
            option.setName('user3').setDescription('Another user to mute'),
          )
          .addUserOption((option) =>
            option.setName('user4').setDescription('Another user to mute'),
          )
          .addUserOption((option) =>
            option.setName('user5').setDescription('Another user to mute'),
          )
          .addStringOption((option) =>
            option
              .setName('reason')
              .setDescription('Reason for the mute')
              .setRequired(false),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('all')
          .setDescription('Mute everyone (requires 3 moderator approvals).')
          .addIntegerOption((option) =>
            option
              .setName('minutes')
              .setDescription('Mute duration in minutes (max 40320)')
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(40320),
          )
          .addStringOption((option) =>
            option
              .setName('reason')
              .setDescription('Reason for the mute-all')
              .setRequired(false),
          ),
      ),
    new SlashCommandBuilder()
      .setName(UNMUTE_COMMAND_NAME)
      .setDescription('Unmute users or everyone.')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('users')
          .setDescription('Unmute up to 5 users.')
          .addUserOption((option) =>
            option
              .setName('user1')
              .setDescription('User to unmute')
              .setRequired(true),
          )
          .addUserOption((option) =>
            option.setName('user2').setDescription('Another user to unmute'),
          )
          .addUserOption((option) =>
            option.setName('user3').setDescription('Another user to unmute'),
          )
          .addUserOption((option) =>
            option.setName('user4').setDescription('Another user to unmute'),
          )
          .addUserOption((option) =>
            option.setName('user5').setDescription('Another user to unmute'),
          )
          .addStringOption((option) =>
            option
              .setName('reason')
              .setDescription('Reason for the unmute')
              .setRequired(false),
          ),
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('all')
          .setDescription('Unmute everyone.')
          .addStringOption((option) =>
            option
              .setName('reason')
              .setDescription('Reason for the unmute-all')
              .setRequired(false),
          ),
      ),
    new SlashCommandBuilder()
      .setName(PURGE_COMMAND_NAME)
      .setDescription('Delete messages in this channel.')
      .addIntegerOption((option) =>
        option
          .setName('count')
          .setDescription('How many messages to delete (1-100)')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(100),
      )
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('Only delete messages from this user')
          .setRequired(false),
      ),
    new SlashCommandBuilder()
      .setName(POST_COMMAND_NAME)
      .setDescription('Publish this project to the website.'),
  ];
}

module.exports = {
  buildCommands,
};

const { REST, Routes } = require('discord.js');
const { GUILD_ID, DISCORD_TOKEN } = require('../config');
const { buildCommands } = require('../commands/builders');

async function registerCommands(client) {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  const commands = buildCommands().map((command) => command.toJSON());

  await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
    body: commands,
  });
}

module.exports = {
  registerCommands,
};

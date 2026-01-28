const { formatDuration } = require('./text');

async function trySendDm(client, userId, message) {
  try {
    const user = await client.users.fetch(userId);
    if (user) {
      await user.send(message);
    }
  } catch {
    // Ignore DM failures
  }
}

function buildReason(reason, moderatorTag) {
  if (reason && reason.trim().length > 0) {
    return `${reason.trim()} (by ${moderatorTag})`;
  }
  return `No reason provided. (by ${moderatorTag})`;
}

async function muteAllMembers(guild, minutes, reason, client) {
  const durationMs = minutes * 60 * 1000;
  const members = await guild.members.fetch();
  const results = { muted: 0, skipped: 0, failed: 0 };

  for (const member of members.values()) {
    if (member.user.bot) {
      results.skipped += 1;
      continue;
    }
    if (!member.moderatable) {
      results.skipped += 1;
      continue;
    }
    try {
      await member.timeout(durationMs, reason);
      results.muted += 1;
      await trySendDm(
        client,
        member.id,
        `You have been muted in 20t for ${formatDuration(minutes)}. Reason: ${
          reason || 'No reason provided.'
        }`,
      );
    } catch (error) {
      console.error('Failed to mute member:', error);
      results.failed += 1;
    }
  }

  return results;
}

async function unmuteAllMembers(guild, reason, client) {
  const members = await guild.members.fetch();
  const results = { unmuted: 0, skipped: 0, failed: 0 };

  for (const member of members.values()) {
    if (member.user.bot) {
      results.skipped += 1;
      continue;
    }
    if (!member.moderatable) {
      results.skipped += 1;
      continue;
    }

    const isMuted =
      typeof member.isCommunicationDisabled === 'function'
        ? member.isCommunicationDisabled()
        : Boolean(
            member.communicationDisabledUntilTimestamp &&
              member.communicationDisabledUntilTimestamp > Date.now(),
          );

    if (!isMuted) {
      results.skipped += 1;
      continue;
    }

    try {
      await member.timeout(null, reason);
      results.unmuted += 1;
      await trySendDm(
        client,
        member.id,
        `You have been unmuted in 20t. Reason: ${reason || 'No reason provided.'}`,
      );
    } catch (error) {
      console.error('Failed to unmute member:', error);
      results.failed += 1;
    }
  }

  return results;
}

module.exports = {
  trySendDm,
  buildReason,
  muteAllMembers,
  unmuteAllMembers,
};

# 20t Discord Bot

A custom Discord bot for 20t with verification, project applications, moderation, and project publishing.

## Setup

1) Install dependencies:
```
npm install
```

2) Create your `.env` file:
```
DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE
PROJECTS_WEBHOOK_URL=
```

3) Start the bot:
```
npm start
```

## Required Permissions

Give the bot role these permissions in the server (and above target roles in the hierarchy):

- View Channels
- Send Messages
- Embed Links
- Use Application Commands
- Manage Roles
- Manage Channels
- Manage Messages
- Moderate Members
- Ban Members

## Commands

### Verification and Projects

- `/apply` (channel: `1465782713603854426`)
  - Opens a modal to submit a project idea.
  - Sends approval request to `1465782234102632479`.

- `/collab` (only inside Projects category `1465782067869515776`)
  - Adds a collaborator by Discord user or Slack ID role.

- `/post` (only inside Projects category `1465782067869515776`)
  - Publishes a project to the website via `PROJECTS_WEBHOOK_URL` if configured.
  - Stores a local copy in `data/projects.json`.

### Moderation

- `/ban` (up to 5 users, with confirmation)
- `/unban` (by user ID)
- `/mute users` (up to 5 users, timeout in minutes)
- `/mute all` (requires 3 moderator approvals)
- `/unmute users` (up to 5 users)
- `/unmute all` (unmute everyone; moderator only)
- `/purge` (bulk delete messages)

## Command Access Rules

- All slash commands must be run inside the 20t server (DMs are blocked).
- Users must have the access role `1465787951798554665` to use any command.

## Moderator Approvals

For `/mute all`, the bot requires approvals from **3 moderators**. Moderators are determined by:

- Role ID `1465827501745115271`, or
- Discord permissions: Administrator, Manage Guild, or Moderate Members

## Data Files

The bot stores state in `data/`:

- `state.json`: verification message ID
- `applications.json`: project applications
- `actions.json`: moderation confirmations and approvals
- `projects.json`: published projects (local cache)

## Notes

- The bot avoids log channels by design; notifications go through DMs and ephemeral replies.
- Make sure the bot role is above the Slack ID roles and access role in the hierarchy.

## Docs

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`

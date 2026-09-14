import 'dotenv/config';
import express from 'express';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKeyMiddleware,
} from 'discord-interactions';
import { getRandomEmoji, DiscordRequest } from './utils.js';
import { getShuffledOptions, getResult } from './game.js';

const app = express();
const PORT = process.env.PORT || 3000;
const activeGames = {};

app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async function (req, res) {
  const { id, type, data } = req.body;

  // ─── PING ────────────────────────────────────────────────────────────────
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  // ─── SLASH COMMANDS ───────────────────────────────────────────────────────
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // /test
    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `hello world ${getRandomEmoji()}`,
            },
          ],
        },
      });
    }

    // /challenge
    if (name === 'challenge' && id) {
      const context = req.body.context;
      const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
      const objectName = data.options[0].value;

      activeGames[id] = { id: userId, objectName };

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `Rock paper scissors challenge from <@${userId}>`,
            },
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.BUTTON,
                  custom_id: `accept_button_${id}`,
                  label: 'Accept',
                  style: ButtonStyleTypes.PRIMARY,
                },
              ],
            },
          ],
        },
      });
    }

    // /create-team-channel
    if (name === 'create-team-channel') {
      const channelName = data.options.find(o => o.name === 'channel_name').value;
      const guildId = req.body.guild_id;

      // Collect all mentioned users from person_1, person_2, etc.
      const userIds = data.options
        .filter(o => o.name.startsWith('person_'))
        .map(o => o.value);

      // Always include the command runner
      const context = req.body.context;
      const commandUserId = context === 0 ? req.body.member.user.id : req.body.user.id;
      if (!userIds.includes(commandUserId)) {
        userIds.push(commandUserId);
      }

      try {
        // Find the "Teams" category
        const channelsRes = await DiscordRequest(`guilds/${guildId}/channels`, { method: 'GET' });
        const channels = await channelsRes.json();

        const teamsCategory = channels.find(
          (c) => c.type === 4 && c.name.toLowerCase() === 'teams'
        );

        if (!teamsCategory) {
          return res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: '❌ No category named **Teams** found. Please create it first.',
              flags: InteractionResponseFlags.EPHEMERAL,
            },
          });
        }

        // Permission bits: VIEW_CHANNEL + SEND_MESSAGES + READ_MESSAGE_HISTORY
        const allowBits = (1024n | 2048n | 65536n).toString();

        const permissionOverwrites = [
          {
            id: guildId,  // @everyone role ID = guild ID
            type: 0,      // role
            deny: '1024', // deny VIEW_CHANNEL
          },
          ...userIds.map(userId => ({
            id: userId,
            type: 1,          // member
            allow: allowBits,
          })),
        ];

        // Create the channel
        await DiscordRequest(`guilds/${guildId}/channels`, {
          method: 'POST',
          body: {
            name: channelName,
            type: 0,
            parent_id: teamsCategory.id,
            permission_overwrites: permissionOverwrites,
          },
        });

        const mentionList = userIds.map(uid => `<@${uid}>`).join(', ');

        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✅ Channel **#${channelName}** created under **Teams**!\n👥 Added: ${mentionList}`,
          },
        });

      } catch (err) {
        console.error('Error creating channel:', err);
        return res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: '❌ Failed to create channel. Check the bot has **Manage Channels** and **Manage Roles** permissions.',
            flags: InteractionResponseFlags.EPHEMERAL,
          },
        });
      }
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  // ─── MESSAGE COMPONENTS ───────────────────────────────────────────────────
  if (type === InteractionType.MESSAGE_COMPONENT) {
    const componentId = data.custom_id;

    // Accept button
    if (componentId.startsWith('accept_button_')) {
      const gameId = componentId.replace('accept_button_', '');
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;

      try {
        await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            flags: InteractionResponseFlags.EPHEMERAL,
            content: 'What is your object of choice?',
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.STRING_SELECT,
                    custom_id: `select_choice_${gameId}`,
                    options: getShuffledOptions(),
                  },
                ],
              },
            ],
          },
        });
        await DiscordRequest(endpoint, { method: 'DELETE' });
      } catch (err) {
        console.error('Error sending message:', err);
      }
      return;
    }

    // Select choice
    if (componentId.startsWith('select_choice_')) {
      const gameId = componentId.replace('select_choice_', '');

      if (activeGames[gameId]) {
        const context = req.body.context;
        const userId = context === 0 ? req.body.member.user.id : req.body.user.id;
        const objectName = data.values[0];

        const resultStr = getResult(activeGames[gameId], { id: userId, objectName });
        delete activeGames[gameId];

        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;

        try {
          await res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: resultStr },
          });
          await DiscordRequest(endpoint, {
            method: 'PATCH',
            body: { content: `Nice choice! ${getRandomEmoji()}` },
          });
        } catch (err) {
          console.error('Error sending result:', err);
        }
      }
      return;
    }
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});

app.listen(PORT, () => {
  console.log('Listening on port', PORT);
});
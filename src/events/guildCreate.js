/**
 * src/events/guildCreate.js
 *
 * Fires when the bot is added to a new server.
 * Initialises guild config and sends a setup-guide embed.
 */

import { ChannelType, PermissionFlagsBits } from 'discord.js'
import { initGuildConfig } from '../storage/cache.js'

export const name = 'guildCreate'
export const once = false

export async function execute(guild) {
  // Step 1 — Announce and initialise
  console.log(`[guild] Bot added to new guild: ${guild.name} (${guild.id})`)

  try {
    await initGuildConfig(guild.id)
    console.log(`[guild] Initialized config for: ${guild.name}`)
  } catch (err) {
    console.error(`[guild] Failed to initialize config for ${guild.name}: ${err.message}`)
  }

  // Step 2 — Find a channel we can talk in
  let targetChannel = null

  try {
    if (guild.systemChannel) {
      targetChannel = guild.systemChannel
    } else {
      const me = guild.members.me
      for (const [, channel] of guild.channels.cache) {
        if (channel.type !== ChannelType.GuildText) continue
        if (me && !channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) continue
        targetChannel = channel
        break
      }
    }
  } catch (err) {
    console.error(`[guild] Failed to locate a text channel in ${guild.name}: ${err.message}`)
  }

  // Step 3 — Send the setup-guide embed
  if (!targetChannel) {
    console.log(`[guild] Could not send setup guide to ${guild.name}`)
    return
  }

  try {
    await targetChannel.send({
      embeds: [
        {
          color: 0x5865F2,
          title: 'Thanks for adding me!',
          description:
            "I'm your new welcome bot. Here's how to get started:\n\n" +
            'Use **/setup channels** to set your welcome and leave channels.\n' +
            'Use **/welcome background** to pick a card style.\n' +
            'Use **/preview** to see how your welcome card looks.\n\n' +
            'If you need help, use **/help**.',
          footer: { text: 'Archy Welcomer' },
        },
      ],
    })
  } catch {
    console.log(`[guild] Could not send setup guide to ${guild.name}`)
  }
}
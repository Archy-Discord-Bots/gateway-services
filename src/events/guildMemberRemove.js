/**
 * src/events/guildMemberRemove.js
 *
 * Fires when a member leaves (or is kicked/banned from) a guild.
 */

import {
  loadGuildConfig,
  getMemberData,
  setMemberData,
} from '../storage/cache.js'
import { parseTemplate } from '../utils/templateParser.js'
import { generateLeaveCard } from '../canvas/leaveCard.js'
import { AttachmentBuilder } from 'discord.js'

export const name = 'guildMemberRemove'
export const once = false

export async function execute(member) {
  const { guild, user } = member

  // STEP 1 — Load guild config
  let config
  try {
    config = await loadGuildConfig(guild.id)
    if (!config) {
      console.warn(`[leave] No config found for guild ${guild.id}, skipping`)
      return
    }
  } catch (err) {
    console.error(`[leave] Step 1 failed (load config): ${err.message}`)
    return
  }

  // STEP 2 — Update member record
  try {
    const record = await getMemberData(guild.id, user.id)
    if (record) {
      record.leftAt = new Date().toISOString()
      await setMemberData(guild.id, user.id, record)
    } else {
      console.log(
        `[leave] No member record found for ${user.username}, skipping`
      )
    }
  } catch (err) {
    console.error(`[leave] Step 2 failed (update member record): ${err.message}`)
  }

  // STEP 3 — Send leave channel message
  try {
    if (!config.leaveChannelId) return

    const channel = guild.channels.cache.get(config.leaveChannelId)
    if (!channel) {
      console.warn(
        `[leave] Leave channel ${config.leaveChannelId} not found in guild ${guild.name}`
      )
      return
    }

    const parsed = parseTemplate(config.leaveMessage, {
      user: user.username,
      server: guild.name,
      count: guild.memberCount.toString(),
    })

    let attachment
    try {
      const buffer = await generateLeaveCard(member, config)
      attachment = new AttachmentBuilder(buffer, { name: 'leave.png' })
    } catch (cardErr) {
      console.error(`[leave] Card generation failed, falling back to plain text: ${cardErr.message}`)
    }

    if (attachment) {
      await channel.send({ content: parsed, files: [attachment] })
    } else {
      await channel.send(parsed)
    }

    console.log(
      `[leave] Posted leave message for ${user.username} in ${guild.name}`
    )
  } catch (err) {
    console.error(`[leave] Step 3 failed (leave channel message): ${err.message}`)
  }
}
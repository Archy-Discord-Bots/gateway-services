import { AttachmentBuilder } from 'discord.js'
import {
  loadGuildConfig,
  getMemberData,
  initMemberData,
  setMemberData,
} from '../storage/cache.js'
import { parseTemplate } from '../utils/templateParser.js'
import { generateWelcomeCard } from '../canvas/welcomeCard.js'

export const name = 'guildMemberAdd'
export const once = false

export async function execute(member) {
  const { guild, user } = member
  const guildId = guild.id
  const userId = user.id
  const username = user.username

  // STEP 1 — Load guild config
  let config
  try {
    config = await loadGuildConfig(guildId)
    if (!config) {
      console.warn(`[guildMemberAdd] No config found for guild ${guildId}, skipping`)
      return
    }
  } catch (err) {
    console.error(`[guildMemberAdd] Step 1 failed (load config): ${err.message}`)
    return
  }

  // STEP 2 — Create or update member profile
  let memberData
  try {
    const existing = await getMemberData(guildId, userId)
    if (existing) {
      existing.joinCount += 1
      existing.joinedAt = new Date().toISOString()
      existing.leftAt = null
      await setMemberData(guildId, userId, existing)
      memberData = existing
    } else {
      memberData = await initMemberData(guildId, userId, username)
    }
  } catch (err) {
    console.error(`[guildMemberAdd] Step 2 failed (member profile): ${err.message}`)
  }

  // STEP 3 — Assign auto roles
  try {
    if (config.autoRoles?.length > 0) {
      for (const roleId of config.autoRoles) {
        try {
          await member.roles.add(roleId)
          console.log(`[autorole] Assigned ${roleId} to ${username}`)
        } catch (err) {
          console.error(`[autorole] Failed to assign ${roleId} to ${username}: ${err.message}`)
        }
      }
    }
  } catch (err) {
    console.error(`[guildMemberAdd] Step 3 failed (auto roles): ${err.message}`)
  }

  // STEP 4 — Send welcome channel message
  try {
    if (config.welcomeChannelId) {
      const channel = guild.channels.cache.get(config.welcomeChannelId)
      if (!channel) {
        console.warn(
          `[guildMemberAdd] Welcome channel ${config.welcomeChannelId} not found in guild ${guild.name}`
        )
      } else {
        const parsedWelcome = parseTemplate(config.welcomeMessage, {
          user: member.toString(),
          server: guild.name,
          count: guild.memberCount,
        })

        const cardBuffer = await generateWelcomeCard(member, config)
        const attachment = new AttachmentBuilder(cardBuffer, {
          name: 'welcome.png',
        })
        await channel.send({
          content: parsedWelcome,
          files: [attachment],
        })
      }
    }
  } catch (err) {
    console.error(`[guildMemberAdd] Step 4 failed (welcome message): ${err.message}`)
  }

  // STEP 5 — Send DM
  try {
    if (config.dmEnabled) {
      const parsedDm = parseTemplate(config.dmMessage, {
        username,
        server: guild.name,
      })

      let dmSent = false
      try {
        await user.send(parsedDm)
        dmSent = true
      } catch {
        console.log(`[dm] Could not send DM to ${username}, DMs likely disabled`)
      }

      if (dmSent && memberData) {
        memberData.dmSent = true
        await setMemberData(guildId, userId, memberData)
      }
    }
  } catch (err) {
    console.error(`[guildMemberAdd] Step 5 failed (DM): ${err.message}`)
  }
}
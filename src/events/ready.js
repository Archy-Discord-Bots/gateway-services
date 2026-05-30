import { ActivityType } from 'discord.js'
import { loadGuildConfig } from '../storage/cache.js'

export const name = 'ready'
export const once = true

export async function execute(client) {
  console.log(`[ready] Logged in as ${client.user.tag}`)

  client.user.setPresence({
    status: 'online',
    activities: [
      {
        type: ActivityType.Watching,
        name: 'for new members',
      },
    ],
  })

  let loaded = 0
  for (const [, guild] of client.guilds.cache) {
    try {
      await loadGuildConfig(guild.id)
      console.log(`[ready] Loaded config for guild: ${guild.name}`)
      loaded++
    } catch (err) {
      console.error(`[ready] Failed to load config for guild ${guild.name}: ${err.message}`)
    }
  }

  console.log(`[ready] Watching ${loaded} guilds`)
}
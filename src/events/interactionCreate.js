import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// commandMap is populated once at module load time — not on every interaction
const commandMap = new Map()

;(async () => {
  const commandsDir = resolve(__dirname, '../commands')
  const files = readdirSync(commandsDir).filter((f) => f.endsWith('.js'))

  await Promise.all(
    files.map(async (file) => {
      const mod = await import(pathToFileURL(resolve(commandsDir, file)).href)
      if (mod?.data?.name) {
        commandMap.set(mod.data.name, mod)
      }
    })
  )

  console.log(`[commands] Loaded ${commandMap.size} command(s): ${[...commandMap.keys()].join(', ')}`)
})()

export const name = 'interactionCreate'
export const once = false

export async function execute(interaction) {
  if (!interaction.isChatInputCommand()) return

  const command = commandMap.get(interaction.commandName)

  if (!command) {
    await interaction.reply({ content: 'Unknown command.', ephemeral: true })
    return
  }

  try {
    await command.execute(interaction)
  } catch (err) {
    console.error(`[commands] Error in ${interaction.commandName}: ${err.message}`)

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Something went wrong. Please try again.', ephemeral: true })
    } else if (!interaction.replied) {
      await interaction.editReply({ content: 'Something went wrong. Please try again.' })
    }
  }
}
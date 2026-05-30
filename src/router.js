import { Router } from 'express'
import { verifyKey } from 'discord-interactions'
import { generateWelcomeCard } from './canvas/welcomeCard.js'
import { generateLeaveCard } from './canvas/leaveCard.js'
import * as setupCmd from './commands/setup.js'
import * as welcomeMessageCmd from './commands/welcome-message.js'
import * as leaveMessageCmd from './commands/leave-message.js'
import * as welcomeBackgroundCmd from './commands/welcome-background.js'
import * as leaveBackgroundCmd from './commands/leave-background.js'
import * as previewCmd from './commands/preview.js'
import * as resetCmd from './commands/reset.js'

const commands = new Map([
  ['setup', setupCmd],
  ['welcome-message', welcomeMessageCmd],
  ['leave-message', leaveMessageCmd],
  ['welcome-background', welcomeBackgroundCmd],
  ['leave-background', leaveBackgroundCmd],
  ['preview', previewCmd],
  ['reset', resetCmd],
])

const router = Router()

// GET /health
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
})

// POST /generate/welcome
router.post('/generate/welcome', async (req, res) => {
  if (req.headers['x-api-secret'] !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    const buffer = await generateWelcomeCard(req.body)
    res.set('Content-Type', 'image/png')
    res.send(buffer)
  } catch (err) {
    console.error('[router] /generate/welcome failed:', err.message)
    res.status(500).json({ error: 'card generation failed' })
  }
})

// POST /generate/leave
router.post('/generate/leave', async (req, res) => {
  if (req.headers['x-api-secret'] !== process.env.API_SECRET) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    const buffer = await generateLeaveCard(req.body)
    res.set('Content-Type', 'image/png')
    res.send(buffer)
  } catch (err) {
    console.error('[router] /generate/leave failed:', err.message)
    res.status(500).json({ error: 'card generation failed' })
  }
})

// POST /interactions
router.post('/interactions', async (req, res) => {
  const signature = req.headers['x-signature-ed25519']
  const timestamp = req.headers['x-signature-timestamp']
  const isValid = verifyKey(req.body, signature, timestamp, process.env.DISCORD_PUBLIC_KEY)
  if (!isValid) {
    return res.status(401).end('Invalid request signature')
  }

  const interaction = JSON.parse(req.body.toString())

  // PING
  if (interaction.type === 1) {
    res.setHeader('Content-Type', 'application/json')
    return res.status(200).json({ type: 1 })
  }

  // APPLICATION_COMMAND
  if (interaction.type === 2) {
    const commandName = interaction.data?.name
    const command = commands.get(commandName)

    if (!command) {
      res.setHeader('Content-Type', 'application/json')
      return res.json({
        type: 4,
        data: { content: 'Unknown command.', flags: 64 },
      })
    }

    try {
      await command.execute(interaction, res)
    } catch (err) {
      console.error(`[router] Command "${commandName}" threw:`, err.message)
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json')
        res.json({
          type: 4,
          data: { content: 'An error occurred while running that command.', flags: 64 },
        })
      }
    }
    return
  }

  // Unhandled interaction type
  res.setHeader('Content-Type', 'application/json')
  res.json({ type: 4, data: { content: 'Unsupported interaction type.', flags: 64 } })
})

export default router

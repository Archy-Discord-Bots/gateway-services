import { Canvas, loadImage } from 'skia-canvas'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { downloadBinary } from '../storage/hfClient.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DEFAULT_BACKGROUNDS = {
  default1: path.join(__dirname, '../assets/backgrounds/default1.png'),
  default2: path.join(__dirname, '../assets/backgrounds/default2.png'),
  default3: path.join(__dirname, '../assets/backgrounds/default3.png'),
}

const WIDTH = 800
const HEIGHT = 200
const ACCENT_COLOR = '#ed4245'

// Pre-load all default backgrounds once at module load time
const defaultBackgroundCache = new Map()

await Promise.all(
  Object.entries(DEFAULT_BACKGROUNDS).map(async ([key, filePath]) => {
    try {
      const image = await loadImage(filePath)
      defaultBackgroundCache.set(key, image)
      console.log(`[card] Pre-loaded background: ${key}`)
    } catch (err) {
      console.error(`[card] Failed to pre-load background "${key}":`, err.message)
    }
  })
)

export async function generateLeaveCard(data) {
  const canvas = new Canvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  try {
    // STEP 1 — Load background
    let bgImage
    try {
      if (data.isCustom) {
        const buffer = await downloadBinary(`guilds/${data.guildId}/assets/leave_bg.png`)
        if (buffer) {
          bgImage = await loadImage(buffer)
        } else {
          bgImage = defaultBackgroundCache.get('default1')
        }
      } else if (defaultBackgroundCache.has(data.background)) {
        bgImage = defaultBackgroundCache.get(data.background)
      } else {
        bgImage = defaultBackgroundCache.get('default1')
      }
    } catch (err) {
      console.error('[card] Background load failed, using default:', err.message)
      bgImage = defaultBackgroundCache.get('default1')
    }

    ctx.drawImage(bgImage, 0, 0, WIDTH, HEIGHT)

    // STEP 2 — Dark overlay (slightly darker than welcome)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    // STEP 3 — Accent bar (Discord red, hardcoded)
    ctx.fillStyle = ACCENT_COLOR
    ctx.fillRect(0, 0, 6, HEIGHT)

    // STEP 4 — Avatar
    const avatarImage = await loadImage(data.avatarURL)

    const centerX = 110
    const centerY = 100
    const radius = 70

    ctx.save()
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(avatarImage, centerX - radius, centerY - radius, radius * 2, radius * 2)
    ctx.restore()

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.strokeStyle = ACCENT_COLOR
    ctx.lineWidth = 4
    ctx.stroke()

    // STEP 5 — Text
    // Guild name label
    ctx.font = 'bold 15px DejaVu Sans'
    ctx.fillStyle = ACCENT_COLOR
    ctx.fillText(data.guildName.toUpperCase(), 200, 70)

    // Username
    ctx.font = 'bold 32px DejaVu Sans'
    ctx.fillStyle = data.cardTextColor
    ctx.fillText(data.username, 200, 115)

    // Member count line
    ctx.font = '16px DejaVu Sans'
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.fillText('We now have ' + data.memberCount + ' members', 200, 148)

    // STEP 6 — Return buffer
    const buffer = await canvas.toBuffer('png')
    return buffer
  } catch (err) {
    console.error('[card] generateLeaveCard failed:', err.message)
    throw err
  }
}

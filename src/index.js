import express from 'express'
import router from './router.js'

const REQUIRED_ENV = [
  'DISCORD_PUBLIC_KEY',
  'DISCORD_CLIENT_ID',
  'HF_TOKEN',
  'HF_BUCKET_NAME',
  'API_SECRET',
]

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required environment variable: ${key}`)
    process.exit(1)
  }
}

const app = express()

// Raw body only for /interactions — needed for Ed25519 signature verification
app.use('/interactions', express.raw({ type: 'application/json' }))

// JSON body for all other routes
app.use(express.json())

app.use('/', router)

const PORT = process.env.PORT || 7860

app.listen(PORT, () => {
  console.log(`[startup] gateway-services running on port ${PORT} — ${new Date().toISOString()}`)
})

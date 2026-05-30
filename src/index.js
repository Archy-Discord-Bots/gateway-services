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

// Raw body for /interactions — must come first, before any JSON middleware.
// type: '*/*' captures whatever Content-Type Discord sends.
app.use('/interactions', express.raw({ type: '*/*' }))

// JSON body for every other route — skip /interactions so the raw Buffer is preserved.
app.use((req, res, next) => {
  if (req.path === '/interactions') return next()
  express.json()(req, res, next)
})

app.use('/', router)

const PORT = process.env.PORT || 7860
app.listen(PORT, () => {
  console.log(`[startup] gateway-services running on port ${PORT} — ${new Date().toISOString()}`)
})

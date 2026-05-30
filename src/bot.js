import { Client, GatewayIntentBits, Partials } from 'discord.js'
import { Agent } from 'undici'
import { readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { loadGuildConfig } from './storage/cache.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const RACE_CONCURRENCY   = 5        // parallel attempts per round
const MAX_RETRIES        = -1       // rounds before giving up (-1 = infinite)
const RETRY_DELAY_MS     = 5_000    // wait between rounds (ms)
const CONNECT_TIMEOUT    = 60_000   // undici connect timeout per attempt (ms)

// How often to ping Discord's gateway to confirm the connection is alive.
// discord.js already sends its own heartbeats, but this lets US detect a
// zombie connection independently and trigger a reconnect if needed.
const KEEPALIVE_INTERVAL_MS = 30_000  // ping every 30 s
const KEEPALIVE_TIMEOUT_MS  = 10_000  // if no pong within 10 s → reconnect

// Passing a custom undici Agent via the `rest` option is the only way to
// override discord.js's hardcoded 10 s connect timeout — env vars and
// top-level Client options are ignored by undici entirely.
function createClient() {
  const c = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.GuildMember],
    rest: {
      agent: new Agent({ connect: { timeout: CONNECT_TIMEOUT } }),
    },
  })

  c.on('error', (err) => {
    console.warn('[bot] Client error event:', err.message)
  })

  return c
}

// Single connection attempt — resolves with the ready client or rejects on failure
function attemptLogin(token, attemptNum) {
  return new Promise((resolve, reject) => {
    const c = createClient()

    // Our own outer guard — slightly longer than CONNECT_TIMEOUT so the
    // undici error surfaces first with a meaningful message when possible.
    const timeout = setTimeout(() => {
      c.destroy()
      reject(new Error(`Attempt ${attemptNum} timed out`))
    }, CONNECT_TIMEOUT + 5_000)

    c.once('clientReady', () => {
      clearTimeout(timeout)
      resolve(c)
    })

    c.login(token).catch((err) => {
      clearTimeout(timeout)
      c.destroy()
      reject(err)
    })
  })
}

// Race RACE_CONCURRENCY attempts — first to succeed wins, losers are destroyed
function raceConnections(token, round) {
  return new Promise((resolve, reject) => {
    let settled  = false
    let failures = 0

    const attempts = Array.from({ length: RACE_CONCURRENCY }, (_, i) =>
      attemptLogin(token, `round=${round} slot=${i + 1}`)
    )

    attempts.forEach((p, i) => {
      p.then((winner) => {
        if (settled) {
          winner.destroy()
          return
        }
        settled = true
        console.log(`[bot] Connection established (round=${round} slot=${i + 1})`)
        resolve(winner)
      }).catch((err) => {
        failures++
        console.warn(`[bot] Attempt failed (round=${round} slot=${i + 1}): ${err.message}`)
        if (!settled && failures === RACE_CONCURRENCY) {
          reject(new Error(`All ${RACE_CONCURRENCY} attempts failed in round ${round}`))
        }
      })
    })
  })
}

// Exported client reference — populated once connected
export let client = null

// -------------------------------------------------------------------
// Load guild configs for all guilds the client is currently in.
// Called after every successful connection or reconnect so the cache
// is always warm regardless of whether the ready event re-fires.
// -------------------------------------------------------------------
export async function loadAllGuildConfigs(c) {
  for (const [guildId, guild] of c.guilds.cache) {
    try {
      await loadGuildConfig(guild)
      console.log(`[bot] Loaded guild config for ${guild.name} (${guildId})`)
    } catch (err) {
      console.error(`[bot] Failed to load guild config for ${guildId}: ${err.message}`)
    }
  }
}

// -------------------------------------------------------------------
// Keepalive: ping the gateway WS every KEEPALIVE_INTERVAL_MS.
// If we don't get a response within KEEPALIVE_TIMEOUT_MS we consider
// the connection zombie and force a full reconnect.
// -------------------------------------------------------------------
let keepaliveTimer   = null
let reconnectPending = false

function startKeepalive(c, onZombie) {
  stopKeepalive()

  keepaliveTimer = setInterval(async () => {
    if (reconnectPending) return

    try {
      const shard = c.ws?.shards?.first?.() ?? c.ws
      if (!shard) return
      const latency = shard.ping
      if (latency === -1 || latency === null || latency === undefined) {
        throw new Error('gateway ping is -1, connection likely dead')
      }
      console.log('[bot] Keepalive ping OK — gateway latency ' + latency + ' ms')
    } catch (err) {
      console.warn(`[bot] Keepalive ping FAILED: ${err.message} — triggering reconnect`)
      reconnectPending = true
      stopKeepalive()
      onZombie()
    }
  }, KEEPALIVE_INTERVAL_MS)
}

function stopKeepalive() {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer)
    keepaliveTimer = null
  }
}

// -------------------------------------------------------------------
// Wire up disconnect/error listeners so we reconnect automatically.
// -------------------------------------------------------------------
function attachReconnectListeners(c, events, token) {
  // discord.js fires this when the gateway WS closes unexpectedly
  c.on('shardDisconnect', async (closeEvent, shardId) => {
    if (reconnectPending) return
    reconnectPending = true
    console.warn(`[bot] Shard ${shardId} disconnected (code ${closeEvent.code}) — reconnecting...`)
    stopKeepalive()
    await reconnect(events, token)
  })

  // Gateway-level errors (network drop, TLS failure, etc.)
  c.on('shardError', async (err, shardId) => {
    if (reconnectPending) return
    reconnectPending = true
    console.warn(`[bot] Shard ${shardId} error: ${err.message} — reconnecting...`)
    stopKeepalive()
    // Small delay so any in-flight cleanup can finish
    await new Promise((r) => setTimeout(r, 1_000))
    await reconnect(events, token)
  })

  c.on('error', (err) => {
    if (reconnectPending) return
    if (err.code === 'ECONNRESET' ||
        err.message.includes('TLS') ||
        err.message.includes('socket')) {
      reconnectPending = true
      console.warn('[bot] Client ECONNRESET detected — reconnecting...')
      stopKeepalive()
      reconnect(events, token)
    }
  })
}

// -------------------------------------------------------------------
// Reconnect — tear down current client, race new connections.
// -------------------------------------------------------------------
async function reconnect(events, token) {
  console.log('[bot] Attempting reconnect...')

  // Gracefully destroy the old client if it's still around
  try { client?.destroy() } catch (_) {}
  client = null

  let round = 0
  while (MAX_RETRIES === -1 || round < MAX_RETRIES) {
    round++
    console.log(`[bot] Reconnect round ${round}/${MAX_RETRIES === -1 ? '∞' : MAX_RETRIES}`)

    try {
      const winner = await raceConnections(token, round)
      registerEvents(winner, events)
      attachReconnectListeners(winner, events, token)
      client = winner
      reconnectPending = false
      await loadAllGuildConfigs(winner)
      startKeepalive(winner, () => reconnect(events, token))
      console.log('[bot] Reconnect successful')
      return
    } catch (err) {
      console.error(`[bot] Reconnect round ${round} failed: ${err.message}`)
      if (MAX_RETRIES !== -1 && round >= MAX_RETRIES) {
        console.error('[bot] Giving up — process will exit')
        process.exit(1)
      }
      console.log(`[bot] Retrying reconnect in ${RETRY_DELAY_MS / 1000}s...`)
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    }
  }
}

// Register loaded event modules on a client instance
function registerEvents(c, events) {
  for (const event of events) {
    if (event.once) {
      c.once(event.name, (...args) => event.execute(...args))
    } else {
      c.on(event.name, (...args) => event.execute(...args))
    }
  }
}

process.on('uncaughtException', (err) => {
  console.error('[bot] Uncaught exception:', err.message)
  if (err.code === 'ECONNRESET' ||
      err.message.includes('TLS') ||
      err.message.includes('socket')) {
    console.warn('[bot] Network error — process will continue')
    return
  }
  console.error('[bot] Fatal error — exiting')
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  console.error('[bot] Unhandled rejection:', reason?.message ?? reason)
})

export async function startBot() {
  const token = process.env.DISCORD_TOKEN
  if (!token) throw new Error('Missing required environment variable: DISCORD_TOKEN')

  // Load events once — registered on whichever client wins each race
  const eventsDir  = resolve(__dirname, 'events')
  const eventFiles = readdirSync(eventsDir).filter((f) => f.endsWith('.js'))
  const events     = await Promise.all(
    eventFiles.map((file) => import(pathToFileURL(resolve(eventsDir, file)).href))
  )

  let round = 0

  while (MAX_RETRIES === -1 || round < MAX_RETRIES) {
    round++
    console.log(`[bot] Starting Discord client... (round ${round}/${MAX_RETRIES === -1 ? '∞' : MAX_RETRIES})`)

    try {
      const winner = await raceConnections(token, round)
      registerEvents(winner, events)
      attachReconnectListeners(winner, events, token)
      client = winner
      reconnectPending = false
      await loadAllGuildConfigs(winner)
      startKeepalive(winner, () => reconnect(events, token))
      return
    } catch (err) {
      console.error(`[bot] Round ${round} failed: ${err.message}`)

      if (MAX_RETRIES !== -1 && round >= MAX_RETRIES) {
        throw new Error(`[bot] Giving up after ${MAX_RETRIES} rounds`)
      }

      console.log(`[bot] Retrying in ${RETRY_DELAY_MS / 1000}s...`)
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    }
  }
}
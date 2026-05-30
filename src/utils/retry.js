const DEFAULT_ATTEMPTS = 5
const DEFAULT_DELAY_MS = 2000
const DEFAULT_LABEL = 'operation'

const NETWORK_ERROR_KEYWORDS = ['ECONNRESET', 'TLS', 'socket', 'ETIMEDOUT', 'aborted']

function isNetworkError(err) {
  const msg = err?.message ?? ''
  return NETWORK_ERROR_KEYWORDS.some((keyword) => msg.includes(keyword))
}

export async function retry(fn, options = {}) {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS
  const label = options.label ?? DEFAULT_LABEL

  let lastError
  let currentDelay = delayMs

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      console.warn(`[retry] ${label} attempt ${attempt}/${attempts} failed: ${err.message}`)

      if (attempt < attempts) {
        let waitMs = currentDelay

        if (isNetworkError(err)) {
          console.warn('[retry] Network error detected, adding extra delay')
          waitMs += 3000
        }

        await new Promise((resolve) => setTimeout(resolve, waitMs))
        currentDelay *= 2
      }
    }
  }

  throw new Error(`[retry] ${label} failed after ${attempts} attempts: ${lastError.message}`)
}
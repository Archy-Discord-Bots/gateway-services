import { uploadFiles, downloadFile, listFiles, deleteFiles } from '@huggingface/hub'
import { retry } from '../utils/retry.js'

const HF_TOKEN = process.env.HF_TOKEN
const HF_BUCKET_NAME = process.env.HF_BUCKET_NAME  // "Discord-Core-Bot/gateway-bot-storage"

if (!HF_TOKEN) throw new Error('Missing required environment variable: HF_TOKEN')
if (!HF_BUCKET_NAME) throw new Error('Missing required environment variable: HF_BUCKET_NAME')

const repo = { type: 'bucket', name: HF_BUCKET_NAME }
const credentials = { accessToken: HF_TOKEN }

async function fetchWithTimeout(url, options, ms = 30000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

function isNotFoundError(err) {
  const msg = err?.message?.toLowerCase() ?? ''
  return (
    err?.status === 404 ||
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('entry not found')
  )
}

export async function readJSON(remotePath) {
  return retry(
    async () => {
      let response
      try {
        response = await downloadFile({ repo, path: remotePath, credentials, fetch: fetchWithTimeout })
      } catch (err) {
        if (isNotFoundError(err)) return null
        throw err
      }
      if (response === null) return null
      const buffer = await response.arrayBuffer()
      const text = Buffer.from(buffer).toString('utf8')
      return JSON.parse(text)
    },
    { attempts: 3, label: `readJSON:${remotePath}` }
  )
}

export async function writeJSON(remotePath, data) {
  return retry(
    async () => {
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      await uploadFiles({
        repo,
        credentials,
        files: [{ path: remotePath, content: blob }],
        fetch: fetchWithTimeout,
      })
    },
    { attempts: 3, label: `writeJSON:${remotePath}` }
  )
}

export async function uploadBinary(remotePath, buffer, mimeType) {
  return retry(
    async () => {
      const blob = new Blob([buffer], { type: mimeType })
      await uploadFiles({
        repo,
        credentials,
        files: [{ path: remotePath, content: blob }],
        fetch: fetchWithTimeout,
      })
    },
    { attempts: 3, label: `uploadBinary:${remotePath}` }
  )
}

export async function downloadBinary(remotePath) {
  return retry(
    async () => {
      let response
      try {
        response = await downloadFile({ repo, path: remotePath, credentials, fetch: fetchWithTimeout })
      } catch (err) {
        if (isNotFoundError(err)) return null
        throw err
      }
      if (response === null) return null
      return Buffer.from(await response.arrayBuffer())
    },
    { attempts: 3, label: `downloadBinary:${remotePath}` }
  )
}

export async function fileExists(remotePath) {
  try {
    const response = await downloadFile({ repo, path: remotePath, credentials, fetch: fetchWithTimeout })
    return response !== null
  } catch (err) {
    if (isNotFoundError(err)) return false
    throw err
  }
}
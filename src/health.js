import http from 'node:http'

const PORT = parseInt(process.env.HEALTH_PORT ?? '7860', 10)

const JSON_HEADERS = {
  'Content-Type': 'application/json',
}

function handleRequest(req, res) {
  const isHealthRoute = req.method === 'GET' && (req.url === '/' || req.url === '/health')

  if (isHealthRoute) {
    const body = JSON.stringify({
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    })
    res.writeHead(200, JSON_HEADERS)
    res.end(body)
    return
  }

  res.writeHead(404, JSON_HEADERS)
  res.end(JSON.stringify({ error: 'not found' }))
}

export function startHealthServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handleRequest)

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Health server error: port ${PORT} is already in use. Exiting.`)
        process.exit(1)
      }
      reject(err)
    })

    server.listen(PORT, () => {
      console.log(`Health server listening on port ${PORT}`)
      resolve()
    })
  })
}
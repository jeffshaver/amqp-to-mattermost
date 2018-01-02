require('dotenv').config({ path: '.env', silent: true })

const fs = require('fs')
const amqp = require('amqplib')
const { URL } = require('url')
const { logger } = require('./logger')
const {
  AMQP_ENDPOINT,
  CLIENT_CERT_LOCATION,
  CLIENT_KEY_LOCATION,
  MATTERMOST_ENDPOINT,
  QUEUE
} = process.env
const mattermost_url = new URL(MATTERMOST_ENDPOINT)
const connectionOptions = {
  host: mattermost_url.host,
  method: 'POST',
  path: mattermost_url.pathname
}
const protocol = mattermost_url.protocol.substring(
  0,
  mattermost_url.protocol.length - 1
)
const request = require(protocol).request

if (protocol === 'https') {
  if (CLIENT_CERT_LOCATION === undefined || CLIENT_KEY_LOCATION === undefined) {
    logger.error(
      'You must provide both `CLIENT_CERT_LOCATION` and `CLIENT_KEY_LOCATION` when connecting to mattermost over TLS'
    )
    process.exit(1)
  }

  const readFile = path => {
    try {
      return path ? fs.readFileSync(path) : undefined
    } catch (e) {
      logger.error(`Tried to read file at path \`${e.path}\`. ${e.message}`)
      process.exit(1)
    }
  }

  connectionOptions.cert = readFile(CLIENT_CERT_LOCATION)
  connectionOptions.key = readFile(CLIENT_KEY_LOCATION)
}

process.on('unhandledRejection', r => {
  console.log('unhandledRejection', r)
})
process.on('unhandledException', e => {
  console.log('unhandledException', e)
})

consume()

async function consume() {
  try {
    const connection = await amqp.connect(AMQP_ENDPOINT)

    connection.on('error', onError)
    connection.on('close', onClose)

    const channel = await connection.createChannel()
    await channel.assertQueue(QUEUE)

    channel.consume(QUEUE, message => {
      if (message !== null) {
        logger.info(message.content)
        const messageString = JSON.stringify(
          {
            username: 'alert-bot',
            text: JSON.stringify(
              JSON.parse(message.content.toString()),
              null,
              2
            )
          },
          null,
          2
        )
        const req = request({
          ...connectionOptions,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': messageString.length
          }
        })

        req.on('error', e => {
          logger.error(`Problem with request: ${e.message}`)
        })

        req.write(messageString)
        req.end()

        channel.ack(message)
      }
    })
  } catch (e) {
    logger.warn(e)
  }
}

function onClose(e) {
  logger.info('close')
  logger.error(e)

  setTimeout(consume, 5000)
}

function onError(e) {
  logger.info('error')
  logger.error(e)

  setTimeout(consume, 5000)
}

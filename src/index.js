require('dotenv').config({ path: '.env', silent: true })

process.on('unhandledRejection', r => {
  console.log('unhandledRejection', r)
})
process.on('unhandledException', e => {
  console.log('unhandledException', e)
})

const fs = require('fs')
const { URL } = require('url')
const { logger } = require('./logger')
const { ReconnectingAMQP } = require('reconnecting-amqp')
const {
  AMQP_CA_CERT_LOCATION,
  AMQP_CERT_KEY_LOCATION,
  AMQP_CERT_LOCATION,
  AMQP_ENDPOINT,
  AMQP_KEY_LOCATION,
  AMQP_KEY_PASSPHRASE,
  HTTP_REQUEST_CERT_LOCATION,
  HTTP_REQUEST_KEY_LOCATION,
  MATTERMOST_ENDPOINT,
  QUEUE
} = process.env
let amqpOptions = {}
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
  if (
    HTTP_REQUEST_CERT_LOCATION === undefined ||
    HTTP_REQUEST_KEY_LOCATION === undefined
  ) {
    logger.error(
      'You must provide both `HTTP_REQUEST_CERT_LOCATION` and `HTTP_REQUEST_KEY_LOCATION` when connecting to mattermost over TLS'
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

  connectionOptions.cert = readFile(HTTP_REQUEST_CERT_LOCATION)
  connectionOptions.key = readFile(HTTP_REQUEST_KEY_LOCATION)
}

if (
  AMQP_CERT_KEY_LOCATION !== undefined &&
  (AMQP_CERT_LOCATION !== undefined || AMQP_KEY_LOCATION !== undefined)
) {
  logger.error(
    'Paths for both a PKCS12 and CRT/KEY have been provided. You must only provide `AMQP_CERT_KEY_LOCATION` or `AMQP_CERT_LOCATION` and `AMQP_KEY_LOCATION`'
  )
  process.exit(1)
}

const hasAmqpOptions =
  AMQP_CA_CERT_LOCATION ||
  AMQP_CERT_KEY_LOCATION ||
  AMQP_CERT_LOCATION ||
  AMQP_KEY_LOCATION ||
  AMQP_KEY_PASSPHRASE

if (hasAmqpOptions) {
  const readFile = path => {
    try {
      return path ? fs.readFileSync(path) : undefined
    } catch (e) {
      logger.error(`Tried to read file at path \`${e.path}\`. ${e.message}`)
      process.exit(1)
    }
  }

  const ca = [readFile(AMQP_CA_CERT_LOCATION)]
  const cert = readFile(AMQP_CERT_LOCATION)
  const key = readFile(AMQP_KEY_LOCATION)
  const passphrase = AMQP_KEY_PASSPHRASE
  const pfx = readFile(AMQP_CERT_KEY_LOCATION)

  amqpOptions = { ca, cert, key, passphrase, pfx }
}

const amqp = new ReconnectingAMQP(AMQP_ENDPOINT, amqpOptions)

start()

async function start() {
  try {
    await amqp.connect()

    amqp.consume(
      QUEUE,
      message => {
        const body = JSON.stringify(
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
            'Content-Length': body.length
          }
        })

        req.on('error', e => {
          logger.error(`Problem with request: ${e.message}`)
        })

        req.write(body)
        req.end()
      },
      true
    )
  } catch (e) {
    logger.warn(e)
  }
}

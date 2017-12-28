require('dotenv').config({ path: '.env', silent: true })

const amqp = require('amqplib')
const http = require('http')
const { URL } = require('url')
const { logger } = require('./logger')
const { AMQP_ENDPOINT, MATTERMOST_ENDPOINT, QUEUE } = process.env
const mattermost_url = new URL(MATTERMOST_ENDPOINT)

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
        const req = http.request({
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': messageString.length
          },
          host: mattermost_url.host,
          method: 'POST',
          path: mattermost_url.pathname
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

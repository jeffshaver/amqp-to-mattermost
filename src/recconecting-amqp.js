const amqp = require('amqplib')
const { logger } = require('./logger')

class ReconnectingAMQP {
  constructor(endpoint, options) {
    this.connection = null
    this.channel = null
    this.endpoint = endpoint
    this.options = options
  }

  async connect() {
    try {
      this.connection = await amqp.connect(this.endpoint, this.options)
      logger.info(`Successfully connected to ${this.endpoint}`)
      this.channel = await this.connection.createChannel()
      logger.info('Successfully created channel')

      this.connection.on('close', () => {
        logger.warn('AMQP connection closed. Reconnecting...')
        this.connect()
      })
    } catch (e) {
      logger.warn(e)
    }
  }

  async consume(queue, onConsume) {
    if (!this.channel) {
      logger.error(
        'ReconnectingAMQP has not created a connection and/or channel yet. You must call `await amqp.connect()` before calling this function'
      )

      return
    }

    try {
      await this.channel.assertQueue(queue)

      this.channel.consume(queue, message => {
        if (message === null) {
          logger.warn(`Message from ${queue} is null`)

          return
        }

        logger.info(message.content)

        onConsume(message)

        this.channel.ack(message)
      })
    } catch (e) {
      logger.warn(e)
    }
  }

  async sendToQueue(queue, message) {
    if (!this.channel) {
      logger.error(
        'ReconnectingAMQP has not created a connection and/or channel yet. You must call `await amqp.connect()` before calling this function'
      )

      return
    }

    try {
      await this.channel.assertQueue(queue)
      this.channel.sendToQueue(queue, Buffer.from(message))
    } catch (e) {
      logger.warn(e)
      channel.close()
      connection.close()
    }
  }
}

module.exports = { ReconnectingAMQP }

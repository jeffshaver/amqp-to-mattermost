const { createLogger, format, transports } = require('winston')
const { combine, json, simple, timestamp } = format
const { LOG_DIRECTORY } = process.env

const logger = createLogger({
  level: 'info',
  format: combine(json(), timestamp()),
  transports: [
    new transports.File({
      filename: `${LOG_DIRECTORY}/error.log`,
      level: 'error'
    }),
    new transports.File({ filename: `${LOG_DIRECTORY}/combined.log` })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: simple()
    })
  )
}

module.exports = { logger }

import pino from 'pino';

// Determine the default log level based on environment
const defaultLogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Use the environment variable if provided, otherwise use the calculated default
const logLevel = process.env.LOG_LEVEL || defaultLogLevel;

// Configure Pino options
const pinoOptions: pino.LoggerOptions = {
  level: logLevel,
};

// Create and export the logger instance
const logger = pino(pinoOptions);

logger.info(`Logger initialized with level: ${logLevel}`); // Log the level on startup

export default logger;
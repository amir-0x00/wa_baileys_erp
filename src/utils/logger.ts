import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'wa-baileys-erp' },
  transports: [
    // Only console transport - PM2 will handle file logging
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

// Helper to forward arguments as any[]
function spreadArgs(fn: (...args: any[]) => void, args: unknown[]) {
  return fn(...(args as any[]));
}

// Add trace and debug methods for Baileys compatibility
if (!(logger as any).trace) {
  (logger as any).trace = (...args: unknown[]) =>
    (logger as any).debug ? spreadArgs((logger as any).debug, args) : spreadArgs(logger.info, args);
}
if (!(logger as any).debug) {
  (logger as any).debug = (...args: unknown[]) => spreadArgs(logger.info, args);
}

export default logger;

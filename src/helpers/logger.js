import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createLogger, format, transports } from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure logs directory exists automatically
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// 1. PII Redaction Filter (In-place mutation to protect sensitive data)
const SENSITIVE_KEYS = ['aadhaar', 'documentnumber', 'password', 'token', 'buffer', 'mobile', 'phone', 'secret'];

const redactObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      obj[key] = '[REDACTED_PII]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      redactObject(obj[key]);
    }
  }
  return obj;
};

const piiRedactFormat = format((info) => {
  redactObject(info);
  return info;
});

// 2. Human Readable File Format
const readableFormat = format.printf(({ timestamp, level, message, stack, correlationId, ...meta }) => {
  const border = '------------------------------------------------------------';
  const corr = correlationId ? ` [Correlation: ${correlationId}]` : '';
  const metaStr = Object.keys(meta).length ? `\nMetadata: ${JSON.stringify(meta, null, 2)}` : '';

  if (stack) {
    return `\n${border}\n[${timestamp}] [${String(level).toUpperCase()}]${corr}: ${message}${metaStr}\nStack Trace:\n${stack}\n${border}\n`;
  }
  return `[${timestamp}] [${String(level).toUpperCase()}]${corr}: ${message}${metaStr}`;
});

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    piiRedactFormat(),
    readableFormat
  ),
  transports: [
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
    new transports.File({
      filename: path.join(logsDir, 'combined.log'),
    }),
    new transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'info',
    }),
  ],
});

// Attach colored Console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp({ format: 'HH:mm:ss' }),
        format.printf(({ timestamp, level, message, stack, correlationId, ...meta }) => {
          const corr = correlationId ? ` [${correlationId.slice(0, 8)}]` : '';
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          if (stack) {
            return `\n[${timestamp}] [${level}]${corr}: ${message}${metaStr}\n${stack}\n`;
          }
          return `[${timestamp}] [${level}]${corr}: ${message}${metaStr}`;
        })
      ),
    })
  );
}

export default logger;


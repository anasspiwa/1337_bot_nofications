const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
);

// Custom format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: fileFormat,
    defaultMeta: { service: '1337-monitoring-bot' },
    transports: [
        // Error log file
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Combined log file
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

// Helper functions for different log levels
const logHelper = {
    info: (message, meta = {}) => {
        logger.info(message, meta);
        console.log(`ℹ️ ${message}`);
    },
    
    warn: (message, meta = {}) => {
        logger.warn(message, meta);
        console.log(`⚠️ ${message}`);
    },
    
    error: (message, error = null, meta = {}) => {
        if (error) {
            meta.error = {
                message: error.message,
                stack: error.stack,
                name: error.name
            };
        }
        logger.error(message, meta);
        console.log(`❌ ${message}${error ? `: ${error.message}` : ''}`);
    },
    
    debug: (message, meta = {}) => {
        logger.debug(message, meta);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`🔍 ${message}`);
        }
    },
    
    success: (message, meta = {}) => {
        logger.info(message, meta);
        console.log(`✅ ${message}`);
    },
    
    monitoring: (message, meta = {}) => {
        logger.info(`[MONITORING] ${message}`, meta);
        console.log(`🔍 ${message}`);
    },
    
    whatsapp: (message, meta = {}) => {
        logger.info(`[WHATSAPP] ${message}`, meta);
        console.log(`📱 ${message}`);
    },
    
    notification: (message, meta = {}) => {
        logger.info(`[NOTIFICATION] ${message}`, meta);
        console.log(`🔔 ${message}`);
    }
};

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Application shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Application terminating...');
    process.exit(0);
});

module.exports = { logger, logHelper }; 
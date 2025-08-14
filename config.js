const path = require('path');
require('dotenv').config();

const requiredVars = [
    'WEBSITE_EMAIL',
    'WEBSITE_PASSWORD',
    'WHATSAPP_ADMIN_NUMBERS',
];

const missingVars = requiredVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars);
    process.exit(1);
}

const CONFIG = {
    // Application settings
    APP: {
        NAME: '1337 Monitoring Bot',
        VERSION: '2.0.0',
        ENV: process.env.NODE_ENV || 'development',
        DEBUG: process.env.DEBUG === 'true',
        LOG_LEVEL: process.env.LOG_LEVEL || 'info'
    },

    // Website monitoring configuration
    MONITORING: {
        EMAIL: process.env.WEBSITE_EMAIL,
        PASSWORD: process.env.WEBSITE_PASSWORD,
        LOGIN_URL: process.env.LOGIN_URL || 'https://admission.1337.ma/en/users/sign_in',
        TARGET_URL: process.env.TARGET_URL || 'https://admission.1337.ma/candidature/piscine',
        SAVE_DIR: path.resolve(__dirname, process.env.SAVE_DIR || 'saved_html'), // Windows-friendly
        CHECK_INTERVAL: parseInt(process.env.CHECK_INTERVAL) || 10000, // 10 seconds
        MAX_ATTEMPTS: process.env.MAX_ATTEMPTS === 'infinite' ? Infinity : parseInt(process.env.MAX_ATTEMPTS) || 20,
        HEADLESS: false, // Always show browser window
        BROWSER_TIMEOUT: parseInt(process.env.BROWSER_TIMEOUT) || 30000,
        PAGE_TIMEOUT: parseInt(process.env.PAGE_TIMEOUT) || 30000, // Increased to 30 seconds
        RETRY_DELAY: parseInt(process.env.RETRY_DELAY) || 5000,
        AUTO_SCROLL_ENABLED: process.env.AUTO_SCROLL_ENABLED !== 'false', // Default to true
        LOGOUT_DETECTION_ENABLED: process.env.LOGOUT_DETECTION_ENABLED !== 'false', // Default to true
        KEYWORD: process.env.MONITORING_KEYWORD || '' // Keyword to monitor in main content
    },

    // WhatsApp configuration
    WHATSAPP: {
        SESSION_DIR: path.resolve(__dirname, process.env.WHATSAPP_SESSION_DIR || 'whatsapp_session'), // Windows-friendly
        ADMIN_NUMBERS: process.env.WHATSAPP_ADMIN_NUMBERS,
        GROUP_IDS: process.env.WHATSAPP_GROUP_IDS,
        ENABLED: process.env.WHATSAPP_ENABLED !== 'false', // Default to true
        AUTO_RECONNECT: process.env.WHATSAPP_AUTO_RECONNECT !== 'false', // Default to true
        RECONNECT_DELAY: parseInt(process.env.WHATSAPP_RECONNECT_DELAY) || 5000,
        MAX_RECONNECT_ATTEMPTS: parseInt(process.env.WHATSAPP_MAX_RECONNECT_ATTEMPTS) || 10
    },

    // Notification configuration
    NOTIFICATIONS: {
        TELEGRAM: {
            ENABLED: process.env.TELEGRAM_ENABLED === 'true',
            BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
            CHAT_IDS: process.env.TELEGRAM_CHAT_IDS,
        },
        
        DISCORD: {
            ENABLED: process.env.DISCORD_ENABLED === 'true',
            WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
            USERNAME: process.env.DISCORD_USERNAME,
            AVATAR_URL: process.env.DISCORD_AVATAR_URL,
            ROLE_ID: process.env.DISCORD_ROLE_ID,
        },
        
        TWILIO: {
            // Twilio config is now handled via TWILIO1_* and TWILIO2_* environment variables
            // See notification.js for usage
            VOICE_NUMBERS: process.env.TWILIO_VOICE_NUMBERS // Comma-separated list, order matters
        },
        
        EMAIL: {
            ENABLED: process.env.EMAIL_ENABLED === 'true',
            HOST: process.env.EMAIL_HOST,
            PORT: process.env.EMAIL_PORT,
            USER: process.env.EMAIL_USER,
            PASS: process.env.EMAIL_PASS,
            TO: process.env.EMAIL_TO,
        },
        
        VOICE: {
            ENABLED: process.env.VOICE_CALLS_ENABLED === 'true',
            PHONE_NUMBERS: process.env.VOICE_PHONE_NUMBERS,
            AUDIO_FILE: process.env.VOICE_AUDIO_FILE || path.resolve(__dirname, 'audio/alert.wav'), // Windows-friendly
            TTS_TEXT: process.env.VOICE_TTS_TEXT || 'Alert: Change detected on 1337 website. Please check the website immediately.'
        }
    },

    // Browser configuration
    BROWSER: {
        ARGS: [
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu'
        ],
        USER_AGENT: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    },

    // Security configuration
    SECURITY: {
        RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED !== 'false',
        MAX_REQUESTS_PER_MINUTE: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 60,
        REQUEST_DELAY: parseInt(process.env.REQUEST_DELAY) || 1000
    },

    // Performance configuration
    PERFORMANCE: {
        MEMORY_LIMIT: process.env.MEMORY_LIMIT || '512MB',
        CPU_LIMIT: process.env.CPU_LIMIT || '50%',
        CLEANUP_INTERVAL: parseInt(process.env.CLEANUP_INTERVAL) || 3600000, // 1 hour
        MAX_LOG_FILES: parseInt(process.env.MAX_LOG_FILES) || 10,
        MAX_HTML_FILES: parseInt(process.env.MAX_HTML_FILES) || 50
    }
};

// Validation functions
const validateConfig = () => {
    const errors = [];

    // Validate monitoring config
    if (!CONFIG.MONITORING.EMAIL || !CONFIG.MONITORING.PASSWORD) {
        errors.push('Website email and password are required');
    }

    if (CONFIG.MONITORING.CHECK_INTERVAL < 5000) {
        errors.push('Check interval must be at least 5 seconds');
    }

    // Validate WhatsApp config
    if (CONFIG.WHATSAPP.ENABLED && CONFIG.WHATSAPP.ADMIN_NUMBERS.length === 0) {
        errors.push('WhatsApp admin numbers are required when WhatsApp is enabled');
    }

    // Validate notification configs
    if (CONFIG.NOTIFICATIONS.TELEGRAM.ENABLED && !CONFIG.NOTIFICATIONS.TELEGRAM.BOT_TOKEN) {
        errors.push('Telegram bot token is required when Telegram is enabled');
    }

    if (CONFIG.NOTIFICATIONS.DISCORD.ENABLED && !CONFIG.NOTIFICATIONS.DISCORD.WEBHOOK_URL) {
        errors.push('Discord webhook URL is required when Discord is enabled');
    }

    if (CONFIG.NOTIFICATIONS.EMAIL.ENABLED && (!CONFIG.NOTIFICATIONS.EMAIL.HOST || !CONFIG.NOTIFICATIONS.EMAIL.USER)) {
        errors.push('SMTP configuration is required when email notifications are enabled');
    }

    if (errors.length > 0) {
        console.error('❌ Configuration validation failed:');
        errors.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
    }
};

// Initialize validation
validateConfig();

module.exports = CONFIG; 
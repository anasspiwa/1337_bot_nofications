#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🚀 1337 Monitoring Bot Setup');
console.log('============================\n');

const questions = [
    {
        name: 'email',
        question: 'Enter your 1337 website email: ',
        required: true
    },
    {
        name: 'password',
        question: 'Enter your 1337 website password: ',
        required: true,
        hidden: true
    },
    {
        name: 'whatsapp_enabled',
        question: 'Enable WhatsApp notifications? (y/n): ',
        default: 'y'
    },
    {
        name: 'admin_numbers',
        question: 'Enter WhatsApp admin numbers (comma-separated, format: 212626691425@s.whatsapp.net): ',
        required: false
    },
    {
        name: 'group_ids',
        question: 'Enter WhatsApp group IDs (comma-separated, format: 120363025123456789@g.us): ',
        required: false
    },
    {
        name: 'check_interval',
        question: 'Check interval in seconds (default: 10): ',
        default: '10'
    },
    {
        name: 'headless',
        question: 'Run browser in headless mode? (y/n): ',
        default: 'y'
    }
];

function askQuestion(questionObj) {
    return new Promise((resolve) => {
        const defaultText = questionObj.default ? ` (default: ${questionObj.default})` : '';
        const fullQuestion = questionObj.question + defaultText;
        
        rl.question(fullQuestion, (answer) => {
            if (!answer && questionObj.default) {
                answer = questionObj.default;
            }
            
            if (questionObj.required && !answer) {
                console.log('❌ This field is required!');
                return askQuestion(questionObj).then(resolve);
            }
            
            resolve(answer);
        });
    });
}

function generateEnvFile(answers) {
    const envContent = `# ==================== REQUIRED SETTINGS ====================
# Website credentials (REQUIRED)
WEBSITE_EMAIL=${answers.email}
WEBSITE_PASSWORD=${answers.password}

# ==================== MONITORING SETTINGS ====================
# Monitoring URLs
LOGIN_URL=https://admission.1337.ma/en/users/sign_in
TARGET_URL=https://admission.1337.ma/candidature/piscine

# Monitoring intervals and limits
CHECK_INTERVAL=${parseInt(answers.check_interval) * 1000}
MAX_ATTEMPTS=infinite
HEADLESS=${answers.headless === 'y' ? 'true' : 'false'}

# Browser settings
BROWSER_TIMEOUT=30000
PAGE_TIMEOUT=15000
RETRY_DELAY=5000
BROWSER_WIDTH=1920
BROWSER_HEIGHT=1080

# Feature toggles
AUTO_SCROLL_ENABLED=true
LOGOUT_DETECTION_ENABLED=true

# ==================== WHATSAPP SETTINGS ====================
# WhatsApp session directory
WHATSAPP_SESSION_DIR=./whatsapp_session

# Admin phone numbers (comma-separated)
WHATSAPP_ADMIN_NUMBERS=${answers.admin_numbers || ''}

# Group IDs (comma-separated)
WHATSAPP_GROUP_IDS=${answers.group_ids || ''}

# WhatsApp features
WHATSAPP_ENABLED=${answers.whatsapp_enabled === 'y' ? 'true' : 'false'}
WHATSAPP_AUTO_RECONNECT=true
WHATSAPP_RECONNECT_DELAY=5000
WHATSAPP_MAX_RECONNECT_ATTEMPTS=10

# ==================== TELEGRAM SETTINGS ====================
TELEGRAM_ENABLED=false
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_IDS=123456789,-987654321

# ==================== DISCORD SETTINGS ====================
DISCORD_ENABLED=false
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_url
DISCORD_USERNAME=1337 Monitor Bot
DISCORD_AVATAR_URL=https://cdn.discordapp.com/embed/avatars/0.png

# ==================== EMAIL SETTINGS ====================
EMAIL_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
FROM_EMAIL=your_email@gmail.com
TO_EMAILS=admin@example.com,user@example.com

# ==================== VOICE CALL SETTINGS ====================
VOICE_CALLS_ENABLED=false
VOICE_PHONE_NUMBERS=+,+
VOICE_AUDIO_FILE=./audio/alert.wav
VOICE_TTS_TEXT=Alert: Change detected on 1337 website. Please check the website immediately.

# ==================== APPLICATION SETTINGS ====================
# Environment
NODE_ENV=development
DEBUG=false
LOG_LEVEL=info

# Performance settings
MEMORY_LIMIT=512MB
CPU_LIMIT=50%
CLEANUP_INTERVAL=3600000
MAX_LOG_FILES=10
MAX_HTML_FILES=50

# Security settings
RATE_LIMIT_ENABLED=true
MAX_REQUESTS_PER_MINUTE=60
REQUEST_DELAY=1000

# File paths
SAVE_DIR=saved_html

# ==================== TWILIO SETTINGS ====================
# First Twilio Account
TWILIO1_ACCOUNT_SID=your_first_account_sid
TWILIO1_AUTH_TOKEN=your_first_auth_token
TWILIO1_FROM_NUMBER=your_first_twilio_number

# Second Twilio Account
TWILIO2_ACCOUNT_SID=your_second_account_sid
TWILIO2_AUTH_TOKEN=your_second_auth_token
TWILIO2_FROM_NUMBER=your_second_twilio_number

# Numbers to call (first number uses first account, second number uses second account)
TWILIO_VOICE_NUMBERS=+2126xxxxxxx1,+2126xxxxxxx2
`;

    return envContent;
}

async function runSetup() {
    try {
        const answers = {};
        
        for (const question of questions) {
            answers[question.name] = await askQuestion(question);
        }
        
        const envContent = generateEnvFile(answers);
        const envPath = path.join(__dirname, '.env');
        
        fs.writeFileSync(envPath, envContent);
        
        console.log('\n✅ Setup completed successfully!');
        console.log('📁 .env file created with your configuration');
        console.log('\n📋 Next steps:');
        console.log('1. Review the .env file and adjust settings if needed');
        console.log('2. Run: npm install');
        console.log('3. Run: npm start');
        console.log('\n📚 For more information, check the documentation files:');
        console.log('- WHATSAPP_SETUP.md');
        console.log('- KEYWORD_SEARCH_GUIDE.md');
        console.log('- AUTO_RECONNECTION_GUIDE.md');
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
    } finally {
        rl.close();
    }
}

// Check if .env already exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    rl.question('⚠️ .env file already exists. Overwrite? (y/n): ', (answer) => {
        if (answer.toLowerCase() === 'y') {
            runSetup();
        } else {
            console.log('Setup cancelled.');
            rl.close();
        }
    });
} else {
    runSetup();
} 
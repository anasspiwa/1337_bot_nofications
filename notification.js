const axios = require('axios');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const twilio = require('twilio');

// ==================== CONFIGURATION ====================
const NOTIFICATION_CONFIG = {
    // Telegram Configuration
    TELEGRAM: {
        BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        CHAT_IDS: process.env.TELEGRAM_CHAT_IDS?.split(',') || [],
        API_URL: 'https://api.telegram.org/bot'
    },
    
    // Discord Configuration
    DISCORD: {
        WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
        USERNAME: process.env.DISCORD_USERNAME || '1337 Monitor Bot',
        AVATAR_URL: process.env.DISCORD_AVATAR_URL || 'https://cdn.discordapp.com/embed/avatars/0.png'
    },
    
    // Telegram Voice Calling Configuration
    TELEGRAM_CALLING: {
        ENABLED: process.env.TELEGRAM_CALLING_ENABLED === 'true',
        CALLMEBOT_USERS: process.env.TELEGRAM_CALLMEBOT_USERS?.split(',') || ['@dadabobo8', '@amine038', '@bhop_01'],
        CALL_MESSAGE: process.env.TELEGRAM_CALL_MESSAGE || 'Alert from 1337 monitoring system - website change detected',
        CALL_LANGUAGE: process.env.TELEGRAM_CALL_LANGUAGE || 'en-US-Standard-B',
        CALL_API_URL: 'http://api.callmebot.com/start.php'
    },
    
    // Voice Call Configuration
    VOICE: {
        ENABLED: process.env.VOICE_CALLS_ENABLED === 'true',
        PHONE_NUMBERS: process.env.VOICE_PHONE_NUMBERS?.split(',') || [],
        AUDIO_FILE: process.env.VOICE_AUDIO_FILE || './audio/alert.wav',
        TTS_TEXT: process.env.VOICE_TTS_TEXT || 'تنبيه: تم اكتشاف تغيير في موقع 1337. يرجى التحقق من الموقع فوراً.'
    },
    
    // Email Configuration
    EMAIL: {
        ENABLED: process.env.EMAIL_ENABLED === 'true',
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT || 587,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
        FROM_EMAIL: process.env.FROM_EMAIL,
        TO_EMAILS: process.env.TO_EMAILS?.split(',') || []
    }
};

// ==================== UTILITY FUNCTIONS ====================

function formatEnglishMessage(changeInfo) {
    const emojis = {
        'Monitoring Started': '🚀',
        'Content Change Detected': '🚨',
        'System Error': '❌',
        'Monitoring Stopped': '🛑',
        'Re-login Process': '🔄',
        'Re-login Failed': '❌'
    };

    const emoji = emojis[changeInfo.type] || '🔔';
    
    return `
${emoji} **1337 Website Alert**

🔍 **Update Type:** ${changeInfo.type}
⏰ **Timestamp:** ${changeInfo.timestamp}
🔄 **Attempt:** ${changeInfo.attempt}

📝 **Details:**
${changeInfo.details}

📁 **Saved File:** ${changeInfo.savedFile}
🔗 **Page URL:** https://admission.1337.ma/candidature/piscine

---
🤖 1337 Automated Monitoring System
    `.trim();
}

// ==================== TELEGRAM NOTIFICATIONS ====================

class TelegramNotifier {
    constructor() {
        this.botToken = NOTIFICATION_CONFIG.TELEGRAM.BOT_TOKEN;
        this.chatIds = NOTIFICATION_CONFIG.TELEGRAM.CHAT_IDS;
        this.apiUrl = NOTIFICATION_CONFIG.TELEGRAM.API_URL;
    }

    async sendMessage(message, chatId) {
        try {
            const response = await axios.post(`${this.apiUrl}${this.botToken}/sendMessage`, {
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });

            return {
                success: true,
                chatId: chatId,
                messageId: response.data.result.message_id
            };
        } catch (error) {
            console.error(`❌ Failed to send Telegram message to ${chatId}:`, error.response?.data || error.message);
            return {
                success: false,
                chatId: chatId,
                error: error.message
            };
        }
    }

    async sendToAllChats(changeInfo) {
        if (!this.botToken || this.chatIds.length === 0) {
            console.log('⚠️ Telegram not configured properly');
            return { success: false, error: 'Configuration incomplete' };
        }

        const message = formatEnglishMessage(changeInfo);
        const results = [];

        for (const chatId of this.chatIds) {
            const result = await this.sendMessage(message, chatId.trim());
            results.push(result);
            
            // Short wait between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`📱 Telegram: ${successCount}/${results.length} messages sent successfully`);

        return {
            success: successCount > 0,
            results: results,
            successCount: successCount,
            totalCount: results.length
        };
    }
}

// ==================== TELEGRAM CALLING NOTIFICATIONS ====================

class TelegramCallingNotifier {
    constructor() {
        this.enabled = NOTIFICATION_CONFIG.TELEGRAM_CALLING.ENABLED;
        this.users = NOTIFICATION_CONFIG.TELEGRAM_CALLING.CALLMEBOT_USERS;
        this.callMessage = NOTIFICATION_CONFIG.TELEGRAM_CALLING.CALL_MESSAGE;
        this.callLanguage = NOTIFICATION_CONFIG.TELEGRAM_CALLING.CALL_LANGUAGE;
        this.apiUrl = NOTIFICATION_CONFIG.TELEGRAM_CALLING.CALL_API_URL;
    }

    async callUsers(changeInfo) {
        if (!this.enabled || this.users.length === 0) {
            console.log('⚠️ Telegram calls not enabled or no users configured');
            return { success: false, error: 'Calls not enabled' };
        }

        console.log('🔄 Starting Telegram user calls...');
        const results = [];

        for (const user of this.users) {
            const result = await this.callUser(user.trim(), changeInfo);
            results.push(result);
            
            // Wait between calls to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`📞 Telegram calls: ${successCount}/${results.length} calls made successfully`);

        return {
            success: successCount > 0,
            results: results,
            successCount: successCount,
            totalCount: results.length
        };
    }

    async callUser(user, changeInfo) {
        try {
            // Customize call message based on change type
            const customMessage = this.createCallMessage(changeInfo);
            
            const url = `${this.apiUrl}?source=auth&user=${encodeURIComponent(user)}&text=${encodeURIComponent(customMessage)}&lang=${this.callLanguage}`;
            
            console.log(`📞 Attempting to call ${user}...`);
            
            const response = await axios.get(url, {
                timeout: 10000 // 10 seconds timeout
            });
            
            console.log(`✅ Successfully called ${user}: Status ${response.status}`);
            
            return {
                success: true,
                user: user,
                status: response.status,
                message: 'Call made successfully'
            };
            
        } catch (error) {
            console.error(`❌ Failed to call ${user}:`, error.message);
            return {
                success: false,
                user: user,
                error: error.message
            };
        }
    }

    createCallMessage(changeInfo) {
        // إنشاء رسالة مخصصة للمكالمة باللغة الإنجليزية
        const messageTemplates = {
            'بدء المراقبة': 'Alert: 1337 monitoring system started successfully',
            'تغيير في المحتوى': 'URGENT: 1337 website content changed! Check Piscine page immediately',
            'خطأ في النظام': 'Warning: 1337 monitoring system error detected',
            'إيقاف المراقبة': 'Info: 1337 monitoring system stopped'
        };

        const baseMessage = messageTemplates[changeInfo.type] || this.callMessage;
        return `${baseMessage}. Time: ${changeInfo.timestamp}. Attempt: ${changeInfo.attempt}`;
    }
}

// ==================== DISCORD NOTIFICATIONS ====================

class DiscordNotifier {
    constructor() {
        this.webhookUrl = NOTIFICATION_CONFIG.DISCORD.WEBHOOK_URL;
        this.username = NOTIFICATION_CONFIG.DISCORD.USERNAME;
        this.avatarUrl = NOTIFICATION_CONFIG.DISCORD.AVATAR_URL;
    }

    async sendWebhook(changeInfo) {
        if (!this.webhookUrl) {
            console.log('⚠️ Discord webhook not configured');
            return { success: false, error: 'Webhook not configured' };
        }

        try {
            const embed = this.createEmbed(changeInfo);
            
            const payload = {
                username: this.username,
                avatar_url: this.avatarUrl,
                embeds: [embed],
                content: `<@&${process.env.DISCORD_ROLE_ID || 'everyone'}> 1337 Website Alert!`
            };

            const response = await axios.post(this.webhookUrl, payload);

            console.log('✅ Discord notification sent successfully');
            return {
                success: true,
                webhookId: response.headers['x-ratelimit-bucket']
            };
        } catch (error) {
            console.error('❌ Failed to send Discord notification:', error.response?.data || error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    createEmbed(changeInfo) {
        const colors = {
            'بدء المراقبة': 0x00ff00,      // أخضر
            'تغيير في المحتوى': 0xff0000,   // أحمر
            'خطأ في النظام': 0xff6600,      // برتقالي
            'إيقاف المراقبة': 0x808080      // رمادي
        };

        const color = colors[changeInfo.type] || 0x0099ff;

        return {
            title: "🔔 إشعار موقع 1337",
            description: formatEnglishMessage(changeInfo),
            color: color,
            timestamp: new Date().toISOString(),
            footer: {
                text: "1337 Monitor Bot",
                icon_url: this.avatarUrl
            },
            fields: [
                {
                    name: "🔗 الرابط المباشر",
                    value: "[صفحة Piscine](https://admission.1337.ma/candidature/piscine)",
                    inline: true
                },
                {
                    name: "📁 الملف",
                    value: changeInfo.savedFile,
                    inline: true
                },
                {
                    name: "🔄 المحاولة",
                    value: changeInfo.attempt.toString(),
                    inline: true
                }
            ]
        };
    }
}

// ==================== VOICE CALL NOTIFICATIONS ====================

class VoiceNotifier {
    constructor() {
        this.enabled = NOTIFICATION_CONFIG.VOICE.ENABLED;
        this.phoneNumbers = NOTIFICATION_CONFIG.VOICE.PHONE_NUMBERS;
        this.audioFile = NOTIFICATION_CONFIG.VOICE.AUDIO_FILE;
        this.ttsText = NOTIFICATION_CONFIG.VOICE.TTS_TEXT;
    }

    async makeVoiceCalls(changeInfo) {
        if (!this.enabled || this.phoneNumbers.length === 0) {
            console.log('⚠️ المكالمات الصوتية غير مفعلة أو لا توجد أرقام');
            return { success: false, error: 'المكالمات غير مفعلة' };
        }

        const results = [];

        for (const phoneNumber of this.phoneNumbers) {
            const result = await this.makeCall(phoneNumber.trim(), changeInfo);
            results.push(result);
            
            // انتظار بين المكالمات
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`📞 المكالمات الصوتية: ${successCount}/${results.length} مكالمات تم إجراؤها`);

        return {
            success: successCount > 0,
            results: results,
            successCount: successCount,
            totalCount: results.length
        };
    }

    async makeCall(phoneNumber, changeInfo) {
        try {
            console.log(`📞 محاولة الاتصال بـ ${phoneNumber}...`);
            
            // محاكاة تأخير المكالمة
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            return {
                success: true,
                phoneNumber: phoneNumber,
                callId: `simulated_${Date.now()}`,
                message: 'تم إجراء المكالمة بنجاح (محاكاة)'
            };
            
        } catch (error) {
            console.error(`❌ فشل الاتصال بـ ${phoneNumber}:`, error.message);
            return {
                success: false,
                phoneNumber: phoneNumber,
                error: error.message
            };
        }
    }
}

// ==================== EMAIL NOTIFICATIONS ====================

class EmailNotifier {
    constructor() {
        this.enabled = NOTIFICATION_CONFIG.EMAIL.ENABLED;
        this.config = NOTIFICATION_CONFIG.EMAIL;
    }

    async sendEmails(changeInfo) {
        if (!this.enabled || !this.config.SMTP_HOST || this.config.TO_EMAILS.length === 0) {
            console.log('⚠️ البريد الإلكتروني غير مكون بشكل صحيح');
            return { success: false, error: 'التكوين غير مكتمل' };
        }

        try {
            // تحتاج إلى تثبيت nodemailer: npm install nodemailer
            // const nodemailer = require('nodemailer');
            
            console.log('📧 محاكاة إرسال البريد الإلكتروني...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            return {
                success: true,
                messageId: `simulated_${Date.now()}`,
                recipients: this.config.TO_EMAILS.length
            };
            
        } catch (error) {
            console.error('❌ فشل إرسال البريد الإلكتروني:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// ==================== Twilio NOTIFICATIONS ====================

class TwilioNotifier {
    constructor() {
        // First Twilio account
        this.client1 = null;
        this.accountSid1 = process.env.TWILIO1_ACCOUNT_SID;
        this.authToken1 = process.env.TWILIO1_AUTH_TOKEN;
        this.fromNumber1 = process.env.TWILIO1_FROM_NUMBER;
        // Second Twilio account
        this.client2 = null;
        this.accountSid2 = process.env.TWILIO2_ACCOUNT_SID;
        this.authToken2 = process.env.TWILIO2_AUTH_TOKEN;
        this.fromNumber2 = process.env.TWILIO2_FROM_NUMBER;
        this.enabled = (this.accountSid1 && this.authToken1 && this.fromNumber1) || (this.accountSid2 && this.authToken2 && this.fromNumber2);
        if (this.accountSid1 && this.authToken1 && this.fromNumber1) {
            this.client1 = twilio(this.accountSid1, this.authToken1);
        }
        if (this.accountSid2 && this.authToken2 && this.fromNumber2) {
            this.client2 = twilio(this.accountSid2, this.authToken2);
        }
    }

    async sendVoiceCall(phoneNumbers, message) {
        if (!this.enabled) {
            console.log('⚠️ Twilio voice calls not enabled or not configured');
            return { success: false, error: 'Twilio not configured' };
        }
        const numbers = phoneNumbers.split(',').map(num => num.trim());
        const results = [];
        // First number with first account
        if (numbers[0] && this.client1 && this.fromNumber1) {
            try {
                console.log(`📞 Making Twilio voice call to ${numbers[0]} using Account 1...`);
                const call = await this.client1.calls.create({
                    url: 'http://demo.twilio.com/docs/voice.xml',
                    to: numbers[0],
                    from: this.fromNumber1,
                    twiml: `<Response><Say>Hey Anass, pool 1337 is available</Say></Response>`
                });
                console.log(`✅ Twilio voice call initiated to ${numbers[0]}: ${call.sid}`);
                results.push({ success: true, number: numbers[0], sid: call.sid, account: 1 });
            } catch (error) {
                console.error(`❌ Failed to make Twilio voice call to ${numbers[0]}:`, error.message);
                // Log full error object for debugging
                console.error('Twilio Error (Account 1):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                results.push({ success: false, number: numbers[0], error: error.message, account: 1, fullError: error });
            }
        }
        // Second number with second account
        if (numbers[1] && this.client2 && this.fromNumber2) {
            try {
                console.log(`📞 Making Twilio voice call to ${numbers[1]} using Account 2...`);
                const call = await this.client2.calls.create({
                    url: 'http://demo.twilio.com/docs/voice.xml',
                    to: numbers[1],
                    from: this.fromNumber2,
                    twiml: `<Response><Say>Hey Anass, pool 1337 is available</Say></Response>`
                });
                console.log(`✅ Twilio voice call initiated to ${numbers[1]}: ${call.sid}`);
                results.push({ success: true, number: numbers[1], sid: call.sid, account: 2 });
            } catch (error) {
                console.error(`❌ Failed to make Twilio voice call to ${numbers[1]}:`, error.message);
                // Log full error object for debugging
                console.error('Twilio Error (Account 2):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                results.push({ success: false, number: numbers[1], error: error.message, account: 2, fullError: error });
            }
        }
        return { success: results.some(r => r.success), results };
    }
}

// ==================== MAIN NOTIFICATION FUNCTION ====================

async function sendAllNotifications(changeInfo, whatsappSock = null, isWhatsAppConnected = false) {
    // Prevent notifications for 'Re-login Process' and 'Monitoring Started'
    if (changeInfo.type === 'Re-login Process' || changeInfo.type === 'Monitoring Started') {
        console.log(`🔄 Skipping notifications for ${changeInfo.type}`);
        return { skipped: true, reason: changeInfo.type };
    }

    // For 'Content Change Detected', repeat all notifications except Twilio 10 times
    if (changeInfo.type === 'Content Change Detected') {
        let lastResult = null;
        // Call Twilio only once
        let twilioResult = null;
        if (process.env.TWILIO_ENABLED === 'true' && process.env.TWILIO_VOICE_NUMBERS) {
            console.log('📞 Making Twilio voice calls (only once)...');
            try {
                const twilioNotifier = new TwilioNotifier();
                twilioResult = await twilioNotifier.sendVoiceCall(process.env.TWILIO_VOICE_NUMBERS, formatEnglishMessage(changeInfo));
            } catch (error) {
                console.error('❌ Error making Twilio voice calls:', error);
                twilioResult = { success: false, error: error.message };
            }
        }
        for (let i = 0; i < 10; i++) {
            console.log(`🚨 Content Change Detected: Notification process ${i + 1}/10`);
            // Pass twilioResult so _send does not call Twilio again
            lastResult = await sendAllNotifications._send(changeInfo, whatsappSock, isWhatsAppConnected, twilioResult);
            if (i < 9) await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
        return lastResult;
    }

    return await sendAllNotifications._send(changeInfo, whatsappSock, isWhatsAppConnected);
}

// Move the original function body to sendAllNotifications._send
sendAllNotifications._send = async function(changeInfo, whatsappSock = null, isWhatsAppConnected = false, twilioResult = null) {
    const results = {
        telegram: { success: false, sent: 0, total: 0 },
        discord: { success: false, error: null },
        whatsapp: { success: false, sent: 0, total: 0 },
        twilioVoice: { success: false, sent: 0, total: 0 },
        email: { success: false, error: null }
    };

    const message = formatEnglishMessage(changeInfo);

    // Send Telegram notifications
    if (process.env.TELEGRAM_ENABLED === 'true' && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_IDS) {
        console.log('📱 Sending Telegram notifications...');
        try {
            const telegramNotifier = new TelegramNotifier();
            const telegramResult = await telegramNotifier.sendToAllChats(changeInfo);
            results.telegram = telegramResult;
        } catch (error) {
            console.error('❌ Error sending Telegram notifications:', error);
            results.telegram.error = error.message;
        }
    }

    // Send Discord notifications
    if (process.env.DISCORD_ENABLED === 'true' && process.env.DISCORD_WEBHOOK_URL) {
        console.log('🎮 Sending Discord notifications...');
        try {
            const discordNotifier = new DiscordNotifier();
            const discordResult = await discordNotifier.sendWebhook(changeInfo);
            results.discord = discordResult;
        } catch (error) {
            console.error('❌ Error sending Discord notifications:', error);
            results.discord.error = error.message;
        }
    }

    // Send WhatsApp notifications
    if (isWhatsAppConnected && whatsappSock) {
        console.log('📱 Sending WhatsApp notifications...');
        try {
            const whatsappResult = await sendWhatsAppNotifications(changeInfo, whatsappSock);
            results.whatsapp = whatsappResult;
        } catch (error) {
            console.error('❌ Error sending WhatsApp notifications:', error);
            results.whatsapp.error = error.message;
        }
    }

    // Send Twilio voice calls (only if not already done)
    if (twilioResult !== null) {
        results.twilioVoice = twilioResult;
    } else if (process.env.TWILIO_ENABLED === 'true' && process.env.TWILIO_VOICE_NUMBERS) {
        console.log('📞 Making Twilio voice calls...');
        try {
            const twilioNotifier = new TwilioNotifier();
            const voiceResult = await twilioNotifier.sendVoiceCall(process.env.TWILIO_VOICE_NUMBERS, message);
            results.twilioVoice = voiceResult;
        } catch (error) {
            console.error('❌ Error making Twilio voice calls:', error);
            results.twilioVoice.error = error.message;
        }
    }

    // Send email notifications
    if (process.env.EMAIL_ENABLED === 'true') {
        console.log('📧 Sending email notifications...');
        try {
            const emailNotifier = new EmailNotifier();
            const emailResult = await emailNotifier.sendEmails(changeInfo);
            results.email = emailResult;
        } catch (error) {
            console.error('❌ Error sending email notifications:', error);
            results.email.error = error.message;
        }
    }

    // Print summary
    console.log('\n📊 Notification Results Summary:');
    console.log(`📱 Telegram: ${results.telegram.success ? '✅' : '❌'}`);
    console.log(`🎮 Discord: ${results.discord.success ? '✅' : '❌'}`);
    console.log(`📱 WhatsApp: ${results.whatsapp.success ? '✅' : '❌'}`);
    console.log(`📞 Twilio Voice: ${results.twilioVoice.success ? '✅' : '❌'}`);
    console.log(`📧 Email: ${results.email.success ? '✅' : '❌'}`);

    return results;
};

// ==================== WHATSAPP NOTIFICATIONS ====================

async function sendWhatsAppNotifications(changeInfo, sock) {
    try {
        const groupIds = process.env.WHATSAPP_GROUP_IDS?.split(',') || [];
        const adminNumbers = process.env.WHATSAPP_ADMIN_NUMBERS?.split(',') || [];
        
        if (groupIds.length === 0 && adminNumbers.length === 0) {
            console.log('⚠️ No group IDs or admin numbers configured for WhatsApp');
            return { success: false, error: 'No targets configured' };
        }

        const message = formatEnglishMessage(changeInfo);
        const results = [];

        // Only send to admins if Monitoring Stopped
        if (changeInfo.type !== 'Monitoring Stopped') {
            // Send to groups
            for (const groupId of groupIds) {
                const trimmedGroupId = groupId.trim();
                if (trimmedGroupId) {
                    try {
                        console.log(`📱 Sending message to WhatsApp group: ${trimmedGroupId}`);
                        // Add @g.us to ID if not present
                        const fullGroupId = trimmedGroupId.includes('@g.us') ? trimmedGroupId : `${trimmedGroupId}@g.us`;
                        await sock.sendMessage(fullGroupId, {
                            text: message
                        });
                        results.push({
                            success: true,
                            target: fullGroupId,
                            type: 'group',
                            messageId: `group_${Date.now()}`
                        });
                        // Short wait between messages
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        console.error(`❌ Failed to send message to group ${trimmedGroupId}:`, error.message);
                        results.push({
                            success: false,
                            target: trimmedGroupId,
                            type: 'group',
                            error: error.message
                        });
                    }
                }
            }
        }

        // Send to individual admins
        for (const adminNumber of adminNumbers) {
            const trimmedNumber = adminNumber.trim();
            if (trimmedNumber) {
                try {
                    console.log(`📱 Sending message to WhatsApp admin: ${trimmedNumber}`);
                    // Add @s.whatsapp.net to number if not present
                    const fullNumber = trimmedNumber.includes('@s.whatsapp.net') ? trimmedNumber : `${trimmedNumber}@s.whatsapp.net`;
                    await sock.sendMessage(fullNumber, {
                        text: message
                    });
                    results.push({
                        success: true,
                        target: fullNumber,
                        type: 'admin',
                        messageId: `admin_${Date.now()}`
                    });
                    // Short wait between messages
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`❌ Failed to send message to admin ${trimmedNumber}:`, error.message);
                    results.push({
                        success: false,
                        target: trimmedNumber,
                        type: 'admin',
                        error: error.message
                    });
                }
            }
        }

        const successCount = results.filter(r => r.success).length;
        const groupSuccessCount = results.filter(r => r.success && r.type === 'group').length;
        const adminSuccessCount = results.filter(r => r.success && r.type === 'admin').length;

        console.log(`📱 WhatsApp: ${successCount}/${results.length} messages sent successfully`);
        console.log(`   - Groups: ${groupSuccessCount}/${groupIds.length}`);
        console.log(`   - Admins: ${adminSuccessCount}/${adminNumbers.length}`);

        return {
            success: successCount > 0,
            results: results,
            successCount: successCount,
            totalCount: results.length,
            groupSuccessCount: groupSuccessCount,
            adminSuccessCount: adminSuccessCount
        };

    } catch (error) {
        console.error('❌ General error in sending WhatsApp notifications:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ==================== TEST FUNCTION ====================

async function testNotifications() {
    console.log('🧪 Testing notification system...');
    
    const testChangeInfo = {
        type: 'System Test',
        timestamp: new Date().toLocaleString('en-US'),
        attempt: 0,
        savedFile: 'test_notification.html',
        details: 'This is a test of the notification system to ensure all platforms are working correctly.'
    };

    const results = await sendAllNotifications(testChangeInfo);
    
    console.log('\n🧪 Test Results:');
    console.log(JSON.stringify(results, null, 2));
    
    return results;
}

// ==================== EXPORTS ====================

module.exports = {
    sendAllNotifications,
    sendWhatsAppNotifications,
    testNotifications,
    TelegramNotifier,
    DiscordNotifier,
    VoiceNotifier,
    TelegramCallingNotifier,
    EmailNotifier,
    TwilioNotifier
};

// If file is run directly, run the test
if (require.main === module) {
    testNotifications().then(() => {
        console.log('✅ System test completed');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}
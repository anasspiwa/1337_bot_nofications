#!/usr/bin/env node

const { sendAllNotifications } = require('./notification');
const CONFIG = require('./config');
const { logHelper } = require('./logger');

console.log('🧪 Testing Notification Systems');
console.log('================================\n');

async function testNotifications() {
    const testInfo = {
        type: 'System Test',
        timestamp: new Date().toLocaleString('en-US'),
        attempt: 'test',
        savedFile: 'test_notification.html',
        details: 'This is a test of the notification system. If you received this message, the system is working correctly.'
    };

    console.log('📋 Test Information:');
    console.log(`   Type: ${testInfo.type}`);
    console.log(`   Timestamp: ${testInfo.timestamp}`);
    console.log(`   File: ${testInfo.savedFile}`);
    console.log(`   Details: ${testInfo.details}\n`);

    try {
        logHelper.info('Starting notification test...');
        
        // Test all notification systems
        const results = await sendAllNotifications(testInfo);
        
        console.log('📊 Test Results:');
        console.log('================');
        
        if (results.whatsapp) {
            console.log(`✅ WhatsApp: ${results.whatsapp.success ? 'SUCCESS' : 'FAILED'}`);
            if (results.whatsapp.results) {
                results.whatsapp.results.forEach((result, index) => {
                    console.log(`   ${index + 1}. ${result.success ? '✅' : '❌'} ${result.chatId || result.groupId}`);
                });
            }
        } else {
            console.log('⚠️ WhatsApp: Not configured');
        }
        
        if (results.telegram) {
            console.log(`✅ Telegram: ${results.telegram.success ? 'SUCCESS' : 'FAILED'}`);
            if (results.telegram.results) {
                results.telegram.results.forEach((result, index) => {
                    console.log(`   ${index + 1}. ${result.success ? '✅' : '❌'} ${result.chatId}`);
                });
            }
        } else {
            console.log('⚠️ Telegram: Not configured');
        }
        
        if (results.discord) {
            console.log(`✅ Discord: ${results.discord.success ? 'SUCCESS' : 'FAILED'}`);
        } else {
            console.log('⚠️ Discord: Not configured');
        }
        
        if (results.email) {
            console.log(`✅ Email: ${results.email.success ? 'SUCCESS' : 'FAILED'}`);
            if (results.email.results) {
                results.email.results.forEach((result, index) => {
                    console.log(`   ${index + 1}. ${result.success ? '✅' : '❌'} ${result.email}`);
                });
            }
        } else {
            console.log('⚠️ Email: Not configured');
        }
        
        if (results.voice) {
            console.log(`✅ Voice Calls: ${results.voice.success ? 'SUCCESS' : 'FAILED'}`);
            if (results.voice.results) {
                results.voice.results.forEach((result, index) => {
                    console.log(`   ${index + 1}. ${result.success ? '✅' : '❌'} ${result.phoneNumber}`);
                });
            }
        } else {
            console.log('⚠️ Voice Calls: Not configured');
        }
        
        if (results.twilioVoice) {
            console.log(`✅ Twilio Voice: ${results.twilioVoice.success ? 'SUCCESS' : 'FAILED'}`);
            if (results.twilioVoice.results) {
                results.twilioVoice.results.forEach((result, index) => {
                    console.log(`   ${index + 1}. ${result.success ? '✅' : '❌'} ${result.number} (Account ${result.account})`);
                });
            }
        } else {
            console.log('⚠️ Twilio Voice: Not configured');
        }
        
        console.log('\n📈 Summary:');
        console.log('===========');
        
        const totalTests = Object.keys(results).length;
        const successfulTests = Object.values(results).filter(r => r && r.success).length;
        
        console.log(`Total notification systems: ${totalTests}`);
        console.log(`Successful tests: ${successfulTests}`);
        console.log(`Success rate: ${Math.round((successfulTests / totalTests) * 100)}%`);
        
        if (successfulTests === totalTests) {
            console.log('\n🎉 All notification systems are working correctly!');
        } else {
            console.log('\n⚠️ Some notification systems failed. Check the configuration.');
        }
        
        logHelper.success('Notification test completed');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        logHelper.error('Notification test failed', error);
        process.exit(1);
    }
}

// Configuration check
function checkConfiguration() {
    console.log('🔧 Configuration Check:');
    console.log('=======================');
    
    // Check WhatsApp
    if (CONFIG.WHATSAPP.ENABLED) {
        console.log(`✅ WhatsApp: Enabled`);
        console.log(`   Admin numbers: ${CONFIG.WHATSAPP.ADMIN_NUMBERS.length}`);
        console.log(`   Group IDs: ${CONFIG.WHATSAPP.GROUP_IDS.length}`);
    } else {
        console.log('⚠️ WhatsApp: Disabled');
    }
    
    // Check Telegram
    if (CONFIG.NOTIFICATIONS.TELEGRAM.ENABLED) {
        console.log(`✅ Telegram: Enabled`);
        console.log(`   Chat IDs: ${CONFIG.NOTIFICATIONS.TELEGRAM.CHAT_IDS.length}`);
    } else {
        console.log('⚠️ Telegram: Disabled');
    }
    
    // Check Discord
    if (CONFIG.NOTIFICATIONS.DISCORD.ENABLED) {
        console.log(`✅ Discord: Enabled`);
    } else {
        console.log('⚠️ Discord: Disabled');
    }
    
    // Check Email
    if (CONFIG.NOTIFICATIONS.EMAIL.ENABLED) {
        console.log(`✅ Email: Enabled`);
        console.log(`   Recipients: ${CONFIG.NOTIFICATIONS.EMAIL.TO_EMAILS.length}`);
    } else {
        console.log('⚠️ Email: Disabled');
    }
    
    // Check Voice
    if (CONFIG.NOTIFICATIONS.VOICE.ENABLED) {
        console.log(`✅ Voice Calls: Enabled`);
        console.log(`   Phone numbers: ${CONFIG.NOTIFICATIONS.VOICE.PHONE_NUMBERS.length}`);
    } else {
        console.log('⚠️ Voice Calls: Disabled');
    }
    
    console.log('');
}

// Main execution
async function main() {
    try {
        checkConfiguration();
        await testNotifications();
    } catch (error) {
        console.error('❌ Test script failed:', error.message);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    main();
}

module.exports = { testNotifications, checkConfiguration }; 
# 🤖 1337 Monitoring Bot

A professional WhatsApp bot for monitoring the 1337 website with automatic reconnection, comprehensive notifications, and keyword search capabilities.

## 🚀 Features

### 🔍 **Website Monitoring**
- Real-time monitoring of 1337 website changes
- Automatic logout detection and reconnection
- Auto-scroll functionality for dynamic content
- Configurable check intervals and retry mechanisms

### 📱 **WhatsApp Integration**
- WhatsApp bot with Baileys library
- Group and individual admin notifications
- Interactive commands (`/help`, `/status`, `/keyword`, etc.)
- Automatic reconnection on disconnection

### 🔔 **Multi-Platform Notifications**
- WhatsApp (primary)
- Telegram
- Discord
- Email
- Voice calls

### 🔍 **Keyword Search**
- Search saved HTML files for keywords
- Arabic and English command support
- Up to 5 results per search
- Real-time search capabilities

### 🛡️ **Professional Features**
- Comprehensive logging with Winston
- Error handling and recovery
- Rate limiting and security measures
- Performance optimization
- Graceful shutdown handling

## 📋 Requirements

- Node.js 16.0.0 or higher
- npm 8.0.0 or higher
- Linux/Windows/macOS
- 1337 website account

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/1337-monitoring-bot.git
cd 1337-monitoring-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Configuration
```bash
npm run setup
```
This will guide you through the setup process and create a `.env` file.

### 4. Manual Configuration (Optional)
If you prefer to configure manually, create a `.env` file with the following variables:

```env
# Required
WEBSITE_EMAIL=your_email@example.com
WEBSITE_PASSWORD=your_password

# WhatsApp (Recommended)
WHATSAPP_ADMIN_NUMBERS=212@s.whatsapp.net
WHATSAPP_GROUP_IDS=120363025123456789@g.us

# Optional - Other notification platforms
TELEGRAM_ENABLED=false
DISCORD_ENABLED=false
EMAIL_ENABLED=false
```

## 🚀 Usage

### Start the Bot
```bash
npm start
```

### Development Mode
```bash
npm run dev
```

### Test Notifications
```bash
npm test
```

### View Logs
```bash
npm run logs
```

## 📱 WhatsApp Commands

Once the bot is running and connected to WhatsApp, you can use these commands:

| Command | Description | Example |
|---------|-------------|---------|
| `/help` | Show available commands | `/help` |
| `/status` | Check bot status | `/status` |
| `/keyword` | Search for keywords | `/keyword piscine` |
| `/كلمة` | Search for keywords (Arabic) | `/كلمة test` |
| `/groupid` | Get current group ID | `/groupid` |
| `/stop` | Stop monitoring | `/stop` |
| `/start` | Start monitoring | `/start` |

## ⚙️ Configuration

### Environment Variables

#### Required Settings
- `WEBSITE_EMAIL` - Your 1337 website email
- `WEBSITE_PASSWORD` - Your 1337 website password

#### Monitoring Settings
- `CHECK_INTERVAL` - Check interval in milliseconds (default: 10000)
- `MAX_ATTEMPTS` - Maximum monitoring attempts (default: infinite)
- `HEADLESS` - Run browser in headless mode (default: true)
- `AUTO_SCROLL_ENABLED` - Enable auto-scroll (default: true)
- `LOGOUT_DETECTION_ENABLED` - Enable logout detection (default: true)

#### WhatsApp Settings
- `WHATSAPP_ADMIN_NUMBERS` - Admin phone numbers (comma-separated)
- `WHATSAPP_GROUP_IDS` - Group IDs (comma-separated)
- `WHATSAPP_ENABLED` - Enable WhatsApp (default: true)
- `WHATSAPP_AUTO_RECONNECT` - Auto-reconnect on disconnect (default: true)

#### Notification Settings
- `TELEGRAM_ENABLED` - Enable Telegram notifications
- `DISCORD_ENABLED` - Enable Discord notifications
- `EMAIL_ENABLED` - Enable email notifications
- `VOICE_CALLS_ENABLED` - Enable voice call notifications

## 📁 Project Structure

```
1337-monitoring-bot/
├── remixed-cee7bfda.js    # Main application file
├── config.js              # Configuration management
├── logger.js              # Logging system
├── notification.js        # Notification handlers
├── setup.js               # Setup script
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (created by setup)
├── logs/                  # Log files
├── saved_html/            # Saved HTML files
├── whatsapp_session/      # WhatsApp session data
├── README.md              # This file
├── WHATSAPP_SETUP.md      # WhatsApp setup guide
├── KEYWORD_SEARCH_GUIDE.md # Keyword search guide
├── AUTO_RECONNECTION_GUIDE.md # Auto-reconnection guide
└── BUG_FIXES_SUMMARY.md   # Bug fixes documentation
```

## 🔧 Troubleshooting

### Common Issues

#### 1. WhatsApp Connection Issues
- Ensure your phone number is in the correct format: `212626691425@s.whatsapp.net`
- Check that WhatsApp Web is enabled on your phone
- Clear the `whatsapp_session` folder and restart

#### 2. Browser Issues
- Install Chrome/Chromium if not already installed
- Try running with `HEADLESS=false` to see browser activity
- Check system resources (memory, CPU)

#### 3. Login Issues
- Verify your 1337 credentials
- Check if the website is accessible
- Try manual login to ensure account is active

#### 4. Notification Issues
- Verify API keys and webhook URLs
- Check network connectivity
- Review logs for specific error messages

### Log Files
- `logs/combined.log` - All application logs
- `logs/error.log` - Error logs only
- `logs/exceptions.log` - Unhandled exceptions
- `logs/rejections.log` - Promise rejections

## 🔒 Security

### Best Practices
- Keep your `.env` file secure and never commit it to version control
- Use strong passwords for your 1337 account
- Regularly update dependencies
- Monitor logs for suspicious activity
- Use HTTPS for all external communications

### Rate Limiting
The bot includes built-in rate limiting to prevent abuse:
- Maximum 60 requests per minute
- Configurable delays between requests
- Automatic backoff on errors

## 📊 Performance

### Optimization Features
- Memory usage monitoring
- CPU usage limits
- Automatic cleanup of old files
- Efficient HTML parsing with Cheerio
- Optimized browser settings

### Monitoring
- Real-time performance metrics
- Memory and CPU usage tracking
- File cleanup scheduling
- Error rate monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Documentation
- [WhatsApp Setup Guide](WHATSAPP_SETUP.md)
- [Keyword Search Guide](KEYWORD_SEARCH_GUIDE.md)
- [Auto-Reconnection Guide](AUTO_RECONNECTION_GUIDE.md)
- [Bug Fixes Summary](BUG_FIXES_SUMMARY.md)

### Issues
If you encounter any issues:
1. Check the troubleshooting section
2. Review the logs in the `logs/` directory
3. Create an issue on GitHub with detailed information

### Contact
For support and questions:
- Create an issue on GitHub
- Check the documentation files
- Review the logs for error details

## 🔄 Changelog

### Version 2.0.0
- ✨ Added auto-reconnection feature
- ✨ Added comprehensive logging system
- ✨ Added professional configuration management
- ✨ Added setup script for easy installation
- ✨ Added multi-platform notification support
- ✨ Added keyword search functionality
- ✨ Added performance optimizations
- ✨ Added security improvements
- 🐛 Fixed multiple bugs and issues
- 📚 Added comprehensive documentation

### Version 1.0.0
- Initial release with basic monitoring functionality

---

**Note**: This bot is designed for educational and monitoring purposes. Please ensure you comply with 1337's terms of service and use responsibly. 

**by piwaanass**
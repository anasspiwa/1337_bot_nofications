const { 
  default: makeWASocket, 
  DisconnectReason, 
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const CONFIG = {
  WHATSAPP: {
    SESSION_DIR: './whatsapp_session',
    ADMIN_NUMBERS: ['212626691425@s.whatsapp.net'], // Edit here with your numbers in official WhatsApp format
    SAVE_DIR: path.resolve(__dirname, '../saved_html'), // HTML files directory
  }
};

// Function to find the latest HTML file based on modification date
function getLatestHtmlFile(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

  if (files.length === 0) return null;

  let latestFile = files[0];
  let latestTime = 0;

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stats = fs.statSync(fullPath);
    const mtime = stats.mtime.getTime();

    if (mtime > latestTime) {
      latestTime = mtime;
      latestFile = file;
    }
  }
  return path.join(dir, latestFile);
}

class WhatsAppBot {
  constructor() {
    this.sock = null;
    this.isConnected = false;
    this.adminNumbers = CONFIG.WHATSAPP.ADMIN_NUMBERS;
  }

  async start() {
    try {
      await this.connectToWhatsApp();
    } catch (error) {
      console.error('❌ Failed to start WhatsApp bot:', error);
    }
  }

  async connectToWhatsApp() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.WHATSAPP.SESSION_DIR);

    this.sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: true,
      browser: ['Chrome (Linux)', ''],
    });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('connection.update', this.handleConnectionUpdate.bind(this));
    this.sock.ev.on('messages.upsert', this.handleIncomingMessages.bind(this));
  }

  handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 Scan this QR code with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      this.isConnected = false;
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

      console.log('🔌 Connection closed:', lastDisconnect?.error?.message || lastDisconnect?.error);

      if (shouldReconnect) {
        console.log('🔄 Reconnecting to WhatsApp...');
        setTimeout(() => this.connectToWhatsApp(), 5000);
      } else {
        console.log('❌ Logged out from WhatsApp. Restart bot and scan new QR code.');
        process.exit(1);
      }
    } else if (connection === 'open') {
      this.isConnected = true;
      console.log('✅ Connected to WhatsApp successfully!');
      console.log('🤖 Bot ready to receive commands...');
    }
  }

  async handleIncomingMessages(messageUpdate) {
    const { messages } = messageUpdate;

    for (const message of messages) {
      if (message.key.fromMe || !message.message) continue;

      const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
      const senderJid = message.key.remoteJid;
      const isGroup = senderJid.endsWith('@g.us');
      const actualSender = isGroup ? message.key.participant : senderJid;

      if (!this.adminNumbers.includes(actualSender)) continue;

      if (messageText.toLowerCase().startsWith('/keyword ')) {
        const keyword = messageText.slice(9).trim().toLowerCase();
        if (!keyword) {
          await this.sock.sendMessage(senderJid, { text: '⚠️ Please provide a keyword after the command.\nExample: /keyword piscine' });
          return;
        }
        await this.searchKeywordAndReply(keyword, senderJid);
      }
    }
  }

  async searchKeywordAndReply(keyword, chatId) {
    const htmlDir = CONFIG.WHATSAPP.SAVE_DIR;
    try {
      const latestFile = getLatestHtmlFile(htmlDir);

      if (!latestFile) {
        await this.sock.sendMessage(chatId, { text: '⚠️ No saved HTML files found.' });
        return;
      }

      const htmlContent = fs.readFileSync(latestFile, 'utf-8');
      const $ = cheerio.load(htmlContent);
      const lowerKeyword = keyword.toLowerCase();

      let matchedTexts = [];
      let searchRoot = $('main');
      if (searchRoot.length === 0) {
        searchRoot = $('body'); // fallback if <main> not found
      }

      // Collect texts containing the keyword only from main content
      searchRoot.find('*').each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 5 && text.toLowerCase().includes(lowerKeyword)) {
          matchedTexts.push(text);
        }
      });

      if (matchedTexts.length === 0) {
        await this.sock.sendMessage(chatId, { text: `❌ Keyword "${keyword}" not found in latest HTML file.` });
      } else {
        const maxResults = 5;
        const responseText = matchedTexts.slice(0, maxResults).join('\n\n');
        await this.sock.sendMessage(chatId, {
          text: `✅ Found "${keyword}" in latest HTML file:\n\n${responseText}`
        });
      }
    } catch (err) {
      console.error('❌ Error in search:', err);
      await this.sock.sendMessage(chatId, { text: `❌ Error during search: ${err.message}` });
    }
  }
}

async function main() {
  const bot = new WhatsAppBot();
  await bot.start();
}

main().catch(console.error);

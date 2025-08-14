const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const readline = require('readline');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const GEMINI_API_KEY = 'AIzaSyCg6y_Zsyyb3q00ULTrjkQtzTq5TXz1pOs';
const ADMIN_ID = '2126xxxxxxxx@c.us'; // عوض هنا برقم الأدمن مع @c.us
const BLACKLIST = [];
const VOTE_THRESHOLD = 3;

const voteKicks = {}; // {warningMsgId: { target, votes:Set, timeout }}

async function isMessageToxic(text) {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: `هل هذه الرسالة تحتوي على كلام مسيء أو ضار؟ أجب بـ "نعم" أو "لا":\n"${text}"` }
            ]
          }
        ]
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const reply = response.data.candidates[0].content.parts[0].text.trim().toLowerCase();
    console.log('رد Gemini:', reply);
    return reply.includes('نعم');
  } catch (error) {
    console.error('خطأ في Gemini API:', error.response?.data || error.message);
    return false;
  }
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true }
});

client.on('qr', qr => {
  console.log('📱 سكان QR بهاتفك:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
  console.log('✅ البوت واجد!');

  const chats = await client.getChats();
  const groups = chats.filter(chat => chat.isGroup);

  if (groups.length === 0) {
    console.log('🚫 ماكينش جروبات.');
    process.exit(0);
  }

  groups.forEach((group, i) => {
    console.log(`${i + 1}. ${group.name}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('🔢 دخل رقم الجروب اللي بغيت تراقب: ', async (answer) => {
    const index = parseInt(answer) - 1;
    if (index >= 0 && index < groups.length) {
      const selectedGroup = groups[index];
      console.log(`👁️ تراقب الجروب: ${selectedGroup.name}`);

      client.on('message', async msg => {
        if (msg.from !== selectedGroup.id._serialized) return;

        const chat = await msg.getChat();
        const senderId = msg.author || msg.from;

        // 🚫 إذا العضو في بلاك ليست، طرده مباشرًا
        if (BLACKLIST.includes(senderId)) {
          try {
            await chat.removeParticipants([senderId]);
            console.log(`🚫 طرد تلقائي (بلاك ليست): ${senderId}`);
          } catch (e) {
            console.error('خطأ في طرد عضو بلاك ليست:', e.message);
          }
          return;
        }

        // --- تعامل مع أوامر التصويت ---

        // /agree للتصويت
        if (msg.body === '/agree') {
          // نلقى التصويت المفتوح اللي المستخدم ماصوتش فيه
          const lastVoteEntry = Object.entries(voteKicks).find(([id, vote]) => !vote.votes.has(senderId));
          if (!lastVoteEntry) {
            await chat.sendMessage('ℹ️ ماكينش تصويت نشط حالياً.');
            return;
          }
          const [warningMsgId, vote] = lastVoteEntry;
          vote.votes.add(senderId);
          await chat.sendMessage(`🗳️ صوتك تسجل! المجموع: ${vote.votes.size}/${VOTE_THRESHOLD}`);

          if (vote.votes.size >= VOTE_THRESHOLD) {
            clearTimeout(vote.timeout);
            delete voteKicks[warningMsgId];

            try {
              await chat.removeParticipants([vote.target]);
              BLACKLIST.push(vote.target);

              await chat.sendMessage(`🚫 تم طرد @${vote.target.split('@')[0]} بعد تصويت ناجح.`, {
                mentions: [await client.getContactById(vote.target)]
              });

              await client.sendMessage(ADMIN_ID, `🚨 عضو طُرد من الجروب "${selectedGroup.name}" بعد تصويت:\n\nالعضو: ${vote.target}\n`);

              fs.appendFileSync('log.txt', `⏱️ ${new Date().toISOString()} - طرد بعد تصويت: ${vote.target}\n`);
            } catch (e) {
              console.error('خطأ في طرد العضو بعد تصويت:', e.message);
            }
          }
          return;
        }

        // --- كشف الكلام المسيء ---
        const toxic = await isMessageToxic(msg.body);
        if (toxic) {
          // حذف الرسالة المسيئة
          try {
            await msg.delete(true);
          } catch (e) {
            console.error('خطأ في حذف الرسالة:', e.message);
          }

          // إرسال رسالة تحذيرية مع دعوة للتصويت
          const warningMessage = await chat.sendMessage(
            `🚨 *هذه الرسالة قد تكون مسيئة.* هل تريدون طرد المرسل @${senderId.split('@')[0]}؟\n\nإذا بغيتوه يخرج، كتبوا *\`/agree\`* خلال *3 دقائق*.`,
            {
              mentions: [await client.getContactById(senderId)],
              quotedMessageId: msg.id._serialized
            }
          );

          // بدء تصويت لمدة 3 دقائق
          voteKicks[warningMessage.id._serialized] = {
            target: senderId,
            votes: new Set(),
            timeout: setTimeout(async () => {
              delete voteKicks[warningMessage.id._serialized];
              await chat.sendMessage(`⏰ انتهى وقت التصويت لطرد @${senderId.split('@')[0]}.`, {
                mentions: [await client.getContactById(senderId)]
              });
            }, 3 * 60 * 1000) // 3 دقائق
          };

          console.log(`🚨 بدأ تصويت لطرد ${senderId}`);
          return;
        }

      });

    } else {
      console.log('❌ اختيار غير صالح.');
      process.exit(0);
    }
    rl.close();
  });
});

client.initialize();

// Test Discord Webhook
import { readFileSync } from 'fs';

// Read webhook URL from .env
const envFile = readFileSync('.env', 'utf8');
const webhookMatch = envFile.match(/DISCORD_WEBHOOK_URL="([^"]+)"/);
const webhookUrl = webhookMatch ? webhookMatch[1] : null;

if (!webhookUrl || webhookUrl.includes('REPLACE_ME')) {
  console.error('❌ DISCORD_WEBHOOK_URL not found or not configured in .env');
  process.exit(1);
}

const testMessage = {
  embeds: [
    {
      title: '🔥 Test Message - Bitcoin Hits New High!',
      description: '**📋 ประเด็นสำคัญ:**\n1. นี่คือข้อความทดสอบจากระบบ Crypto News Bot\n2. ถ้าคุณเห็นข้อความนี้ แสดงว่า webhook ทำงานได้!\n3. ระบบพร้อมใช้งานแล้ว',
      url: 'https://www.coindesk.com',
      color: 0x00ff00, // Green
      fields: [
        {
          name: '📊 Sentiment',
          value: '🟢 Bullish',
          inline: true,
        },
        {
          name: '💥 Impact',
          value: 'High',
          inline: true,
        },
        {
          name: '🏷️ Tags',
          value: '`BTC` `Test`',
          inline: true,
        },
      ],
      footer: {
        text: '📡 Test Message | Crypto News Bot',
      },
      timestamp: new Date().toISOString(),
    },
  ],
};

console.log('📤 Sending test message to Discord...');

fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testMessage),
})
  .then((response) => {
    if (response.ok) {
      console.log('✅ Test message sent successfully!');
      console.log('👉 Check your Discord channel');
    } else {
      return response.text().then((text) => {
        console.error('❌ Failed to send message');
        console.error('Status:', response.status);
        console.error('Response:', text);
      });
    }
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
  });

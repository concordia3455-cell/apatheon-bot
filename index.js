const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Apatheon Discord Gateway Test Aktif!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WEB] Port ${PORT} dinleniyor.`);
});

const TOKEN = process.env.BOT_TOKEN_1;

if (!TOKEN) {
  console.error('[HATA] BOT_TOKEN_1 bulunamadı!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

client.on('debug', (message) => {
  console.log('[DISCORD DEBUG]', message);
});

client.on('error', (error) => {
  console.error('[DISCORD ERROR]', error);
});

client.on('shardError', (error) => {
  console.error('[SHARD ERROR]', error);
});

client.on('shardReady', (id) => {
  console.log(`[SHARD] Shard ${id} hazır.`);
});

client.once('clientReady', () => {
  console.log('================================');
  console.log(`[BAŞARILI] ${client.user.tag} Discord'a bağlandı!`);
  console.log('================================');
});

console.log('[BOT] Discord Gateway login başlatılıyor...');

client.login(TOKEN)
  .then(() => {
    console.log('[BOT] login() tamamlandı.');
  })
  .catch((error) => {
    console.error('[BOT] LOGIN HATASI:', error);
  });

setTimeout(() => {
  console.log('[WATCHDOG] 60 saniye geçti.');
  console.log('[WATCHDOG] WebSocket durumu:', client.ws.status);
}, 60000);

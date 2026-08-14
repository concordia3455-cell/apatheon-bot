const express = require('express');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Apatheon Discord Gateway Identify Test');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WEB] Port ${PORT} dinleniyor.`);
});

const TOKEN = process.env.BOT_TOKEN_1;

if (!TOKEN) {
  console.error('[HATA] BOT_TOKEN_1 bulunamadı!');
  process.exit(1);
}

console.log('[TEST] Discord Gateway bağlantısı başlatılıyor...');

const ws = new WebSocket(
  'wss://gateway.discord.gg/?v=10&encoding=json'
);

let heartbeatTimer = null;

ws.on('open', () => {
  console.log('[WS] Gateway WebSocket açıldı.');
});

ws.on('message', (raw) => {
  try {
    const packet = JSON.parse(raw.toString());

    console.log('[WS] Gateway OP:', packet.op);

    // OP 10 = Hello
    if (packet.op === 10) {
      console.log('[WS] Gateway HELLO alındı.');

      const heartbeatInterval = packet.d.heartbeat_interval;

      heartbeatTimer = setInterval(() => {
        ws.send(JSON.stringify({
          op: 1,
          d: null
        }));

        console.log('[WS] Heartbeat gönderildi.');
      }, heartbeatInterval);

      // OP 2 = Identify
      const identify = {
        op: 2,
        d: {
          token: TOKEN,
          intents: 1,
          properties: {
            os: 'linux',
            browser: 'discord.js-test',
            device: 'discord.js-test'
          }
        }
      };

      console.log('[WS] IDENTIFY gönderiliyor...');

      ws.send(JSON.stringify(identify));
    }

    // OP 0 = Dispatch
    if (packet.op === 0) {
      console.log('[WS] DISPATCH:', packet.t);

      if (packet.t === 'READY') {
        console.log('======================================');
        console.log('[BAŞARILI] BOT GATEWAY READY!');
        console.log('[BAŞARILI] Kullanıcı:', packet.d.user.username);
        console.log('[BAŞARILI] Bot ID:', packet.d.user.id);
        console.log('======================================');

        clearInterval(heartbeatTimer);
      }
    }

    // OP 9 = Invalid Session
    if (packet.op === 9) {
      console.error('======================================');
      console.error('[HATA] INVALID SESSION');
      console.error('[HATA] Discord Gateway Identify reddetti.');
      console.error('======================================');

      clearInterval(heartbeatTimer);
    }

  } catch (error) {
    console.error('[WS] Mesaj parse hatası:', error);
  }
});

ws.on('error', (error) => {
  console.error('======================================');
  console.error('[WS] HATA:', error);
  console.error('======================================');
});

ws.on('close', (code, reason) => {
  console.log(
    `[WS] Bağlantı kapandı. Code=${code} Reason=${reason.toString()}`
  );

  clearInterval(heartbeatTimer);
});

setTimeout(() => {
  console.log('[TEST] 30 saniye geçti.');
  console.log('[TEST] Test tamamlandı.');
}, 30000);

const express = require('express');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Apatheon Gateway Network Test');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WEB] Port ${PORT} dinleniyor.`);
});

console.log('[TEST] Discord Gateway WebSocket bağlantısı deneniyor...');

const ws = new WebSocket(
  'wss://gateway.discord.gg/?v=10&encoding=json'
);

const timeout = setTimeout(() => {
  console.error('[WS TEST] 15 saniyede bağlantı kurulamadı.');
  console.error('[WS TEST] Sonuç: TIMEOUT');
  ws.close();
}, 15000);

ws.on('open', () => {
  clearTimeout(timeout);

  console.log('================================');
  console.log('[WS TEST] BAŞARILI!');
  console.log('[WS TEST] Discord Gateway WebSocket açıldı.');
  console.log('================================');

  ws.close();
});

ws.on('message', (data) => {
  console.log('[WS TEST] Gateway mesajı alındı:');
  console.log(data.toString());
});

ws.on('error', (error) => {
  clearTimeout(timeout);

  console.error('================================');
  console.error('[WS TEST] HATA!');
  console.error(error);
  console.error('================================');
});

ws.on('close', (code, reason) => {
  clearTimeout(timeout);

  console.log(
    `[WS TEST] Bağlantı kapandı. Code=${code} Reason=${reason.toString()}`
  );
});

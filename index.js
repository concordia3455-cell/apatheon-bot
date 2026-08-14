const express = require('express');
const { fork } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.status(200).send('Apatheon 4 Bot Sistemi Aktif!');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bots: 4
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WEB] Port ${PORT} dinleniyor.`);
});

const botFile = path.join(__dirname, 'bot.js');

const bots = [1, 2, 3, 4];
const processes = new Map();

function startBot(botId) {
  console.log(`[MAIN] Bot ${botId} başlatılıyor...`);

  const child = fork(botFile, [String(botId)], {
    env: process.env,
    stdio: 'inherit'
  });

  processes.set(botId, child);

  child.on('exit', (code, signal) => {
    console.log(
      `[MAIN] Bot ${botId} kapandı. code=${code} signal=${signal}`
    );

    processes.delete(botId);

    // 5 saniye sonra tekrar başlat
    setTimeout(() => {
      console.log(
        `[MAIN] Bot ${botId} yeniden başlatılıyor...`
      );
      startBot(botId);
    }, 5000);
  });

  child.on('error', (error) => {
    console.error(
      `[MAIN] Bot ${botId} process hatası:`,
      error
    );
  });
}

// Botları aralıklı başlat
bots.forEach((botId, index) => {
  setTimeout(() => {
    startBot(botId);
  }, index * 10000);
});

// Ana süreç kapanırken çocukları da kapat
function shutdown() {
  console.log('[MAIN] Kapatılıyor...');

  for (const [botId, child] of processes) {
    console.log(`[MAIN] Bot ${botId} kapatılıyor...`);

    try {
      child.kill();
    } catch {}
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

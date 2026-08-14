const { fork } = require('child_process');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Apatheon Bots are online!');
});

app.listen(port, () => {
  console.log(`[WEB SUNUCUSU] Port ${port} üzerinde dinleniyor.`);
});

const botFiles = ['bot1.js', 'bot2.js', 'bot3.js', 'bot4.js'];

botFiles.forEach((file) => {
  console.log(`[ANA YÖNETİCİ] ${file} başlatılıyor...`);

  const child = fork(`./${file}`, [], { silent: true });

  // Botun gönderdiği normal logları ekrana bas
  child.stdout.on('data', (data) => {
    console.log(`[${file} LOG]: ${data.toString().trim()}`);
  });

  // BOT HATA VERİRSE KESİN OLARAK EKRANA YAZDIR
  child.stderr.on('data', (data) => {
    console.error(`[${file} HATA]: ${data.toString().trim()}`);
  });

  child.on('exit', (code) => {
    console.log(`[ANA YÖNETİCİ] ${file} kapandı (Kod: ${code})`);
  });
});

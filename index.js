const { fork } = require('child_process');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Render'ın aradığı web sunucusu (Port açarak Render'ı kandırıyoruz)
app.get('/', (req, res) => {
  res.send('Apatheon Bots are online!');
});

app.listen(PORT, () => {
  console.log(`[WEB] Sunucu ${PORT} portunda aktif!`);
});

// 4 Botu aynı anda arka planda çalıştıran kısım
const botFiles = ['bot1.js', 'bot2.js', 'bot3.js', 'bot4.js'];

botFiles.forEach((file) => {
  console.log(`[ANA YÖNETİCİ] ${file} başlatılıyor...`);
  
  const child = fork(`./${file}`);

  child.on('exit', (code) => {
    console.log(`[ANA YÖNETİCİ] ${file} kapandı (Kod: ${code})`);
  });
});

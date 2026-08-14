const { spawn } = require('child_process');
const express = require('express');

const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => res.send('Apatheon Ses Botları Aktif!'));
app.listen(port, () => console.log(`[SUNUCU] Port ${port} hazır.`));

const bots = ['bot1.js', 'bot2.js', 'bot3.js', 'bot4.js'];

bots.forEach((file, index) => {
  setTimeout(() => {
    console.log(`[BAŞLATILIYOR] ${file}...`);
    
    // env: process.env ekleyerek Render değişkenlerini botlara geçiriyoruz!
    spawn('node', [file], { 
      stdio: 'inherit',
      env: process.env 
    });

  }, index * 2000);
});

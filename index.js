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
    
    // stdio: 'inherit' yerine pipe ve event dinleyicisi ekleyerek logları Render konsoluna zorla basıyoruz
    const child = spawn('node', [file], { 
      env: process.env 
    });

    child.stdout.on('data', (data) => {
      console.log(`[${file} MESAJS]: ${data.toString().trim()}`);
    });

    child.stderr.on('data', (data) => {
      console.error(`[${file} HATA]: ${data.toString().trim()}`);
    });

    child.on('close', (code) => {
      console.log(`[${file}] kapandı! Çıkış kodu: ${code}`);
    });

  }, index * 2000);
});

const { spawn } = require('child_process');
const express = require('express');

const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Apatheon Bot Sistemleri Canlı!');
});

app.listen(port, () => {
    console.log(`[WEB SUNUCUSU] Port ${port} üzerinde dinleniyor.`);
});

const botFiles = ['bot1.js', 'bot2.js', 'bot3.js', 'bot4.js'];

// Botları 3'er saniye arayla başlatıyoruz ki Discord Gateway ağ kilitlenmesi yaşamasın
botFiles.forEach((file, index) => {
    setTimeout(() => {
        console.log(`[ANA YÖNETİCİ] ${file} başlatılıyor...`);
        
        // spawn kullanarak tüm logları ve hataları CANLI olarak Render konsoluna aktarıyoruz
        const child = spawn('node', [file], { stdio: 'inherit' });

        child.on('exit', (code) => {
            console.log(`[ANA YÖNETİCİ] ${file} kapandı (Kod: ${code})`);
        });
    }, index * 3000);
});

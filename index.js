const { fork } = require('child_process');

const botFiles = ['bot1.js', 'bot2.js', 'bot3.js', 'bot4.js'];

botFiles.forEach((file) => {
  console.log(`[ANA YÖNETİCİ] ${file} başlatılıyor...`);
  
  const child = fork(`./${file}`);

  child.on('exit', (code) => {
    console.log(`[ANA YÖNETİCİ] ${file} kapandı (Kod: ${code})`);
  });
});

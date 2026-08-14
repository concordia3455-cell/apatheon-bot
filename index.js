const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.status(200).send('Apatheon Discord Voice Test Aktif!');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WEB] Port ${PORT} dinleniyor.`);
});

const TOKEN = process.env.BOT_TOKEN_1;
const GUILD_ID = '1230989327958282340';
const CHANNEL_ID = '1536592721324548196';

console.log('[ENV] BOT_TOKEN_1:', TOKEN ? 'VAR' : 'YOK');
console.log('[ENV] GUILD_ID:', GUILD_ID);
console.log('[ENV] BOT_CHANNEL_1:', CHANNEL_ID);

if (!TOKEN) {
  console.error('[HATA] BOT_TOKEN_1 Render Variables içinde yok!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.on('error', (error) => {
  console.error('[BOT ERROR]', error);
});

client.on('debug', (message) => {
  console.log('[DISCORD DEBUG]', message);
});

client.once('clientReady', async () => {
  console.log(`[BOT] ${client.user.tag} giriş yaptı!`);

  client.user.setPresence({
    activities: [
      {
        name: 'Apatheon UDP Voice Test',
        type: ActivityType.Playing
      }
    ],
    status: 'online'
  });

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    console.log(`[TEST] Sunucu bulundu: ${guild.name}`);

    const channel = await guild.channels.fetch(CHANNEL_ID);

    if (!channel) {
      throw new Error('Ses kanalı bulunamadı!');
    }

    console.log(`[TEST] Kanal bulundu: ${channel.name}`);
    console.log('[VOICE] Bağlantı başlatılıyor...');

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    connection.on('stateChange', (oldState, newState) => {
      console.log(
        `[VOICE] ${oldState.status} -> ${newState.status}`
      );
    });

    connection.on('error', (error) => {
      console.error('[VOICE ERROR]', error);
    });

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      30000
    );

    console.log('================================');
    console.log('[VOICE] BAŞARILI!');
    console.log('[VOICE] Bot ses kanalında.');
    console.log('================================');

  } catch (error) {
    console.error('[VOICE] BAŞARISIZ!');
    console.error('[VOICE]', error);
  }
});

console.log('[BOT] Discord login başlatılıyor...');

client.login(TOKEN)
  .then(() => {
    console.log('[BOT] login() başarılı şekilde tamamlandı.');
  })
  .catch((error) => {
    console.error('[BOT] LOGIN HATASI:', error);
  });

setTimeout(() => {
  console.log('[WATCHDOG] 60 saniye geçti. Discord bağlantı durumu:',
    client.ws.status
  );
}, 60000);

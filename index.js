const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
} = require('@discordjs/voice');

const app = express();
const PORT = process.env.PORT || 10000;

// Web servis
app.get('/', (req, res) => {
  res.status(200).send('Apatheon Discord Voice Test Aktif!');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    bot: 'Apatheon',
    voiceTest: true
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WEB] Port ${PORT} dinleniyor.`);
});

// ===============================
// RENDER ENVIRONMENT VARIABLES
// ===============================

const TOKEN = process.env.BOT_TOKEN_1;

// Sabit sunucu ve kanal bilgileri
const GUILD_ID = '1230989327958282340';
const CHANNEL_ID = '1536592721324548196';

// ===============================
// KONTROLLER
// ===============================

if (!TOKEN) {
  console.error('[HATA] BOT_TOKEN_1 Render Variables bölümünde bulunamadı!');
  process.exit(1);
}

console.log('[TEST] Sunucu ID:', GUILD_ID);
console.log('[TEST] Ses Kanalı ID:', CHANNEL_ID);

// ===============================
// DISCORD CLIENT
// ===============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.once('clientReady', async () => {
  console.log(`[BOT] ${client.user.tag} giriş yaptı.`);

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

    console.log(
      `[TEST] Sunucu bulundu: ${guild.name} (${guild.id})`
    );

    const channel = await guild.channels.fetch(CHANNEL_ID);

    if (!channel) {
      throw new Error('Ses kanalı bulunamadı.');
    }

    console.log(
      `[TEST] Kanal bulundu: ${channel.name} (${channel.id})`
    );

    if (!channel.isVoiceBased()) {
      throw new Error('Belirtilen kanal bir ses kanalı değil.');
    }

    console.log('[TEST] Voice bağlantısı başlatılıyor...');

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    connection.on('stateChange', (oldState, newState) => {
      console.log(
        `[VOICE] durum: ${oldState.status} -> ${newState.status}`
      );
    });

    connection.on('error', (error) => {
      console.error('[VOICE] Bağlantı hatası:', error);
    });

    try {
      await entersState(
        connection,
        VoiceConnectionStatus.Ready,
        30000
      );

      console.log('========================================');
      console.log('[VOICE] BAŞARILI!');
      console.log('[VOICE] Bot ses kanalında READY.');
      console.log('========================================');

    } catch (error) {
      console.error('[VOICE] READY OLAMADI!');
      console.error('[VOICE] Hata:', error);

      connection.destroy();
    }

  } catch (error) {
    console.error('[TEST] Genel hata:', error);
  }
});

client.on('error', (error) => {
  console.error('[BOT] Discord Client hatası:', error);
});

client.login(TOKEN).catch((error) => {
  console.error('[BOT] Discord giriş hatası:', error);
});

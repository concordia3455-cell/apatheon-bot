const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');

const app = express();
const PORT = process.env.PORT || 10000;

// ======================================
// RENDER WEB SERVER
// ======================================

app.get('/', (req, res) => {
  res.status(200).send('Apatheon Discord Voice Test Aktif!');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'apatheon-voice-test'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WEB] Port ${PORT} dinleniyor.`);
});

// ======================================
// AYARLAR
// ======================================

const TOKEN = process.env.BOT_TOKEN_1;

const GUILD_ID = '1230989327958282340';
const CHANNEL_ID = '1536592721324548196';

console.log('======================================');
console.log('[ENV] BOT_TOKEN_1:', TOKEN ? 'VAR' : 'YOK');
console.log('[ENV] GUILD_ID:', GUILD_ID);
console.log('[ENV] BOT_CHANNEL_1:', CHANNEL_ID);
console.log('======================================');

if (!TOKEN) {
  console.error('[HATA] BOT_TOKEN_1 bulunamadı!');
  process.exit(1);
}

// ======================================
// DISCORD CLIENT
// ======================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ======================================
// DISCORD LOG
// ======================================

client.on('debug', (message) => {
  console.log('[DISCORD DEBUG]', message);
});

client.on('warn', (message) => {
  console.warn('[DISCORD WARN]', message);
});

client.on('error', (error) => {
  console.error('[DISCORD ERROR]', error);
});

client.on('shardReady', (id) => {
  console.log(`[SHARD] Shard ${id} hazır.`);
});

client.on('shardError', (error) => {
  console.error('[SHARD ERROR]', error);
});

// ======================================
// DISCORD HAZIR
// ======================================

client.once('clientReady', async () => {
  console.log('======================================');
  console.log(`[BOT] ${client.user.tag} Discord'a giriş yaptı!`);
  console.log('[BOT] Gateway bağlantısı başarılı.');
  console.log('======================================');

  try {
    // SUNUCUYU BUL
    console.log('[TEST] Sunucu aranıyor...');

    const guild = await client.guilds.fetch(GUILD_ID);

    console.log(
      `[TEST] Sunucu bulundu: ${guild.name} (${guild.id})`
    );

    // KANALI BUL
    console.log('[TEST] Ses kanalı aranıyor...');

    const channel = await guild.channels.fetch(CHANNEL_ID);

    if (!channel) {
      throw new Error('Ses kanalı bulunamadı!');
    }

    console.log(
      `[TEST] Kanal bulundu: ${channel.name} (${channel.id})`
    );

    if (!channel.isVoiceBased()) {
      throw new Error('Bu kanal bir ses kanalı değil!');
    }

    // ==================================
    // VOICE BAĞLANTISI
    // ==================================

    console.log('[VOICE] Ses bağlantısı başlatılıyor...');

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });

    connection.on('stateChange', (oldState, newState) => {
      console.log(
        `[VOICE] Durum: ${oldState.status} -> ${newState.status}`
      );
    });

    connection.on('error', (error) => {
      console.error('[VOICE ERROR]', error);
    });

    console.log('[VOICE] READY bekleniyor...');

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      30000
    );

    console.log('======================================');
    console.log('[VOICE] BAŞARILI!');
    console.log('[VOICE] Bot ses kanalında READY.');
    console.log('======================================');

  } catch (error) {
    console.error('======================================');
    console.error('[TEST] HATA OLUŞTU!');
    console.error('[TEST]', error?.message || error);
    console.error('======================================');
  }
});

// ======================================
// LOGIN
// ======================================

console.log('[BOT] Discord login başlatılıyor...');

client.login(TOKEN)
  .then(() => {
    console.log('[BOT] client.login() tamamlandı.');
  })
  .catch((error) => {
    console.error('======================================');
    console.error('[BOT] LOGIN HATASI');
    console.error(error);
    console.error('======================================');
  });

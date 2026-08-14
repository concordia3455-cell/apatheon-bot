const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');

// ==========================================
// SÜRÜM KONTROLÜ
// ==========================================

console.log('==========================================');
console.log('[VERSION] Node:', process.version);

try {
  console.log(
    '[VERSION] discord.js:',
    require('discord.js').version
  );
} catch (error) {
  console.error('[VERSION] discord.js okunamadı:', error);
}

try {
  console.log(
    '[VERSION] @discordjs/voice:',
    require('@discordjs/voice/package.json').version
  );
} catch (error) {
  console.error('[VERSION] @discordjs/voice okunamadı:', error);
}

console.log('==========================================');

// ==========================================
// WEB SERVER - RENDER
// ==========================================

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.status(200).send('Apatheon Discord Voice Test Aktif!');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'apatheon-discord-voice-test',
    bot: 'BOT 1',
    node: process.version
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WEB] Port ${PORT} dinleniyor.`);
});

// ==========================================
// AYARLAR
// ==========================================

const TOKEN = process.env.BOT_TOKEN_1;

// Senin mevcut sunucu ID'n
const GUILD_ID = '1230989327958282340';

// Senin Bot 1 ses kanalı ID'n
const CHANNEL_ID = '1536592721324548196';

console.log('==========================================');
console.log('[ENV] BOT_TOKEN_1:', TOKEN ? 'VAR' : 'YOK');
console.log('[ENV] GUILD_ID:', GUILD_ID);
console.log('[ENV] BOT_CHANNEL_1:', CHANNEL_ID);
console.log('==========================================');

if (!TOKEN) {
  console.error(
    '[HATA] BOT_TOKEN_1 Render Environment Variables bölümünde bulunamadı!'
  );
  process.exit(1);
}

// ==========================================
// DISCORD CLIENT
// ==========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ==========================================
// DISCORD DEBUG
// ==========================================

client.on('debug', (message) => {
  console.log('[DISCORD DEBUG]', message);
});

client.on('warn', (message) => {
  console.warn('[DISCORD WARN]', message);
});

client.on('error', (error) => {
  console.error('[DISCORD ERROR]', error);
});

client.on('shardError', (error) => {
  console.error('[SHARD ERROR]', error);
});

client.on('shardReady', (id) => {
  console.log(`[SHARD] Shard ${id} hazır.`);
});

client.on('shardDisconnect', (event, id) => {
  console.error(
    `[SHARD] Shard ${id} bağlantısı kesildi.`,
    event
  );
});

// ==========================================
// DISCORD HAZIR OLDU
// ==========================================

client.once('clientReady', async () => {
  console.log('==========================================');
  console.log(`[BOT] ${client.user.tag} giriş yaptı!`);
  console.log('[BOT] Discord Gateway bağlantısı BAŞARILI.');
  console.log('==========================================');

  client.user.setPresence({
    activities: [
      {
        name: 'Apatheon UDP Voice Test',
        type: 0
      }
    ],
    status: 'online'
  });

  try {
    // ========================================
    // SUNUCU
    // ========================================

    console.log('[TEST] Sunucu aranıyor...');

    const guild = await client.guilds.fetch(GUILD_ID);

    console.log(
      `[TEST] Sunucu bulundu: ${guild.name} (${guild.id})`
    );

    // ========================================
    // SES KANALI
    // ========================================

    console.log('[TEST] Ses kanalı aranıyor...');

    const channel = await guild.channels.fetch(CHANNEL_ID);

    if (!channel) {
      throw new Error('Ses kanalı bulunamadı!');
    }

    console.log(
      `[TEST] Kanal bulundu: ${channel.name} (${channel.id})`
    );

    if (!channel.isVoiceBased()) {
      throw new Error(
        'BOT_CHANNEL_1 bir ses kanalı değil!'
      );
    }

    // ========================================
    // VOICE BAĞLANTISI
    // ========================================

    console.log('[VOICE] Voice bağlantısı başlatılıyor...');

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
      console.error(
        '[VOICE ERROR]',
        error
      );
    });

    // ========================================
    // READY BEKLE
    // ========================================

    console.log(
      '[VOICE] Ready durumu bekleniyor (30 saniye)...'
    );

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      30000
    );

    console.log('==========================================');
    console.log('[VOICE] BAŞARILI!');
    console.log('[VOICE] Bot ses kanalında READY.');
    console.log('==========================================');

  } catch (error) {
    console.error('==========================================');
    console.error('[VOICE] BAŞARISIZ!');
    console.error(
      '[VOICE] Hata:',
      error?.message || error
    );
    console.error('==========================================');
  }
});

// ==========================================
// LOGIN
// ==========================================

console.log('[BOT] Discord Gateway login başlatılıyor...');

client.login(TOKEN)
  .then(() => {
    console.log('[BOT] client.login() tamamlandı.');
  })
  .catch((error) => {
    console.error('==========================================');
    console.error('[BOT] LOGIN HATASI');
    console.error(error);
    console.error('==========================================');
  });

// ==========================================
// WATCHDOG
// ==========================================

setTimeout(() => {
  console.log('==========================================');
  console.log('[WATCHDOG] 60 saniye geçti.');
  console.log('[WATCHDOG] WebSocket durumu:', client.ws.status);
  console.log(
    '[WATCHDOG] Kullanıcı:',
    client.user ? client.user.tag : 'YOK'
  );
  console.log('==========================================');
}, 60000);

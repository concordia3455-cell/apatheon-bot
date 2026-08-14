const express = require('express');
const WebSocket = require('ws');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.status(200).send('Apatheon Raw Gateway Voice Test Aktif!');
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'apatheon-raw-gateway-voice'
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

if (!TOKEN) {
  console.error('[HATA] BOT_TOKEN_1 bulunamadı!');
  process.exit(1);
}

console.log('======================================');
console.log('[TEST] Raw Discord Gateway + Voice');
console.log('[TEST] GUILD:', GUILD_ID);
console.log('[TEST] CHANNEL:', CHANNEL_ID);
console.log('======================================');

// ======================================
// RAW DISCORD GATEWAY
// ======================================

const ws = new WebSocket(
  'wss://gateway.discord.gg/?v=10&encoding=json'
);

let heartbeatTimer = null;
let sequence = null;
let sessionId = null;
let botUserId = null;

// Voice adapterlarını burada tutuyoruz.
const voiceAdapters = new Map();

// ======================================
// CUSTOM VOICE ADAPTER
// ======================================

function createAdapterCreator() {
  return (methods) => {
    const adapter = {
      sendPayload(payload) {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('[ADAPTER] Gateway bağlı değil.');
          return false;
        }

        try {
          ws.send(JSON.stringify(payload));
          console.log(
            `[GATEWAY OUT] OP=${payload.op}`
          );
          return true;
        } catch (error) {
          console.error(
            '[ADAPTER] Payload gönderilemedi:',
            error
          );
          return false;
        }
      },

      destroy() {
        console.log('[ADAPTER] Voice adapter yok edildi.');
      }
    };

    voiceAdapters.set(GUILD_ID, {
      methods,
      adapter
    });

    console.log('[ADAPTER] Voice adapter oluşturuldu.');

    return adapter;
  };
}

// ======================================
// GATEWAY MESAJLARI
// ======================================

ws.on('open', () => {
  console.log('[GATEWAY] WebSocket açıldı.');
});

ws.on('message', async (raw) => {
  let packet;

  try {
    packet = JSON.parse(raw.toString());
  } catch (error) {
    console.error('[GATEWAY] JSON parse hatası:', error);
    return;
  }

  if (packet.s !== null && packet.s !== undefined) {
    sequence = packet.s;
  }

  console.log(
    `[GATEWAY IN] OP=${packet.op} EVENT=${packet.t || '-'}`
  );

  // ====================================
  // HELLO
  // ====================================

  if (packet.op === 10) {
    console.log('[GATEWAY] HELLO alındı.');

    heartbeatTimer = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) return;

      ws.send(JSON.stringify({
        op: 1,
        d: sequence
      }));

      console.log('[GATEWAY] Heartbeat gönderildi.');
    }, packet.d.heartbeat_interval);

    // IDENTIFY
    ws.send(JSON.stringify({
      op: 2,
      d: {
        token: TOKEN,
        intents: 129,
        properties: {
          os: 'linux',
          browser: 'apatheon-raw',
          device: 'apatheon-raw'
        },
        presence: {
          since: 0,
          activities: [
            {
              name: 'Apatheon Profesyonel Hizmet',
              type: 0
            }
          ],
          status: 'online',
          afk: false
        }
      }
    }));

    console.log('[GATEWAY] IDENTIFY gönderildi.');
  }

  // ====================================
  // DISPATCH
  // ====================================

  if (packet.op === 0) {
    // READY
    if (packet.t === 'READY') {
      sessionId = packet.d.session_id;
      botUserId = packet.d.user.id;

      console.log('======================================');
      console.log('[BOT] READY!');
      console.log('[BOT] Kullanıcı:', packet.d.user.username);
      console.log('[BOT] ID:', botUserId);
      console.log('[BOT] Sunucu sayısı:', packet.d.guilds.length);
      console.log('======================================');

      // Voice bağlantısını başlat
      setTimeout(startVoiceConnection, 1000);
    }

    // VOICE_STATE_UPDATE
    if (packet.t === 'VOICE_STATE_UPDATE') {
      const data = packet.d;

      if (data.guild_id === GUILD_ID) {
        console.log(
          `[VOICE STATE] user=${data.user_id} channel=${data.channel_id}`
        );

        const entry = voiceAdapters.get(data.guild_id);

        if (entry) {
          entry.methods.onVoiceStateUpdate(data);
        }
      }
    }

    // VOICE_SERVER_UPDATE
    if (packet.t === 'VOICE_SERVER_UPDATE') {
      const data = packet.d;

      if (data.guild_id === GUILD_ID) {
        console.log(
          `[VOICE SERVER] endpoint=${data.endpoint}`
        );

        const entry = voiceAdapters.get(data.guild_id);

        if (entry) {
          entry.methods.onVoiceServerUpdate(data);
        }
      }
    }
  }
});

// ======================================
// VOICE BAĞLANTISI
// ======================================

async function startVoiceConnection() {
  try {
    console.log('[VOICE] Bağlantı başlatılıyor...');

    const connection = joinVoiceChannel({
      channelId: CHANNEL_ID,
      guildId: GUILD_ID,
      adapterCreator: createAdapterCreator(),
      selfDeaf: true,
      selfMute: true,
      debug: true
    });

    connection.on('stateChange', (oldState, newState) => {
      console.log(
        `[VOICE] ${oldState.status} -> ${newState.status}`
      );
    });

    connection.on('error', (error) => {
      console.error('[VOICE ERROR]', error);
    });

    console.log(
      '[VOICE] VoiceConnectionStatus.Ready bekleniyor...'
    );

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      30000
    );

    console.log('======================================');
    console.log('[VOICE] BAŞARILI!');
    console.log('[VOICE] BOT SES KANALINDA READY!');
    console.log('======================================');

  } catch (error) {
    console.error('======================================');
    console.error('[VOICE] BAŞARISIZ!');
    console.error(
      '[VOICE]',
      error?.message || error
    );
    console.error('======================================');
  }
}

// ======================================
// GATEWAY HATALARI
// ======================================

ws.on('error', (error) => {
  console.error('[GATEWAY ERROR]', error);
});

ws.on('close', (code, reason) => {
  console.error(
    `[GATEWAY] Bağlantı kapandı. Code=${code} Reason=${reason.toString()}`
  );

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  for (const entry of voiceAdapters.values()) {
    try {
      entry.methods.destroy();
    } catch {}
  }
});

// ======================================
// WATCHDOG
// ======================================

setTimeout(() => {
  console.log('======================================');
  console.log('[WATCHDOG] 60 saniye geçti.');
  console.log('[WATCHDOG] Gateway:', ws.readyState);
  console.log('[WATCHDOG] Session:', sessionId ? 'VAR' : 'YOK');
  console.log('[WATCHDOG] Bot ID:', botUserId || 'YOK');
  console.log('======================================');
}, 60000);

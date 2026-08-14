const WebSocket = require('ws');

const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');

const botId = Number(process.argv[2]);

if (![1, 2, 3, 4].includes(botId)) {
  console.error('[BOT] Geçersiz bot ID:', botId);
  process.exit(1);
}

const TOKEN = process.env[`BOT_TOKEN_${botId}`];

const CHANNEL_ID =
  process.env[`BOT_CHANNEL_${botId}`] ||
  {
    1: '1536592721324548196',
    2: '1536592754828902500',
    3: '1536592790925082724',
    4: '1536592811187638332'
  }[botId];

const GUILD_ID = '1230989327958282340';

console.log('');
console.log('==========================================');
console.log(`[BOT ${botId}] BAŞLIYOR`);
console.log(`[BOT ${botId}] Kanal: ${CHANNEL_ID}`);
console.log(
  `[BOT ${botId}] Token: ${TOKEN ? 'VAR' : 'YOK'}`
);
console.log('==========================================');

if (!TOKEN) {
  console.error(
    `[BOT ${botId}] BOT_TOKEN_${botId} bulunamadı!`
  );
  process.exit(1);
}

// ==========================================
// DURUM
// ==========================================

let ws = null;
let heartbeatTimer = null;
let sequence = null;
let sessionId = null;
let userId = null;
let userName = null;

let voiceConnection = null;
let voiceMethods = null;

// ==========================================
// GATEWAY
// ==========================================

function connectGateway() {
  console.log(
    `[BOT ${botId}] Gateway bağlanıyor...`
  );

  ws = new WebSocket(
    'wss://gateway.discord.gg/?v=10&encoding=json'
  );

  ws.on('open', () => {
    console.log(
      `[BOT ${botId}] Gateway WebSocket açıldı.`
    );
  });

  ws.on('message', (raw) => {
    let packet;

    try {
      packet = JSON.parse(raw.toString());
    } catch (error) {
      console.error(
        `[BOT ${botId}] JSON hatası:`,
        error
      );
      return;
    }

    if (
      packet.s !== null &&
      packet.s !== undefined
    ) {
      sequence = packet.s;
    }

    // ========================================
    // HELLO
    // ========================================

    if (packet.op === 10) {
      console.log(
        `[BOT ${botId}] Gateway HELLO alındı.`
      );

      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }

      heartbeatTimer = setInterval(() => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          return;
        }

        ws.send(
          JSON.stringify({
            op: 1,
            d: sequence
          })
        );
      }, packet.d.heartbeat_interval);

      // IDENTIFY
      ws.send(
        JSON.stringify({
          op: 2,
          d: {
            token: TOKEN,
            intents: 129,
            properties: {
              os: 'linux',
              browser: 'apatheon',
              device: 'apatheon'
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
        })
      );

      console.log(
        `[BOT ${botId}] IDENTIFY gönderildi.`
      );

      return;
    }

    // ========================================
    // INVALID SESSION
    // ========================================

    if (packet.op === 9) {
      console.error(
        `[BOT ${botId}] INVALID SESSION`
      );

      return;
    }

    // ========================================
    // DISPATCH
    // ========================================

    if (packet.op !== 0) {
      return;
    }

    // ========================================
    // READY
    // ========================================

    if (packet.t === 'READY') {
      sessionId = packet.d.session_id;
      userId = packet.d.user.id;
      userName = packet.d.user.username;

      console.log('');
      console.log(
        '=========================================='
      );
      console.log(
        `[BOT ${botId}] READY`
      );
      console.log(
        `[BOT ${botId}] Kullanıcı: ${userName}`
      );
      console.log(
        `[BOT ${botId}] ID: ${userId}`
      );
      console.log(
        '=========================================='
      );
      console.log('');

      setTimeout(() => {
        startVoice();
      }, 2000);

      return;
    }

    // ========================================
    // SADECE KENDİ VOICE STATE
    // ========================================

    if (packet.t === 'VOICE_STATE_UPDATE') {
      const data = packet.d;

      if (data.guild_id !== GUILD_ID) {
        return;
      }

      if (data.user_id !== userId) {
        return;
      }

      console.log(
        `[BOT ${botId}] KENDİ VOICE STATE -> ` +
        `channel=${data.channel_id}`
      );

      if (voiceMethods) {
        voiceMethods.onVoiceStateUpdate(data);
      }

      return;
    }

    // ========================================
    // VOICE SERVER UPDATE
    // ========================================

    if (packet.t === 'VOICE_SERVER_UPDATE') {
      const data = packet.d;

      if (data.guild_id !== GUILD_ID) {
        return;
      }

      console.log(
        `[BOT ${botId}] VOICE SERVER -> ` +
        `${data.endpoint}`
      );

      if (voiceMethods) {
        voiceMethods.onVoiceServerUpdate(data);
      }

      return;
    }
  });

  ws.on('error', (error) => {
    console.error(
      `[BOT ${botId}] Gateway ERROR:`,
      error
    );
  });

  ws.on('close', (code, reason) => {
    console.log(
      `[BOT ${botId}] Gateway kapandı. ` +
      `code=${code} reason=${reason.toString()}`
    );

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    if (voiceConnection) {
      try {
        voiceConnection.destroy();
      } catch {}

      voiceConnection = null;
    }

    setTimeout(() => {
      connectGateway();
    }, 5000);
  });
}

// ==========================================
// CUSTOM VOICE ADAPTER
// ==========================================

function createVoiceAdapter() {
  return (methods) => {
    voiceMethods = methods;

    return {
      sendPayload(payload) {
        if (
          !ws ||
          ws.readyState !== WebSocket.OPEN
        ) {
          console.error(
            `[BOT ${botId}] Gateway açık değil.`
          );

          return false;
        }

        try {
          ws.send(
            JSON.stringify(payload)
          );

          console.log(
            `[BOT ${botId}] GATEWAY OUT -> OP=${payload.op}`
          );

          return true;
        } catch (error) {
          console.error(
            `[BOT ${botId}] Voice payload hatası:`,
            error
          );

          return false;
        }
      },

      destroy() {
        console.log(
          `[BOT ${botId}] Voice adapter kapandı.`
        );

        voiceMethods = null;
      }
    };
  };
}

// ==========================================
// VOICE
// ==========================================

async function startVoice() {
  console.log('');
  console.log(
    `[BOT ${botId}] Voice bağlanıyor...`
  );
  console.log(
    `[BOT ${botId}] Kanal=${CHANNEL_ID}`
  );

  try {
    const connection = joinVoiceChannel({
      channelId: CHANNEL_ID,
      guildId: GUILD_ID,
      adapterCreator: createVoiceAdapter(),
      selfDeaf: true,
      selfMute: true,
      debug: true
    });

    voiceConnection = connection;

    connection.on(
      'stateChange',
      (oldState, newState) => {
        console.log(
          `[BOT ${botId}] [VOICE] ` +
          `${oldState.status} -> ${newState.status}`
        );
      }
    );

    connection.on(
      'error',
      (error) => {
        console.error(
          `[BOT ${botId}] [VOICE ERROR]`,
          error
        );
      }
    );

    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      30000
    );

    console.log('');
    console.log(
      '=========================================='
    );
    console.log(
      `[BOT ${botId}] VOICE BAŞARILI!`
    );
    console.log(
      `[BOT ${botId}] KANALDA BEKLİYOR!`
    );
    console.log(
      '=========================================='
    );
    console.log('');

  } catch (error) {
    console.error('');
    console.error(
      `[BOT ${botId}] VOICE HATASI:`,
      error?.message || error
    );
    console.error('');

    if (voiceConnection) {
      try {
        voiceConnection.destroy();
      } catch {}
    }

    voiceConnection = null;
  }
}

// ==========================================
// BAŞLAT
// ==========================================

connectGateway();

// ==========================================
// WATCHDOG
// ==========================================

setInterval(() => {
  console.log(
    `[BOT ${botId}] WATCHDOG -> ` +
    `user=${userName || 'YOK'} ` +
    `voice=${voiceConnection?.state?.status || 'YOK'} ` +
    `channel=${CHANNEL_ID}`
  );
}, 60000);

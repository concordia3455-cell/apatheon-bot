const express = require('express');
const WebSocket = require('ws');
const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');

// =====================================================
// WEB SERVER
// =====================================================

const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.status(200).send('Apatheon 4 Bot Voice System Aktif!');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'apatheon-4-bot-voice'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WEB] Port ${PORT} dinleniyor.`);
});

// =====================================================
// SUNUCU
// =====================================================

const GUILD_ID = '1230989327958282340';

// =====================================================
// BOT AYARLARI
// =====================================================

const botConfigs = [
  {
    id: 1,
    token: process.env.BOT_TOKEN_1,
    channelId:
      process.env.BOT_CHANNEL_1 ||
      '1536592721324548196'
  },
  {
    id: 2,
    token: process.env.BOT_TOKEN_2,
    channelId:
      process.env.BOT_CHANNEL_2 ||
      '1536592754828902500'
  },
  {
    id: 3,
    token: process.env.BOT_TOKEN_3,
    channelId:
      process.env.BOT_CHANNEL_3 ||
      '1536592811187638332'
  },
  {
    id: 4,
    token: process.env.BOT_TOKEN_4,
    channelId:
      process.env.BOT_CHANNEL_4 ||
      '1536592811187638332'
  }
];

// =====================================================
// BOT DURUMLARI
// =====================================================

const botStates = new Map();

// =====================================================
// BOT BAŞLAT
// =====================================================

function startBot(config) {
  const {
    id,
    token,
    channelId
  } = config;

  console.log('');
  console.log('================================================');
  console.log(`[BOT ${id}] BAŞLATILIYOR`);
  console.log(`[BOT ${id}] Kanal: ${channelId}`);
  console.log('================================================');

  if (!token) {
    console.error(
      `[BOT ${id}] HATA: BOT_TOKEN_${id} bulunamadı!`
    );
    return;
  }

  const state = {
    id,
    token,
    channelId,

    ws: null,
    heartbeatTimer: null,
    sequence: null,

    sessionId: null,
    userId: null,
    userName: null,

    voiceAdapter: null,
    voiceMethods: null,
    voiceConnection: null
  };

  botStates.set(id, state);

  // ===================================================
  // DISCORD GATEWAY
  // ===================================================

  const ws = new WebSocket(
    'wss://gateway.discord.gg/?v=10&encoding=json'
  );

  state.ws = ws;

  // ===================================================
  // GATEWAY AÇILDI
  // ===================================================

  ws.on('open', () => {
    console.log(
      `[BOT ${id}] Gateway WebSocket açıldı.`
    );
  });

  // ===================================================
  // GATEWAY MESAJLARI
  // ===================================================

  ws.on('message', async (raw) => {
    let packet;

    try {
      packet = JSON.parse(raw.toString());
    } catch (error) {
      console.error(
        `[BOT ${id}] Gateway JSON hatası:`,
        error
      );
      return;
    }

    // Sequence
    if (
      packet.s !== null &&
      packet.s !== undefined
    ) {
      state.sequence = packet.s;
    }

    // =================================================
    // HELLO
    // =================================================

    if (packet.op === 10) {
      console.log(
        `[BOT ${id}] Gateway HELLO alındı.`
      );

      const heartbeatInterval =
        packet.d.heartbeat_interval;

      if (state.heartbeatTimer) {
        clearInterval(state.heartbeatTimer);
      }

      state.heartbeatTimer = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          return;
        }

        ws.send(
          JSON.stringify({
            op: 1,
            d: state.sequence
          })
        );

        console.log(
          `[BOT ${id}] Heartbeat gönderildi.`
        );
      }, heartbeatInterval);

      // =================================================
      // IDENTIFY
      // =================================================

      ws.send(
        JSON.stringify({
          op: 2,
          d: {
            token: token,

            // GUILDS + GUILD_VOICE_STATES
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
        })
      );

      console.log(
        `[BOT ${id}] IDENTIFY gönderildi.`
      );

      return;
    }

    // =================================================
    // INVALID SESSION
    // =================================================

    if (packet.op === 9) {
      console.error(
        `[BOT ${id}] INVALID SESSION!`
      );
      return;
    }

    // =================================================
    // DISPATCH
    // =================================================

    if (packet.op === 0) {

      // -----------------------------------------------
      // READY
      // -----------------------------------------------

      if (packet.t === 'READY') {
        state.sessionId =
          packet.d.session_id;

        state.userId =
          packet.d.user.id;

        state.userName =
          packet.d.user.username;

        console.log('');
        console.log(
          '================================================'
        );
        console.log(
          `[BOT ${id}] READY!`
        );
        console.log(
          `[BOT ${id}] Kullanıcı: ${state.userName}`
        );
        console.log(
          `[BOT ${id}] ID: ${state.userId}`
        );
        console.log(
          `[BOT ${id}] Kanal: ${state.channelId}`
        );
        console.log(
          '================================================'
        );
        console.log('');

        // Botları sırayla ses bağlantısına sok
        setTimeout(() => {
          startVoice(config, state);
        }, 3000);

        return;
      }

      // -----------------------------------------------
      // VOICE_STATE_UPDATE
      // -----------------------------------------------

      if (packet.t === 'VOICE_STATE_UPDATE') {
        const data = packet.d;

        // Yanlış sunucunun eventini alma
        if (data.guild_id !== GUILD_ID) {
          return;
        }

        // =============================================
        // ÇOK ÖNEMLİ:
        // SADECE BU BOTUN KENDİ SES DURUMUNU İŞLE
        // =============================================

        if (data.user_id !== state.userId) {
          return;
        }

        console.log(
          `[BOT ${id}] KENDİ VOICE_STATE_UPDATE -> ` +
          `user=${data.user_id} ` +
          `channel=${data.channel_id}`
        );

        if (state.voiceMethods) {
          try {
            state.voiceMethods.onVoiceStateUpdate(
              data
            );
          } catch (error) {
            console.error(
              `[BOT ${id}] ` +
              `Voice State adapter hatası:`,
              error
            );
          }
        }

        return;
      }

      // -----------------------------------------------
      // VOICE_SERVER_UPDATE
      // -----------------------------------------------

      if (packet.t === 'VOICE_SERVER_UPDATE') {
        const data = packet.d;

        if (data.guild_id !== GUILD_ID) {
          return;
        }

        console.log(
          `[BOT ${id}] VOICE_SERVER_UPDATE -> ` +
          `endpoint=${data.endpoint}`
        );

        if (state.voiceMethods) {
          try {
            state.voiceMethods.onVoiceServerUpdate(
              data
            );
          } catch (error) {
            console.error(
              `[BOT ${id}] ` +
              `Voice Server adapter hatası:`,
              error
            );
          }
        }

        return;
      }

      // -----------------------------------------------
      // RESUMED
      // -----------------------------------------------

      if (packet.t === 'RESUMED') {
        console.log(
          `[BOT ${id}] Gateway RESUMED.`
        );
      }
    }
  });

  // ===================================================
  // GATEWAY ERROR
  // ===================================================

  ws.on('error', (error) => {
    console.error(
      `[BOT ${id}] Gateway ERROR:`,
      error
    );
  });

  // ===================================================
  // GATEWAY CLOSE
  // ===================================================

  ws.on('close', (code, reason) => {
    console.error(
      `[BOT ${id}] Gateway kapandı. ` +
      `Code=${code} ` +
      `Reason=${reason.toString()}`
    );

    if (state.heartbeatTimer) {
      clearInterval(state.heartbeatTimer);

      state.heartbeatTimer = null;
    }

    if (state.voiceConnection) {
      try {
        state.voiceConnection.destroy();
      } catch {}

      state.voiceConnection = null;
    }
  });
}

// =====================================================
// CUSTOM VOICE ADAPTER
// =====================================================

function createVoiceAdapter(state) {
  return (methods) => {

    state.voiceMethods = methods;

    const adapter = {
      sendPayload(payload) {
        if (
          !state.ws ||
          state.ws.readyState !== WebSocket.OPEN
        ) {
          console.error(
            `[BOT ${state.id}] ` +
            'Gateway bağlı değil, ' +
            'voice payload gönderilemedi.'
          );

          return false;
        }

        try {
          state.ws.send(
            JSON.stringify(payload)
          );

          console.log(
            `[BOT ${state.id}] ` +
            `[GATEWAY OUT] OP=${payload.op}`
          );

          return true;
        } catch (error) {
          console.error(
            `[BOT ${state.id}] ` +
            'Voice payload hatası:',
            error
          );

          return false;
        }
      },

      destroy() {
        console.log(
          `[BOT ${state.id}] ` +
          'Voice adapter yok edildi.'
        );

        state.voiceMethods = null;
      }
    };

    state.voiceAdapter = adapter;

    console.log(
      `[BOT ${state.id}] ` +
      'Voice adapter oluşturuldu.'
    );

    return adapter;
  };
}

// =====================================================
// SES BAĞLANTISI
// =====================================================

async function startVoice(config, state) {
  const {
    id,
    channelId
  } = config;

  console.log('');
  console.log(
    `[BOT ${id}] Voice bağlantısı başlatılıyor...`
  );
  console.log(
    `[BOT ${id}] Kanal ID: ${channelId}`
  );

  try {
    const connection = joinVoiceChannel({
      channelId: channelId,

      guildId: GUILD_ID,

      adapterCreator:
        createVoiceAdapter(state),

      selfDeaf: true,
      selfMute: true,

      debug: true
    });

    state.voiceConnection = connection;

    // -----------------------------------------------
    // STATE CHANGE
    // -----------------------------------------------

    connection.on(
      'stateChange',
      (oldState, newState) => {
        console.log(
          `[BOT ${id}] ` +
          `[VOICE] ` +
          `${oldState.status} -> ` +
          `${newState.status}`
        );
      }
    );

    // -----------------------------------------------
    // ERROR
    // -----------------------------------------------

    connection.on(
      'error',
      (error) => {
        console.error(
          `[BOT ${id}] [VOICE ERROR]`,
          error
        );
      }
    );

    console.log(
      `[BOT ${id}] ` +
      'Voice READY bekleniyor...'
    );

    // 30 saniye bekle
    await entersState(
      connection,
      VoiceConnectionStatus.Ready,
      30000
    );

    console.log('');
    console.log(
      '================================================'
    );
    console.log(
      `[BOT ${id}] VOICE BAŞARILI!`
    );
    console.log(
      `[BOT ${id}] BOT SES KANALINDA READY!`
    );
    console.log(
      '================================================'
    );
    console.log('');

  } catch (error) {
    console.error('');
    console.error(
      '================================================'
    );
    console.error(
      `[BOT ${id}] VOICE BAĞLANTI HATASI`
    );
    console.error(
      `[BOT ${id}]`,
      error?.message || error
    );
    console.error(
      '================================================'
    );
    console.error('');

    if (state.voiceConnection) {
      try {
        state.voiceConnection.destroy();
      } catch {}
    }

    state.voiceConnection = null;
  }
}

// =====================================================
// BOTLARI SIRALI BAŞLAT
// =====================================================

// 0 sn  -> Bot 1
// 10 sn -> Bot 2
// 20 sn -> Bot 3
// 30 sn -> Bot 4

botConfigs.forEach((config, index) => {
  setTimeout(() => {
    startBot(config);
  }, index * 10000);
});

// =====================================================
// WATCHDOG
// =====================================================

setInterval(() => {
  console.log('');
  console.log(
    '================ WATCHDOG ================'
  );

  for (const [id, state] of botStates.entries()) {
    console.log(
      `[BOT ${id}] ` +
      `Gateway=${state.ws?.readyState ?? 'YOK'} ` +
      `User=${state.userName ?? 'YOK'} ` +
      `ID=${state.userId ?? 'YOK'} ` +
      `Voice=${state.voiceConnection?.state?.status ?? 'YOK'}`
    );
  }

  console.log(
    '=========================================='
  );
  console.log('');

}, 60000);

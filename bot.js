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

// =====================================================
// TOKEN / KANAL
// =====================================================

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

// =====================================================
// DURUM
// =====================================================

let ws = null;

let heartbeatTimer = null;
let reconnectTimer = null;
let voiceRetryTimer = null;

let sequence = null;
let sessionId = null;

let userId = null;
let userName = null;

let voiceConnection = null;
let voiceMethods = null;

let voiceConnecting = false;
let voiceRetryCount = 0;
let gatewayConnecting = false;

// =====================================================
// SABİTLER
// =====================================================

const MAX_VOICE_RETRIES = 20;

const VOICE_TIMEOUT = 60000;

const VOICE_RETRY_DELAY = 10000;

const GATEWAY_RETRY_DELAY = 5000;

// =====================================================
// BOT BAŞLANGIÇ
// =====================================================

console.log('');
console.log('================================================');
console.log(`[BOT ${botId}] BAŞLIYOR`);
console.log(`[BOT ${botId}] Kanal: ${CHANNEL_ID}`);
console.log(
  `[BOT ${botId}] Token: ${TOKEN ? 'VAR' : 'YOK'}`
);
console.log('================================================');

if (!TOKEN) {
  console.error(
    `[BOT ${botId}] BOT_TOKEN_${botId} bulunamadı!`
  );

  process.exit(1);
}

// =====================================================
// PRESENCE
// =====================================================

function sendPresence() {
  if (
    !ws ||
    ws.readyState !== WebSocket.OPEN
  ) {
    return;
  }

  try {
    ws.send(
      JSON.stringify({
        op: 3,
        d: {
          since: 0,

          activities: [
            {
              name: 'Apatheon Profesyonel Hizmet ❤️',

              type: 1,

              url: 'https://www.twitch.tv/discord'
            }
          ],

          status: 'online',

          afk: false
        }
      })
    );

    console.log(
      `[BOT ${botId}] Yayın durumu gönderildi.`
    );

  } catch (error) {
    console.error(
      `[BOT ${botId}] Presence gönderme hatası:`,
      error
    );
  }
}

// =====================================================
// GATEWAY BAĞLANTISI
// =====================================================

function connectGateway() {
  if (gatewayConnecting) {
    return;
  }

  gatewayConnecting = true;

  console.log(
    `[BOT ${botId}] Gateway bağlanıyor...`
  );

  ws = new WebSocket(
    'wss://gateway.discord.gg/?v=10&encoding=json'
  );

  // ===================================================
  // GATEWAY OPEN
  // ===================================================

  ws.on('open', () => {
    gatewayConnecting = false;

    console.log(
      `[BOT ${botId}] Gateway WebSocket açıldı.`
    );
  });

  // ===================================================
  // GATEWAY MESSAGE
  // ===================================================

  ws.on('message', async (raw) => {
    let packet;

    try {
      packet = JSON.parse(raw.toString());
    } catch (error) {
      console.error(
        `[BOT ${botId}] Gateway JSON hatası:`,
        error
      );

      return;
    }

    // Sequence
    if (
      packet.s !== null &&
      packet.s !== undefined
    ) {
      sequence = packet.s;
    }

    // =================================================
    // HELLO
    // =================================================

    if (packet.op === 10) {
      console.log(
        `[BOT ${botId}] Gateway HELLO alındı.`
      );

      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);

        heartbeatTimer = null;
      }

      heartbeatTimer = setInterval(() => {
        if (
          !ws ||
          ws.readyState !== WebSocket.OPEN
        ) {
          return;
        }

        try {
          ws.send(
            JSON.stringify({
              op: 1,
              d: sequence
            })
          );
        } catch (error) {
          console.error(
            `[BOT ${botId}] Heartbeat hatası:`,
            error
          );
        }
      }, packet.d.heartbeat_interval);

      // =================================================
      // IDENTIFY
      // =================================================

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
                  name:
                    '❤️Apatheon Profesyonel Hizmet❤️',

                  type: 1,

                  url:
                    'https://www.twitch.tv/discord'
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

    // =================================================
    // INVALID SESSION
    // =================================================

    if (packet.op === 9) {
      console.error(
        `[BOT ${botId}] INVALID SESSION`
      );

      return;
    }

    if (packet.op !== 0) {
      return;
    }

    // =================================================
    // READY
    // =================================================

    if (packet.t === 'READY') {
      sessionId =
        packet.d.session_id;

      userId =
        packet.d.user.id;

      userName =
        packet.d.user.username;

      console.log('');
      console.log(
        '================================================'
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
        `[BOT ${botId}] Kanal: ${CHANNEL_ID}`
      );

      console.log(
        '================================================'
      );

      console.log('');

      // Presence'ı READY sonrasında tekrar gönder
      sendPresence();

      // Voice bağlantısını biraz beklet
      scheduleVoiceConnect(3000);

      return;
    }

    // =================================================
    // VOICE STATE UPDATE
    // SADECE KENDİ BOTUMUZ
    // =================================================

    if (
      packet.t === 'VOICE_STATE_UPDATE'
    ) {
      const data = packet.d;

      // Doğru sunucu
      if (
        data.guild_id !== GUILD_ID
      ) {
        return;
      }

      // Sadece bu bot
      if (
        data.user_id !== userId
      ) {
        return;
      }

      console.log(
        `[BOT ${botId}] KENDİ VOICE STATE -> ` +
        `channel=${data.channel_id}`
      );

      if (voiceMethods) {
        try {
          voiceMethods.onVoiceStateUpdate(
            data
          );
        } catch (error) {
          console.error(
            `[BOT ${botId}] ` +
            `Voice State adapter hatası:`,
            error
          );
        }
      }

      // Bot kanaldan düşerse tekrar bağlan
      if (!data.channel_id) {
        console.log(
          `[BOT ${botId}] ` +
          'Bot ses kanalından ayrılmış.'
        );

        if (!voiceConnecting) {
          scheduleVoiceConnect(3000);
        }
      }

      return;
    }

    // =================================================
    // VOICE SERVER UPDATE
    // =================================================

    if (
      packet.t === 'VOICE_SERVER_UPDATE'
    ) {
      const data = packet.d;

      if (
        data.guild_id !== GUILD_ID
      ) {
        return;
      }

      console.log(
        `[BOT ${botId}] VOICE SERVER -> ` +
        `${data.endpoint || 'YOK'}`
      );

      if (voiceMethods) {
        try {
          voiceMethods.onVoiceServerUpdate(
            data
          );
        } catch (error) {
          console.error(
            `[BOT ${botId}] ` +
            `Voice Server adapter hatası:`,
            error
          );
        }
      }

      return;
    }

    // =================================================
    // RESUMED
    // =================================================

    if (packet.t === 'RESUMED') {
      console.log(
        `[BOT ${botId}] Gateway RESUMED.`
      );

      sendPresence();
    }
  });

  // ===================================================
  // GATEWAY ERROR
  // ===================================================

  ws.on('error', (error) => {
    gatewayConnecting = false;

    console.error(
      `[BOT ${botId}] Gateway ERROR:`,
      error
    );
  });

  // ===================================================
  // GATEWAY CLOSE
  // ===================================================

  ws.on('close', (code, reason) => {
    gatewayConnecting = false;

    console.log(
      `[BOT ${botId}] Gateway kapandı. ` +
      `code=${code} ` +
      `reason=${reason.toString()}`
    );

    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);

      heartbeatTimer = null;
    }

    destroyVoiceConnection();

    scheduleGatewayReconnect();
  });
}

// =====================================================
// GATEWAY RECONNECT
// =====================================================

function scheduleGatewayReconnect() {
  if (reconnectTimer) {
    return;
  }

  console.log(
    `[BOT ${botId}] ` +
    `${GATEWAY_RETRY_DELAY / 1000} saniye sonra ` +
    'Gateway yeniden denenecek...'
  );

  reconnectTimer =
    setTimeout(() => {
      reconnectTimer = null;

      connectGateway();
    }, GATEWAY_RETRY_DELAY);
}

// =====================================================
// VOICE ADAPTER
// =====================================================

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
            `[BOT ${botId}] ` +
            'Gateway açık değil, ' +
            'voice payload gönderilemedi.'
          );

          return false;
        }

        try {
          ws.send(
            JSON.stringify(payload)
          );

          console.log(
            `[BOT ${botId}] ` +
            `[GATEWAY OUT] OP=${payload.op}`
          );

          return true;

        } catch (error) {
          console.error(
            `[BOT ${botId}] ` +
            'Voice payload hatası:',
            error
          );

          return false;
        }
      },

      destroy() {
        console.log(
          `[BOT ${botId}] ` +
          'Voice adapter yok edildi.'
        );

        voiceMethods = null;
      }
    };
  };
}

// =====================================================
// VOICE CONNECT PLANLA
// =====================================================

function scheduleVoiceConnect(
  delay = VOICE_RETRY_DELAY
) {
  if (voiceRetryTimer) {
    return;
  }

  if (voiceConnection) {
    const currentStatus =
      voiceConnection.state?.status;

    if (
      currentStatus ===
        VoiceConnectionStatus.Ready ||
      currentStatus ===
        VoiceConnectionStatus.Connecting ||
      currentStatus ===
        VoiceConnectionStatus.Signalling
    ) {
      return;
    }
  }

  voiceRetryTimer =
    setTimeout(() => {
      voiceRetryTimer = null;

      startVoice();
    }, delay);
}

// =====================================================
// VOICE CONNECTION DESTROY
// =====================================================

function destroyVoiceConnection() {
  if (!voiceConnection) {
    voiceMethods = null;
    voiceConnecting = false;

    return;
  }

  try {
    voiceConnection.destroy();
  } catch {}

  voiceConnection = null;

  voiceMethods = null;

  voiceConnecting = false;
}

// =====================================================
// VOICE BAĞLAN
// =====================================================

async function startVoice() {
  if (voiceConnecting) {
    return;
  }

  if (
    !ws ||
    ws.readyState !== WebSocket.OPEN
  ) {
    console.log(
      `[BOT ${botId}] ` +
      'Gateway hazır değil, voice ertelendi.'
    );

    scheduleVoiceConnect(3000);

    return;
  }

  voiceConnecting = true;

  // Mevcut bozuk bağlantıyı temizle
  if (voiceConnection) {
    const currentStatus =
      voiceConnection.state?.status;

    if (
      currentStatus !==
      VoiceConnectionStatus.Ready
    ) {
      destroyVoiceConnection();

    } else {
      voiceConnecting = false;

      return;
    }
  }

  const attemptNumber =
    voiceRetryCount + 1;

  console.log('');

  console.log(
    '================================================'
  );

  console.log(
    `[BOT ${botId}] ` +
    `VOICE BAĞLANTI DENEMESİ ` +
    `${attemptNumber}/${MAX_VOICE_RETRIES}`
  );

  console.log(
    `[BOT ${botId}] Kanal=${CHANNEL_ID}`
  );

  console.log(
    `[BOT ${botId}] ` +
    `Timeout=${VOICE_TIMEOUT / 1000}s`
  );

  console.log(
    '================================================'
  );

  try {
    const connection =
      joinVoiceChannel({
        channelId: CHANNEL_ID,

        guildId: GUILD_ID,

        adapterCreator:
          createVoiceAdapter(),

        selfDeaf: true,

        selfMute: true,

        debug: true
      });

    voiceConnection =
      connection;

    // =================================================
    // STATE CHANGE
    // =================================================

    connection.on(
      'stateChange',
      (oldState, newState) => {
        console.log(
          `[BOT ${botId}] ` +
          `[VOICE] ` +
          `${oldState.status} -> ` +
          `${newState.status}`
        );

        if (
          newState.status ===
          VoiceConnectionStatus.Destroyed
        ) {
          voiceConnecting =
            false;

          if (
            voiceConnection ===
            connection
          ) {
            voiceConnection = null;
          }

          if (
            voiceRetryCount <
            MAX_VOICE_RETRIES
          ) {
            scheduleVoiceConnect(
              VOICE_RETRY_DELAY
            );
          }
        }

        if (
          newState.status ===
          VoiceConnectionStatus.Ready
        ) {
          voiceRetryCount = 0;
        }
      }
    );

    // =================================================
    // ERROR
    // =================================================

    connection.on(
      'error',
      (error) => {
        console.error(
          `[BOT ${botId}] ` +
          `[VOICE ERROR]`,
          error
        );
      }
    );

    console.log(
      `[BOT ${botId}] ` +
      'Voice READY bekleniyor...'
    );

    await entersState(
      connection,

      VoiceConnectionStatus.Ready,

      VOICE_TIMEOUT
    );

    // =================================================
    // BAŞARILI
    // =================================================

    voiceRetryCount = 0;

    voiceConnecting = false;

    console.log('');

    console.log(
      '================================================'
    );

    console.log(
      `[BOT ${botId}] VOICE BAŞARILI!`
    );

    console.log(
      `[BOT ${botId}] KANALDA BEKLİYOR!`
    );

    console.log(
      `[BOT ${botId}] Kanal=${CHANNEL_ID}`
    );

    console.log(
      '================================================'
    );

    console.log('');

  } catch (error) {
    voiceConnecting =
      false;

    console.error('');

    console.error(
      '================================================'
    );

    console.error(
      `[BOT ${botId}] ` +
      'VOICE BAĞLANTI HATASI'
    );

    console.error(
      `[BOT ${botId}]`,
      error?.message ||
        error
    );

    console.error(
      '================================================'
    );

    console.error('');

    if (
      voiceConnection ===
      connection
    ) {
      voiceConnection =
        null;
    }

    try {
      connection.destroy();
    } catch {}

    voiceMethods =
      null;

    voiceRetryCount++;

    if (
      voiceRetryCount <=
      MAX_VOICE_RETRIES
    ) {
      console.log(
        `[BOT ${botId}] ` +
        `${VOICE_RETRY_DELAY / 1000} saniye sonra ` +
        `voice tekrar denenecek ` +
        `(${voiceRetryCount}/` +
        `${MAX_VOICE_RETRIES})...`
      );

      scheduleVoiceConnect(
        VOICE_RETRY_DELAY
      );

    } else {
      console.error(
        `[BOT ${botId}] ` +
        'Maksimum voice deneme sayısına ulaşıldı.'
      );
    }
  }
}

// =====================================================
// WATCHDOG
// =====================================================

setInterval(() => {
  console.log('');

  console.log(
    '================ WATCHDOG ================'
  );

  console.log(
    `[BOT ${botId}] ` +
    `User=${userName || 'YOK'} ` +
    `ID=${userId || 'YOK'}`
  );

  console.log(
    `[BOT ${botId}] ` +
    `Gateway=${ws?.readyState ?? 'YOK'}`
  );

  console.log(
    `[BOT ${botId}] ` +
    `Voice=${voiceConnection?.state?.status ?? 'YOK'}`
  );

  console.log(
    `[BOT ${botId}] ` +
    `VoiceRetry=${voiceRetryCount}`
  );

  console.log(
    `[BOT ${botId}] ` +
    `Kanal=${CHANNEL_ID}`
  );

  console.log(
    '=========================================='
  );

  console.log('');

}, 60000);

// =====================================================
// BAŞLAT
// =====================================================

connectGateway();

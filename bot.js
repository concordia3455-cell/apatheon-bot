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
// HOŞ GELDİN SİSTEMİ AYARLARI
// Sadece WELCOME_BOT_ID'deki bot hoş geldin görseli atar.
// (Render > Environment ile değiştirilebilir)
// =====================================================

const WELCOME_BOT_ID = Number(process.env.WELCOME_BOT_ID || 1);

const WELCOME_CHANNEL_ID =
  process.env.WELCOME_CHANNEL_ID || '1452657671609258135';

const IS_WELCOME_BOT = botId === WELCOME_BOT_ID;

// GUILD_MEMBERS (privileged) intent'i sadece hoş geldin botunda açılır.
// Developer Portal'da kapalıysa Discord 4014 ile reddeder; aşağıda
// otomatik kapatılıp ses sistemi etkilenmeden devam edilir.
let welcomeIntentOn = IS_WELCOME_BOT;
let welcomeSystem = null;

// GUILDS(1) + GUILD_VOICE_STATES(128) [+ GUILD_MEMBERS(2)]
function currentIntents() {
  return welcomeIntentOn ? (129 | 2) : 129;
}

function initWelcome() {
  if (!IS_WELCOME_BOT) {
    return;
  }

  try {
    const { createWelcomeSystem } = require('./welcomeSystem');

    welcomeSystem = createWelcomeSystem({
      token: TOKEN,
      guildId: GUILD_ID,
      channelId: WELCOME_CHANNEL_ID,
      tag: `[BOT ${botId}] [WELCOME]`,
      background: 'random'
    });

    console.log(
      `[BOT ${botId}] Hoş geldin sistemi AKTİF -> ` +
      `kanal=${WELCOME_CHANNEL_ID}`
    );
  } catch (error) {
    // Canvas vs. yüklenemezse ses botu çalışmaya devam eder
    welcomeSystem = null;
    welcomeIntentOn = false;

    console.error(
      `[BOT ${botId}] Hoş geldin sistemi yüklenemedi ` +
      '(ses sistemi etkilenmez):',
      error?.message || error
    );
  }
}

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
// PRESENCE (DÖNEN DURUMLAR)
// =====================================================

const STATUS_INTERVAL = 20000; // 20 sn (altına düşme, Discord sınırı var)
let statusIndex = botId - 1;   // her bot farklı durumdan başlasın
let statusTimer = null;
let memberCountTimer = null;
let memberCount = null;

function getStatuses() {
  const list = [
    '❤️Apatheon Profesyonel Hizmet❤️',
    '👋 Yeni üyeleri karşılıyor',
    "✨ Apatheon'a hoş geldin!",
    '🔒 Güvenli ve hızlı kayıt sistemi',
    '🚀 Apatheon ile fark yarat'
  ];

  if (memberCount) {
    list.splice(2, 0, `👥 ${memberCount} üyeye hizmet veriyor`);
  }

  return list;
}

function currentActivity() {
  const list = getStatuses();

  return {
    name: list[statusIndex % list.length],
    type: 1,
    url: 'https://www.twitch.tv/discord'
  };
}

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
          activities: [currentActivity()],
          status: 'online',
          afk: false
        }
      })
    );
  } catch (error) {
    console.error(
      `[BOT ${botId}] Presence gönderme hatası:`,
      error
    );
  }
}

async function refreshMemberCount() {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}?with_counts=true`,
      { headers: { Authorization: `Bot ${TOKEN}` } }
    );

    if (!res.ok) {
      console.error(
        `[BOT ${botId}] Üye sayısı alınamadı: ${res.status}`
      );
      return;
    }

    const data = await res.json();

    if (data.approximate_member_count) {
      memberCount = data.approximate_member_count;
    }
  } catch (error) {
    console.error(
      `[BOT ${botId}] Üye sayısı hatası:`,
      error?.message || error
    );
  }
}

function startStatusRotation() {
  if (statusTimer) {
    clearInterval(statusTimer);
  }

  statusTimer = setInterval(() => {
    statusIndex++;
    sendPresence();
  }, STATUS_INTERVAL);

  // Üye sayısını 5 dakikada bir yenile (bir kez başlat)
  if (!memberCountTimer) {
    refreshMemberCount().then(sendPresence);
    memberCountTimer = setInterval(
      refreshMemberCount,
      5 * 60 * 1000
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

  ws.on('open', () => {
    gatewayConnecting = false;

    console.log(
      `[BOT ${botId}] Gateway WebSocket açıldı.`
    );
  });

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
            intents: currentIntents(),
            properties: {
              os: 'linux',
              browser: 'apatheon',
              device: 'apatheon'
            },
            presence: {
              since: 0,
              activities: [currentActivity()],
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
      sessionId = packet.d.session_id;
      userId = packet.d.user.id;
      userName = packet.d.user.username;

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

      sendPresence();
      startStatusRotation();

      scheduleVoiceConnect(3000);

      return;
    }

    // =================================================
    // HOŞ GELDİN EVENT'LERİ
    // =================================================

    if (packet.t === 'GUILD_CREATE') {
      if (welcomeSystem) {
        welcomeSystem.onGuildCreate(packet.d);
      }

      return;
    }

    if (packet.t === 'GUILD_MEMBER_REMOVE') {
      if (welcomeSystem) {
        welcomeSystem.onMemberRemove(packet.d);
      }

      return;
    }

    if (packet.t === 'GUILD_MEMBER_ADD') {
      if (welcomeSystem) {
        welcomeSystem.onMemberAdd(packet.d).catch((error) => {
          console.error(
            `[BOT ${botId}] Hoş geldin hatası:`,
            error?.message || error
          );
        });
      }

      return;
    }

    // =================================================
    // VOICE STATE UPDATE
    // =================================================

    if (
      packet.t === 'VOICE_STATE_UPDATE'
    ) {
      const data = packet.d;

      if (
        data.guild_id !== GUILD_ID
      ) {
        return;
      }

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

  ws.on('error', (error) => {
    gatewayConnecting = false;

    console.error(
      `[BOT ${botId}] Gateway ERROR:`,
      error
    );
  });

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

    if (statusTimer) {
      clearInterval(statusTimer);
      statusTimer = null;
    }

    // Server Members Intent kapalıysa: hoş geldin özelliğini kapat,
    // ses botu normal intent ile (129) tekrar bağlansın.
    if (code === 4014 && welcomeIntentOn) {
      welcomeIntentOn = false;
      welcomeSystem = null;

      console.error(
        `[BOT ${botId}] UYARI: SERVER MEMBERS INTENT kapalı! ` +
        'Developer Portal > Bot > Privileged Gateway Intents ' +
        'altından aç. Şimdilik hoş geldin kapalı, ses devam ediyor.'
      );
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

  reconnectTimer = setTimeout(() => {
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

  voiceRetryTimer = setTimeout(() => {
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
          `[BOT ${botId}] ` +
          `[VOICE] ` +
          `${oldState.status} -> ` +
          `${newState.status}`
        );

        if (
          newState.status ===
          VoiceConnectionStatus.Destroyed
        ) {
          voiceConnecting = false;

          if (
            voiceConnection === connection
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

    connection.on(
      'error',
      (error) => {
        console.error(
          `[BOT ${botId}] [VOICE ERROR]`,
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
    voiceConnecting = false;

    console.error('');
    console.error(
      '================================================'
    );
    console.error(
      `[BOT ${botId}] VOICE BAĞLANTI HATASI`
    );
    console.error(
      `[BOT ${botId}]`,
      error?.message || error
    );
    console.error(
      '================================================'
    );
    console.error('');

    if (
      voiceConnection === connection
    ) {
      voiceConnection = null;
    }

    try {
      connection.destroy();
    } catch {}

    voiceMethods = null;

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

initWelcome();

connectGateway();

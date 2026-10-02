// Apatheon - Günlük hatırlatma (genel sohbete günde 1 kez)
// discord.js KULLANMAZ, sadece Discord REST kullanır. Sadece hoş geldin botunda çalışır.

const sleep = ms => new Promise(r => setTimeout(r, ms));

// =====================================================
// AYARLAR (Render > Environment ile değiştirilebilir)
// =====================================================

const GENERAL_CHANNEL_ID = process.env.DAILY_REMINDER_CHANNEL_ID || '1411168576056066179';

// Türkiye saatiyle gönderim saati (varsayılan 18:20)
const HOUR = Number(process.env.DAILY_REMINDER_HOUR ?? 18);
const MINUTE = Number(process.env.DAILY_REMINDER_MINUTE ?? 20);

// Bot saatten sonra açılırsa, en fazla bu kadar dakika geç de olsa gönderir
const WINDOW_MIN = 90;

// DAILY_REMINDER_SEND_NOW=1 -> bot açılınca 8 sn sonra hemen bir kez gönderir (TEST için)
const SEND_NOW = process.env.DAILY_REMINDER_SEND_NOW === '1';

// DAILY_REMINDER_ENABLED=0 -> tamamen kapatır
const ENABLED = process.env.DAILY_REMINDER_ENABLED !== '0';

const CHANNELS = {
  ticket: process.env.WELCOME_TICKET_CHANNEL_ID || '1460290342464000218',
  notifRoles: process.env.WELCOME_NOTIF_ROLE_CHANNEL_ID || '1546206143574048918',
  colorRoles: process.env.WELCOME_COLOR_ROLE_CHANNEL_ID || '1546206195453395105',
  zodiacRoles: process.env.WELCOME_ZODIAC_ROLE_CHANNEL_ID || '1546206241817235538',
};

const MARKER = 'Günlük hatırlatma';
const COLOR = 0xe11d48;
const TR_OFFSET_MS = 3 * 3600 * 1000; // Türkiye UTC+3 (yaz/kış saati yok)
const API_TIMEOUT_MS = 15000; // Discord'a giden istek takılırsa sistem kilitlenmesin

const INTROS = [
  'Merhaba Apatheon ailesi! Sunucuda kendine uygun rolleri seçmeyi ve bir sorun yaşadığında bize ulaşmayı unutma.',
  'Selam! Rollerini seçerek sunucuyu kendine göre özelleştirebilirsin, bir sorun olursa da buradayız.',
  'Hatırlatma zamanı! 🎭 Rol kanallarından kendine uygun rolleri alabilir, ihtiyacın olduğunda ticket açabilirsin.',
  'Apatheon ailesine küçük bir hatırlatma: rollerini seçmeyi unutma, yardım gerekirse ticket kanalı seni bekliyor.',
  'Merhaba! Bildirim, renk ve burç rollerini seçmek tek tık, bir sorun yaşarsan da ticket açabilirsin.',
];

let started = false;
let lastIntro = -1;

function startDailyReminder({ token, guildId, tag = '[GÜNLÜK]' }) {
  if (started || !ENABLED) return;
  started = true;

  const channelUrl = id => `https://discord.com/channels/${guildId}/${id}`;
  const trNow = (ms = Date.now()) => new Date(ms + TR_OFFSET_MS);
  const dayKey = ms => trNow(ms).toISOString().slice(0, 10);
  const minsOfDay = ms => {
    const d = trNow(ms);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  };

  async function api(path, init = {}, attempt = 0) {
    const res = await fetch(`https://discord.com/api/v10${path}`, {
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      ...init,
      headers: { Authorization: `Bot ${token}`, ...(init.headers || {}) },
    });

    if (res.status === 429 && attempt < 2) {
      const j = await res.json().catch(() => ({}));
      await sleep(((j.retry_after || 1) * 1000) + 250);
      return api(path, init, attempt + 1);
    }

    return res;
  }

  async function postMessage(payload) {
    const res = await api(`/channels/${GENERAL_CHANNEL_ID}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Discord API ${res.status}: ${txt}` +
        (res.status === 403 ? ' (Botun genel sohbette Kanalı Gör / Mesaj Gönder / Bağlantı Yerleştir yetkisi var mı?)' : ''));
    }
  }

  function pickIntro() {
    let i;
    do {
      i = Math.floor(Math.random() * INTROS.length);
    } while (INTROS.length > 1 && i === lastIntro);
    lastIntro = i;
    return INTROS[i];
  }

  const roleLines = () => [
    `🔔 Bildirim rolleri → <#${CHANNELS.notifRoles}>`,
    `🎨 Renk rolleri → <#${CHANNELS.colorRoles}>`,
    `♈ Burç rolleri → <#${CHANNELS.zodiacRoles}>`,
  ].join('\n');

  const ticketLine = () =>
    `🎫 Bir sorun mu yaşıyorsun? <#${CHANNELS.ticket}> kanalından ticket aç, ekibimiz sana yardımcı olsun.`;

  const footer = () => `Apatheon • Profesyonel Hizmet • ${MARKER}`;

  const buttonRow = () => [{
    type: 1,
    components: [
      { type: 2, style: 5, label: 'Ticket Aç', emoji: { name: '🎫' }, url: channelUrl(CHANNELS.ticket) },
      { type: 2, style: 5, label: 'Bildirim', emoji: { name: '🔔' }, url: channelUrl(CHANNELS.notifRoles) },
      { type: 2, style: 5, label: 'Renk', emoji: { name: '🎨' }, url: channelUrl(CHANNELS.colorRoles) },
      { type: 2, style: 5, label: 'Burç', emoji: { name: '♈' }, url: channelUrl(CHANNELS.zodiacRoles) },
    ],
  }];

  function buildV2Payload(intro) {
    return {
      flags: 1 << 15, // IS_COMPONENTS_V2
      allowed_mentions: { parse: [] },
      components: [{
        type: 17,
        accent_color: COLOR,
        components: [
          { type: 10, content: `## 📌 Apatheon'dan hatırlatma\n### ${intro}\n\n${roleLines()}` },
          { type: 14, divider: true, spacing: 1 },
          { type: 10, content: ticketLine() },
          ...buttonRow(),
          { type: 10, content: `-# ${footer()}` },
        ],
      }],
    };
  }

  function buildClassicPayload(intro) {
    return {
      allowed_mentions: { parse: [] },
      embeds: [{
        color: COLOR,
        title: "📌 Apatheon'dan hatırlatma",
        description: `${intro}\n\n${roleLines()}\n\n${ticketLine()}`,
        footer: { text: footer() },
      }],
      components: buttonRow(),
    };
  }

  async function sendReminder() {
    const intro = pickIntro();

    try {
      await postMessage(buildV2Payload(intro));
    } catch (error) {
      if (!String(error?.message || '').startsWith('Discord API 400')) throw error;
      console.warn(`${tag} Yeni düzen reddedildi, klasik düzene geçiliyor:`, error.message);
      await postMessage(buildClassicPayload(intro));
    }

    console.log(`${tag} Günlük hatırlatma gönderildi -> kanal=${GENERAL_CHANNEL_ID}`);
  }

  // Bot yeniden başlasa bile aynı gün ikinci kez atmasın diye kanalın son mesajlarına bakar.
  // ÖNEMLİ: Sadece bugünün gönderim saatinden SONRA atılmış mesajlar sayılır.
  // (Sabah yapılan test gönderimleri sayılmasın, yoksa 18:00'de "zaten atılmış" sanıp atlıyordu.)
  async function alreadySentToday() {
    try {
      const meRes = await api('/users/@me');
      if (!meRes.ok) return false;
      const me = await meRes.json();

      const res = await api(`/channels/${GENERAL_CHANNEL_ID}/messages?limit=50`);
      if (!res.ok) return false;
      const msgs = await res.json();

      const today = dayKey(Date.now());
      const target = HOUR * 60 + MINUTE;

      return msgs.some(m => {
        if (m.author?.id !== me.id) return false;

        const sentAt = new Date(m.timestamp).getTime();
        if (dayKey(sentAt) !== today) return false;
        if (minsOfDay(sentAt) < target) return false; // gönderim saatinden önceki (test) mesajlar sayılmaz

        return JSON.stringify(m).includes(MARKER);
      });
    } catch {
      return false;
    }
  }

  let lastSentDay = null;
  let busy = false;
  let attemptsDay = null;
  let attempts = 0;
  let nextTryAt = 0;

  async function tick() {
    if (busy) return;

    const now = trNow();
    const day = now.toISOString().slice(0, 10);
    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const target = HOUR * 60 + MINUTE;

    if (lastSentDay === day) return;
    if (mins < target || mins >= target + WINDOW_MIN) return;

    if (attemptsDay !== day) {
      attemptsDay = day;
      attempts = 0;
      console.log(`${tag} Gönderim penceresi açıldı (${day}), kontrol ediliyor...`);
    }
    if (attempts >= 3 || Date.now() < nextTryAt) return;

    busy = true;

    try {
      if (await alreadySentToday()) {
        lastSentDay = day;
        console.log(`${tag} Bugünün hatırlatması zaten kanalda, tekrar gönderilmeyecek.`);
        return;
      }

      attempts++;
      await sendReminder();
      lastSentDay = day;
    } catch (error) {
      nextTryAt = Date.now() + 5 * 60 * 1000;
      console.error(`${tag} Günlük hatırlatma hatası (deneme ${attempts}/3):`, error?.message || error);
    } finally {
      busy = false;
    }
  }

  setInterval(tick, 30 * 1000);

  const hh = String(HOUR).padStart(2, '0');
  const mm = String(MINUTE).padStart(2, '0');
  console.log(`${tag} Günlük hatırlatma AKTİF -> kanal=${GENERAL_CHANNEL_ID} saat=${hh}:${mm} (TR)`);

  if (SEND_NOW) {
    setTimeout(async () => {
      try {
        await sendReminder();
      } catch (error) {
        console.error(`${tag} Test gönderimi hatası:`, error?.message || error);
      }
    }, 8000);

    console.log(`${tag} TEST: DAILY_REMINDER_SEND_NOW=1, 8 saniye sonra bir kez gönderilecek.`);
  }
}

module.exports = { startDailyReminder };

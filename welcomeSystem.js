// Apatheon - Hoş geldin sistemi (ham gateway eventleri + Discord REST)
// discord.js KULLANMAZ. bot.js içinden event'ler buraya iletilir.
const { makeWelcomeImage, clean } = require('./welcome');

const DISCORD_EPOCH = 1420070400000n;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// =====================================================
// AYARLAR (Render > Environment ile değiştirilebilir)
// =====================================================

const CHANNELS = {
  ticket: process.env.WELCOME_TICKET_CHANNEL_ID || '1460290342464000218',
  rules: process.env.WELCOME_RULES_CHANNEL_ID || '1538563390836838541',
  notifRoles: process.env.WELCOME_NOTIF_ROLE_CHANNEL_ID || '1546206143574048918',
  colorRoles: process.env.WELCOME_COLOR_ROLE_CHANNEL_ID || '1546206195453395105',
  zodiacRoles: process.env.WELCOME_ZODIAC_ROLE_CHANNEL_ID || '1546206241817235538',
};

// Şüpheli hesap uyarısı bu kanala düşer. Boşsa uyarı kapalıdır.
const LOG_CHANNEL_ID = process.env.WELCOME_LOG_CHANNEL_ID || '';

// Bu günden yeni hesaplar şüpheli sayılır
const MIN_ACCOUNT_DAYS = Number(process.env.WELCOME_MIN_ACCOUNT_DAYS || 7);

const COLOR_NORMAL = 0xe11d48; // kart ile uyumlu kırmızı-pembe
const COLOR_MILESTONE = 0xf5b301; // altın
const COLOR_ALERT = 0xef4444;

// {user} {count} {server} yerine otomatik doldurulur
const WELCOME_MESSAGES = [
  'Aramıza hoş geldin {user}! Seninle birlikte **{count}** kişi olduk. Keyifli vakit geçirmeni dileriz!',
  '{user} sunucuya katıldı! 🎉 Artık **{count}** kişilik bir aileyiz, hoş geldin!',
  'Hoş geldin {user}! Burada kendini evinde hisset, **{count}** kişilik ekibe katıldın.',
  '{user} aramızda! 🚀 **{count}** kişiyiz, iyi ki geldin!',
  'Selam {user}, {server}\'a hoş geldin! **{count}.** üyemiz oldun, keyifli vakitler dileriz.',
  '{user} geldi, ortam şenlendi! ✨ **{count}** kişi olarak seni bekliyorduk.',
];

function createWelcomeSystem({ token, guildId, channelId, tag = '[WELCOME]', background = 'random' }) {
  // Kartta görünen sunucu adı (süslü Unicode harfler fonta uymadığı için sabit)
  const guildName = process.env.WELCOME_SERVER_NAME || 'Apatheon';
  let memberCount = null;
  let lastMessageIndex = -1;

  const channelUrl = id => `https://discord.com/channels/${guildId}/${id}`;
  const snowflakeDate = id => new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));
  const unix = date => Math.floor(date.getTime() / 1000);

  const avatarUrl = user => {
    if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
    const idx = !user.discriminator || user.discriminator === '0'
      ? Number((BigInt(user.id) >> 22n) % 6n)
      : Number(user.discriminator) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  };

  // =====================================================
  // DISCORD REST
  // =====================================================

  async function api(path, init = {}, attempt = 0) {
    const res = await fetch(`https://discord.com/api/v10${path}`, {
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

  async function postMessage(targetChannelId, payload, png) {
    let init;

    if (png) {
      const form = new FormData();
      form.append('payload_json', JSON.stringify({
        ...payload,
        attachments: [{ id: 0, filename: 'hosgeldin.png' }],
      }));
      form.append('files[0]', new Blob([png], { type: 'image/png' }), 'hosgeldin.png');
      init = { method: 'POST', body: form };
    } else {
      init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      };
    }

    const res = await api(`/channels/${targetChannelId}/messages`, init);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Discord API ${res.status}: ${txt}` +
        (res.status === 403 ? ' (Botun bu kanalda Kanalı Gör / Mesaj Gönder / Dosya Ekle / Bağlantı Yerleştir yetkisi var mı?)' : ''));
    }
  }

  async function fetchMemberCount() {
    try {
      const res = await api(`/guilds/${guildId}?with_counts=true`);
      if (!res.ok) return null;
      const j = await res.json();
      return j.approximate_member_count ?? null;
    } catch { return null; }
  }

  // =====================================================
  // DAVET TAKİBİ (Botta "Sunucuyu Yönet" yetkisi gerekir)
  // =====================================================

  let inviteCache = new Map(); // code -> { uses, maxUses, inviter }
  let inviteLock = Promise.resolve();
  let inviteWarned = false;
  let inviteTimerStarted = false;

  const locked = fn => {
    const run = inviteLock.then(fn).catch(() => null);
    inviteLock = run;
    return run;
  };

  async function fetchInvites() {
    try {
      const res = await api(`/guilds/${guildId}/invites`);

      if (res.status === 401 || res.status === 403) {
        if (!inviteWarned) {
          inviteWarned = true;
          console.warn(`${tag} Davet takibi kapalı: botta "Sunucuyu Yönet" yetkisi yok.`);
        }
        return null;
      }

      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  const toCache = list => new Map(list.map(i => [i.code, {
    uses: i.uses || 0,
    maxUses: i.max_uses || 0,
    inviter: i.inviter || null,
  }]));

  async function doRefreshInvites() {
    const list = await fetchInvites();
    if (list) inviteCache = toCache(list);
  }

  async function doFindInviter() {
    await sleep(700); // Discord'un kullanım sayacını güncellemesine zaman ver

    const list = await fetchInvites();
    if (!list) return null;

    let used = null;

    // 1) Önceden bildiğimiz davetlerden kullanım sayısı artan
    for (const inv of list) {
      const prev = inviteCache.get(inv.code);
      if (prev && (inv.uses || 0) > prev.uses) { used = inv; break; }
    }

    // 2) Yeni açılmış ve kullanılmış davet
    if (!used) {
      for (const inv of list) {
        if (!inviteCache.has(inv.code) && (inv.uses || 0) > 0) { used = inv; break; }
      }
    }

    // 3) Son kullanımda silinen (limiti dolan) davet
    if (!used) {
      const codes = new Set(list.map(i => i.code));
      for (const [code, prev] of inviteCache) {
        if (!codes.has(code) && prev.maxUses && prev.uses + 1 >= prev.maxUses) {
          used = { code, inviter: prev.inviter };
          break;
        }
      }
    }

    inviteCache = toCache(list);

    return used ? { code: used.code, inviter: used.inviter || null } : null;
  }

  const refreshInvites = () => locked(doRefreshInvites);
  const findInviter = () => locked(doFindInviter);

  function startInviteTimer() {
    if (inviteTimerStarted) return;
    inviteTimerStarted = true;
    const t = setInterval(refreshInvites, 3 * 60 * 1000);
    if (t.unref) t.unref();
  }

  // =====================================================
  // YARDIMCILAR
  // =====================================================

  function accountBadge(days) {
    if (days < 7) return '🆕 Yeni Hesap';
    if (days < 30) return '🌱 Taze Hesap';
    if (days < 365) return '⭐ Deneyimli';
    if (days < 365 * 3) return '🏅 Tecrübeli';
    return '👑 Eski Dost';
  }

  function pickMessage() {
    let i;
    do {
      i = Math.floor(Math.random() * WELCOME_MESSAGES.length);
    } while (WELCOME_MESSAGES.length > 1 && i === lastMessageIndex);
    lastMessageIndex = i;
    return WELCOME_MESSAGES[i];
  }

  const formatCount = n => Number(n).toLocaleString('tr-TR');

  function inviterText(inviter) {
    if (!inviter) return 'Bilinmiyor';
    if (inviter.inviter) return `<@${inviter.inviter.id}>\n\`${inviter.code}\``;
    return `\`${inviter.code}\``;
  }

  const inviterInline = inviter => {
    if (!inviter) return null;
    if (inviter.inviter) return `<@${inviter.inviter.id}> (\`${inviter.code}\`)`;
    return `\`${inviter.code}\``;
  };

  function welcomeParts({ user, count, ageDays, inviter, milestone }) {
    const text = pickMessage()
      .replaceAll('{user}', `<@${user.id}>`)
      .replaceAll('{count}', formatCount(count))
      .replaceAll('{server}', guildName);

    let description = text;

    if (milestone === 'gold') {
      description += `\n\n🏆 **${formatCount(count)}. üyemizsin!** Sunucumuzun altın üyelerinden birisin, bu özel sayı için tebrikler!`;
    } else if (milestone === 'silver') {
      description += `\n\n🎉 **${formatCount(count)}. üyemizsin!** Bu özel sayıya ulaştığımız için çok mutluyuz!`;
    }

    const quickStart = [
      `📜 Kuralları oku → <#${CHANNELS.rules}>`,
      `🎫 Destek almak için → <#${CHANNELS.ticket}>`,
      `🔔 Bildirim rolleri → <#${CHANNELS.notifRoles}>`,
      `🎨 Renk rolleri → <#${CHANNELS.colorRoles}>`,
      `♈ Burç rolleri → <#${CHANNELS.zodiacRoles}>`,
    ].join('\n');

    const info = [`🎖️ ${accountBadge(ageDays)}`];
    const inv = inviterInline(inviter);
    if (inv) info.push(`📨 Davet eden: ${inv}`);

    return {
      description,
      quickStart,
      info: info.join('  •  '),
      color: milestone ? COLOR_MILESTONE : COLOR_NORMAL,
    };
  }

  const buttonRow = () => [{
    type: 1,
    components: [
      { type: 2, style: 5, label: 'Kurallar', emoji: { name: '📜' }, url: channelUrl(CHANNELS.rules) },
      { type: 2, style: 5, label: 'Ticket Aç', emoji: { name: '🎫' }, url: channelUrl(CHANNELS.ticket) },
      { type: 2, style: 5, label: 'Bildirim', emoji: { name: '🔔' }, url: channelUrl(CHANNELS.notifRoles) },
      { type: 2, style: 5, label: 'Renk', emoji: { name: '🎨' }, url: channelUrl(CHANNELS.colorRoles) },
      { type: 2, style: 5, label: 'Burç', emoji: { name: '♈' }, url: channelUrl(CHANNELS.zodiacRoles) },
    ],
  }];

  // Ana düzen: büyük görsel + sade yazı + butonlar (tek kutu içinde)
  function buildV2Payload(d) {
    const p = welcomeParts(d);

    return {
      flags: 1 << 15, // IS_COMPONENTS_V2
      allowed_mentions: { users: [d.user.id] },
      components: [{
        type: 17,
        accent_color: p.color,
        components: [
          { type: 12, items: [{ media: { url: 'attachment://hosgeldin.png' }, description: 'Hoş geldin kartı' }] },
          { type: 10, content: `### ✨ ${guildName}'a Hoş Geldin!\n${p.description}` },
          { type: 14, divider: true, spacing: 1 },
          { type: 10, content: `${p.quickStart}\n\n-# ${p.info}` },
          ...buttonRow(),
        ],
      }],
    };
  }

  // Yedek düzen: V2 reddedilirse klasik embed gider
  function buildClassicPayload(d) {
    const p = welcomeParts(d);

    return {
      content: `<@${d.user.id}>`,
      embeds: [{
        color: p.color,
        title: `✨ ${guildName}'a Hoş Geldin!`,
        description: `${p.description}\n\n${p.quickStart}\n\n${p.info}`,
        footer: { text: `${guildName} • Profesyonel Hizmet` },
        timestamp: d.joinedAt.toISOString(),
      }],
      components: buttonRow(),
      allowed_mentions: { users: [d.user.id] },
    };
  }

  async function sendWelcome(png, d) {
    try {
      await postMessage(channelId, buildV2Payload(d), png);
    } catch (error) {
      if (!String(error?.message || '').startsWith('Discord API 400')) throw error;
      console.warn(`${tag} Yeni düzen reddedildi, klasik düzene geçiliyor:`, error.message);
      await postMessage(channelId, buildClassicPayload(d), png);
    }
  }

  async function sendSuspiciousAlert({ user, name, count, createdAt, joinedAt, ageDays, inviter }) {
    if (!LOG_CHANNEL_ID) return;

    const embed = {
      color: COLOR_ALERT,
      title: '⚠️ Şüpheli Yeni Hesap',
      description:
        `<@${user.id}> (\`${user.username}\`) sunucuya katıldı ve hesabı sadece **${ageDays}** günlük.`,
      thumbnail: { url: avatarUrl(user) },
      fields: [
        { name: '👤 Kullanıcı', value: `${name}\nID: \`${user.id}\``, inline: true },
        { name: '📅 Hesap Oluşturma', value: `<t:${unix(createdAt)}:F>\n(<t:${unix(createdAt)}:R>)`, inline: true },
        { name: '📥 Katılma', value: `<t:${unix(joinedAt)}:F>`, inline: true },
        { name: '📨 Davet Eden', value: inviterText(inviter), inline: true },
        { name: '👥 Üye Sırası', value: `#${formatCount(count)}`, inline: true },
      ],
      footer: { text: `${guildName} • Güvenlik Uyarısı` },
      timestamp: joinedAt.toISOString(),
    };

    await postMessage(LOG_CHANNEL_ID, { embeds: [embed], allowed_mentions: { parse: [] } });
  }

  // =====================================================
  // EVENT'LER
  // =====================================================

  return {
    onGuildCreate(d) {
      if (d.id !== guildId) return;
      if (typeof d.member_count === 'number') memberCount = d.member_count;

      refreshInvites();
      startInviteTimer();
    },

    onMemberRemove(d) {
      if (d.guild_id !== guildId || memberCount === null) return;
      memberCount = Math.max(0, memberCount - 1);
    },

    async onMemberAdd(d) {
      if (d.guild_id !== guildId) return;
      if (memberCount !== null) memberCount++;

      const user = d.user;
      if (!user || user.bot) return;

      const count = memberCount ?? (await fetchMemberCount()) ?? 0;
      const name = [d.nick, user.global_name, user.username].map(n => clean(n)).find(Boolean) || 'Yeni Üye';

      const createdAt = snowflakeDate(user.id);
      const joinedAt = d.joined_at ? new Date(d.joined_at) : new Date();
      const ageDays = Math.max(0, Math.floor((joinedAt - createdAt) / 86400000));

      // 500'ün katı: altın, 100'ün katı: gümüş
      const milestone = count > 0 && count % 500 === 0
        ? 'gold'
        : (count > 0 && count % 100 === 0 ? 'silver' : null);

      // Görsel ve davet eden aynı anda hazırlanır
      const [png, inviter] = await Promise.all([
        makeWelcomeImage({
          avatarURL: avatarUrl(user),
          username: name,
          serverName: guildName,
          count,
          createdAt,
          joinedAt,
          background,
          milestone,
        }),
        findInviter(),
      ]);

      await sendWelcome(png, { user, count, joinedAt, ageDays, inviter, milestone });
      console.log(`${tag} Hoş geldin gönderildi -> ${name} (#${count})`);

      if (ageDays < MIN_ACCOUNT_DAYS) {
        try {
          await sendSuspiciousAlert({ user, name, count, createdAt, joinedAt, ageDays, inviter });
          console.log(`${tag} Şüpheli hesap uyarısı gönderildi -> ${name} (${ageDays} gün)`);
        } catch (error) {
          console.error(`${tag} Şüpheli hesap uyarısı hatası:`, error?.message || error);
        }
      }
    },
  };
}

module.exports = { createWelcomeSystem };

// Apatheon - Hoş geldin sistemi (ham gateway eventleri + Discord REST)
// discord.js KULLANMAZ. bot.js içinden event'ler buraya iletilir.
const { makeWelcomeImage, clean } = require('./welcome');

const DISCORD_EPOCH = 1420070400000n;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function createWelcomeSystem({ token, guildId, channelId, tag = '[WELCOME]', background = 'random' }) {
  // Kartta görünen sunucu adı (süslü Unicode harfler fonta uymadığı için sabit)
  const guildName = process.env.WELCOME_SERVER_NAME || 'Apatheon';
  let memberCount = null;

  const snowflakeDate = id => new Date(Number((BigInt(id) >> 22n) + DISCORD_EPOCH));

  const avatarUrl = user => {
    if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
    const idx = !user.discriminator || user.discriminator === '0'
      ? Number((BigInt(user.id) >> 22n) % 6n)
      : Number(user.discriminator) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  };

  async function fetchMemberCount() {
    try {
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
        headers: { Authorization: `Bot ${token}` },
      });
      if (!res.ok) return null;
      const j = await res.json();
      return j.approximate_member_count ?? null;
    } catch { return null; }
  }

  async function send(userId, content, png, attempt = 0) {
    const form = new FormData();
    form.append('payload_json', JSON.stringify({
      content,
      allowed_mentions: { users: [userId] },
      attachments: [{ id: 0, filename: 'hosgeldin.png' }],
    }));
    form.append('files[0]', new Blob([png], { type: 'image/png' }), 'hosgeldin.png');

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${token}` },
      body: form,
    });

    if (res.status === 429 && attempt < 2) {
      const j = await res.json().catch(() => ({}));
      await sleep(((j.retry_after || 1) * 1000) + 250);
      return send(userId, content, png, attempt + 1);
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Discord API ${res.status}: ${txt}` +
        (res.status === 403 ? ' (Botun bu kanalda Kanalı Gör / Mesaj Gönder / Dosya Ekle yetkisi var mı?)' : ''));
    }
  }

  return {
    onGuildCreate(d) {
      if (d.id !== guildId) return;
      if (typeof d.member_count === 'number') memberCount = d.member_count;
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

      const png = await makeWelcomeImage({
        avatarURL: avatarUrl(user),
        username: name,
        serverName: guildName,
        count,
        createdAt: snowflakeDate(user.id),
        joinedAt: d.joined_at ? new Date(d.joined_at) : new Date(),
        background,
      });

      const text =
        `Aramıza hoş geldin <@${user.id}>! Seninle birlikte **${Number(count).toLocaleString('tr-TR')}** kişi olduk. ` +
        `Keyifli vakit geçirmeni dileriz!`;

      await send(user.id, text, png);
      console.log(`${tag} Hoş geldin gönderildi -> ${name} (#${count})`);
    },
  };
}

module.exports = { createWelcomeSystem };

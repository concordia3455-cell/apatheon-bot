const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const GUILD_ID = '1230989327958282340';
const CHANNEL_ID = '1536592873833500742'; // Welcome 3 Kanalı

client.on('ready', async () => {
  console.log(`[BAŞARILI] Bot 3 giriş yaptı: ${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(CHANNEL_ID);

    if (!channel) {
      console.error("[HATA - BOT 3]: Kanal bulunamadı!");
      return;
    }

    joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });
    console.log(`[SES] Bot 3 '${channel.name}' kanalına girdi!`);
  } catch (err) {
    console.error("[HATA - BOT 3 SES/GUILD]:", err.message);
  }
});

console.log("[BOT 3] Discord'a bağlanma isteği gönderiliyor...");

client.login(process.env.BOT_TOKEN_3)
  .then(() => console.log("[BOT 3] Login isteği iletildi!"))
  .catch((err) => console.error("[BOT 3 LOGIN HATASI]:", err.message));

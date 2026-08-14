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
const CHANNEL_ID = '1536592813586522112'; // Welcome 2 Kanalı

client.on('ready', async () => {
  console.log(`[BAŞARILI] Bot 2 giriş yaptı: ${client.user.tag}`);

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(CHANNEL_ID);

    if (!channel) {
      console.error("[HATA - BOT 2]: Kanal bulunamadı!");
      return;
    }

    joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });
    console.log(`[SES] Bot 2 '${channel.name}' kanalına girdi!`);
  } catch (err) {
    console.error("[HATA - BOT 2 SES/GUILD]:", err.message);
  }
});

console.log("[BOT 2] Discord'a bağlanma isteği gönderiliyor...");

client.login(process.env.BOT_TOKEN_2)
  .then(() => console.log("[BOT 2] Login isteği iletildi!"))
  .catch((err) => console.error("[BOT 2 LOGIN HATASI]:", err.message));

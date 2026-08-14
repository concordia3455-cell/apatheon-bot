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
const CHANNEL_ID = '1536592721324548196'; // Kanal 1

client.on('ready', async () => {
  console.log(`[BAŞARILI] Bot 1 giriş yaptı: ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channel = await guild.channels.fetch(CHANNEL_ID);

    if (!channel) {
      console.error("[HATA - BOT 1]: Kanal bulunamadı!");
      return;
    }

    joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true
    });
    console.log(`[SES] Bot 1 '${channel.name}' kanalına girdi!`);
  } catch (err) {
    console.error("[HATA - BOT 1 SES/GUILD]:", err.message);
  }
});

client.login(process.env.BOT_TOKEN_1)
  .then(() => console.log("[BAŞARILI] Bot 1 token doğrulandı, Discord'a bağlanıyor..."))
  .catch((err) => console.error("[CRITICAL HATA - BOT 1 LOGIN]:", err.message));

const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

// Token ve Kanal Bilgilerini Ortam Değişkenlerinden (Environment Variables) Okur
const botList = [
  {
    token: process.env.BOT_TOKEN_1,
    channelId: '1536592721324548196',
    guildId: '1230989327958282340'
  },
  {
    token: process.env.BOT_TOKEN_2,
    channelId: '1536592754828902500',
    guildId: '1230989327958282340'
  },
  {
    token: process.env.BOT_TOKEN_3,
    channelId: '1536592790925082724',
    guildId: '1230989327958282340'
  },
  {
    token: process.env.BOT_TOKEN_4,
    channelId: '1536592811187638332',
    guildId: '1230989327958282340'
  }
];

async function startBots() {
  for (let i = 0; i < botList.length; i++) {
    const botData = botList[i];
    if (!botData.token) continue;

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
      ]
    });

    client.on('ready', async () => {
      console.log(`[BOT ${i + 1}] ${client.user.tag} aktif!`);

      client.user.setPresence({
        activities: [{
          name: 'Apatheon Profesyonel Hizmet',
          type: ActivityType.Streaming,
          url: 'https://www.twitch.tv/discord'
        }],
        status: 'online'
      });

      try {
        const guild = await client.guilds.fetch(botData.guildId);
        const channel = guild ? await guild.channels.fetch(botData.channelId) : null;

        if (channel) {
          joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false
          });
          console.log(`[BOT ${i + 1}] Ses kanalına bağlandı: ${channel.name}`);
        }
      } catch (error) {
        console.error(`[BOT ${i + 1}] Hata:`, error);
      }
    });

    client.login(botData.token);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

startBots();
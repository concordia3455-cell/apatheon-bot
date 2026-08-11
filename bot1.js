const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.on('ready', async () => {
  console.log(`[BOT 1] ${client.user.tag} aktif!`);
  client.user.setPresence({ activities: [{ name: 'Apatheon Profesyonel Hizmet', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], status: 'online' });
  const guild = await client.guilds.fetch('1230989327958282340');
  const channel = await guild.channels.fetch('1536592721324548196');
  if (channel) {
    joinVoiceChannel({ channelId: channel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, selfMute: false });
    console.log(`[BOT 1] Sese bağlandı.`);
  }
});

client.login(process.env.BOT_TOKEN_1);

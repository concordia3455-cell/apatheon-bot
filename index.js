const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

// Web Sunucusu (Render / UptimeRobot için)
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Apatheon Ses Botları Aktif!'));
app.listen(port, () => console.log(`[SUNUCU] Port ${port} dinleniyor.`));

const GUILD_ID = '1230989327958282340';

const botConfigs = [
  { id: 1, token: process.env.BOT_TOKEN_1, channelId: '1536592721324548196' },
  { id: 2, token: process.env.BOT_TOKEN_2, channelId: '1536592813586522112' },
  { id: 3, token: process.env.BOT_TOKEN_3, channelId: '1536592873833500742' },
  { id: 4, token: process.env.BOT_TOKEN_4, channelId: '1536592931442180126' },
];

botConfigs.forEach((config, index) => {
  setTimeout(() => {
    console.log(`[BAŞLATILIYOR] Bot ${config.id} kuruluyor...`);

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
      ],
      // Bağlantı takılmalarını önlemek için ws zaman aşımı
      ws: { timeout: 30000 }
    });

    client.on('ready', async () => {
      console.log(`[EFSANE] Bot ${config.id} ÇEVRİMİÇİ OLDU: ${client.user.tag}`);

      try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const channel = await guild.channels.fetch(config.channelId);

        if (channel) {
          joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true
          });
          console.log(`[SES] Bot ${config.id} -> '${channel.name}' kanalına girdi!`);
        }
      } catch (err) {
        console.error(`[SES HATASI - BOT ${config.id}]:`, err.message);
      }
    });

    client.login(config.token).catch(err => {
      console.error(`[GİRİŞ HATASI - BOT ${config.id}]:`, err.message);
    });

  }, index * 3000); // Her bot arasında 3 saniye bekleme
});

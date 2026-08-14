const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

console.log('[BOT 4] Kod çalıştırılıyor...');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] 
});

client.on('ready', async () => {
    console.log(`[BOT 4] ${client.user.tag} başarıyla giriş yaptı!`);
    client.user.setPresence({ 
        activities: [{ name: '❤️Apatheon Profesyonel Hizmet❤️', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], 
        status: 'online' 
    });

    try {
        const guild = await client.guilds.fetch('1230989327958282340');
        const channel = await guild.channels.fetch('1536592721324548196');
        if (channel) {
            joinVoiceChannel({ 
                channelId: channel.id, 
                guildId: guild.id, 
                adapterCreator: guild.voiceAdapterCreator, 
                selfDeaf: true, 
                selfMute: false 
            });
            console.log(`[BOT 4] Sese başarıyla bağlandı!`);
        }
    } catch (err) {
        console.error(`[BOT 4 SES HATASI]:`, err.message);
    }
});

client.login(process.env.BOT_TOKEN_4).catch((err) => {
    console.error(`[BOT 4 GİRİŞ HATASI]:`, err.message);
});

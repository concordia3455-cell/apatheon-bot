const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

console.log('[BOT 1] Kod çalıştırılıyor...');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

client.on('ready', async () => {
    console.log(`[BOT 1] ${client.user.tag} ONLINE OLDU!`);
    
    try {
        client.user.setPresence({ 
            activities: [{ name: '❤️Apatheon Profesyonel Hizmet❤️', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], 
            status: 'online' 
        });

        const guild = await client.guilds.fetch('1230989327958282340');
        // 1. BOTUN KANAL ID'Sİ:
        const channel = await guild.channels.fetch('1536592721324548196'); 
        if (channel) {
            joinVoiceChannel({ 
                channelId: channel.id, 
                guildId: guild.id, 
                adapterCreator: guild.voiceAdapterCreator, 
                selfDeaf: true, 
                selfMute: false 
            });
            console.log(`[BOT 1] Sese girdi!`);
        }
    } catch (err) {
        console.error(`[BOT 1 İÇ HATA]:`, err.message);
    }
});

console.log('[BOT 1] Token ile giriş deneniyor...');

client.login(process.env.BOT_TOKEN_1).then(() => {
    console.log('[BOT 1] Token kabul edildi!');
}).catch((err) => {
    console.error(`[BOT 1 GİRİŞ HATASI]:`, err.message);
});

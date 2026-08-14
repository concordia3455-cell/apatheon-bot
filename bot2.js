const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

console.log('[BOT 2] Kod çalıştırılıyor...');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

client.on('ready', async () => {
    console.log(`[BOT 2] ${client.user.tag} ONLINE OLDU!`);
    
    try {
        client.user.setPresence({ 
            activities: [{ name: '❤️Apatheon Profesyonel Hizmet❤️', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], 
            status: 'online' 
        });

        const guild = await client.guilds.fetch('1230989327958282340');
        // 2. BOTUN KANAL ID'SİNİ BURAYA YAZ:
        const channel = await guild.channels.fetch('1536592754828902500'); 
        if (channel) {
            joinVoiceChannel({ 
                channelId: channel.id, 
                guildId: guild.id, 
                adapterCreator: guild.voiceAdapterCreator, 
                selfDeaf: true, 
                selfMute: false 
            });
            console.log(`[BOT 2] Sese girdi!`);
        }
    } catch (err) {
        console.error(`[BOT 2 İÇ HATA]:`, err.message);
    }
});

console.log('[BOT 2] Token ile giriş deneniyor...');

client.login(process.env.BOT_TOKEN_2).then(() => {
    console.log('[BOT 2] Token kabul edildi!');
}).catch((err) => {
    console.error(`[BOT 2 GİRİŞ HATASI]:`, err.message);
});

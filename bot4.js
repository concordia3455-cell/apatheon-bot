const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

console.log('[BOT 4] Kod çalıştırılıyor...');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

client.on('ready', async () => {
    console.log(`[BOT 4] ${client.user.tag} ONLINE OLDU!`);
    
    try {
        client.user.setPresence({ 
            activities: [{ name: '❤️Apatheon Profesyonel Hizmet❤️', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], 
            status: 'online' 
        });

        const guild = await client.guilds.fetch('1230989327958282340');
        // 4. BOTUN KANAL ID'SİNİ BURAYA YAZ:
        const channel = await guild.channels.fetch('1536592811187638332'); 
        if (channel) {
            joinVoiceChannel({ 
                channelId: channel.id, 
                guildId: guild.id, 
                adapterCreator: guild.voiceAdapterCreator, 
                selfDeaf: true, 
                selfMute: false 
            });
            console.log(`[BOT 4] Sese girdi!`);
        }
    } catch (err) {
        console.error(`[BOT 4 İÇ HATA]:`, err.message);
    }
});

console.log('[BOT 4] Token ile giriş deneniyor...');

client.login(process.env.BOT_TOKEN_4).then(() => {
    console.log('[BOT 4] Token kabul edildi!');
}).catch((err) => {
    console.error(`[BOT 4 GİRİŞ HATASI]:`, err.message);
});

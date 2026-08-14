const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

console.log('[BOT 3] Kod çalıştırılıyor...');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

client.on('ready', async () => {
    console.log(`[BOT 3] ${client.user.tag} ONLINE OLDU!`);
    
    try {
        client.user.setPresence({ 
            activities: [{ name: '❤️Apatheon Profesyonel Hizmet❤️', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], 
            status: 'online' 
        });

        const guild = await client.guilds.fetch('1230989327958282340');
        // 3. BOTUN KANAL ID'SİNİ BURAYA YAZ:
        const channel = await guild.channels.fetch('1536592790925082724'); 
        if (channel) {
            joinVoiceChannel({ 
                channelId: channel.id, 
                guildId: guild.id, 
                adapterCreator: guild.voiceAdapterCreator, 
                selfDeaf: true, 
                selfMute: false 
            });
            console.log(`[BOT 3] Sese girdi!`);
        }
    } catch (err) {
        console.error(`[BOT 3 İÇ HATA]:`, err.message);
    }
});

console.log('[BOT 3] Token ile giriş deneniyor...');

client.login(process.env.BOT_TOKEN_3).then(() => {
    console.log('[BOT 3] Token kabul edildi!');
}).catch((err) => {
    console.error(`[BOT 3 GİRİŞ HATASI]:`, err.message);
});

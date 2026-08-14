const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

console.log('[BOT 1] Kod çalıştırılıyor...');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ],
    ws: {
        timeout: 30000 // Gateway zaman aşımını 30 saniyeye çekiyoruz ki kilitlenmesin
    }
});

client.on('ready', async () => {
    console.log(`[BOT 1] >>> ${client.user.tag} BARIŞÇIL ŞEKİLDE ONLINE OLDU! <<<`);
    
    try {
        client.user.setPresence({ 
            activities: [{ name: '❤️Apatheon Profesyonel Hizmet❤️', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], 
            status: 'online' 
        });

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
            console.log(`[BOT 1] Sese başarıyla girdi!`);
        }
    } catch (err) {
        console.error(`[BOT 1 İÇ HATA]:`, err.message);
    }
});

// HATA YAKALAMA
client.on('error', (error) => {
    console.error('[BOT 1 WEBSOCKET HATASI]:', error);
});

console.log('[BOT 1] Token ile giriş deneniyor...');

client.login(process.env.BOT_TOKEN_1)
    .then(() => {
        console.log('[BOT 1] Giriş isteği gönderildi, yanıt bekleniyor...');
    })
    .catch((err) => {
        console.error('[BOT 1 GİRİŞ HATASI DETAYI]:', err);
    });

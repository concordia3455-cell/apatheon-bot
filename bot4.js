const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.on('ready', async () => {
    console.log(`[BOT 4] ${client.user.tag} bağlandı!`);
    
    try {
        const guild = await client.guilds.fetch('1230989327958282340'); // Sunucu ID
        const channel = await guild.channels.fetch('1536592811187638332'); // Ses Kanalı ID
        
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
        console.error(`[BOT 4 HATA]:`, err.message);
    }
});

client.login(process.env.BOT_TOKEN_4);

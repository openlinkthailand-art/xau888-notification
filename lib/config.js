const config = {
    // Twelve Data API
    apiKey: (process.env.TWELVE_DATA_API_KEY || '').trim(),
    apiBaseUrl: 'https://api.twelvedata.com',

    // Discord
    discordWebhookUrl: (process.env.DISCORD_WEBHOOK_URL || '').trim(),

    // Cron Secret
    cronSecret: (process.env.CRON_SECRET || '').trim(),

    // RSI Thresholds (adjusted: tighter = fewer false alerts)
    rsiOverbought: 73,
    rsiOversold: 27,

    // Symbol
    symbol: 'XAU/USD',

    // Only 1min timeframe
    timeframes: ['1min'],

    // RSI period
    rsiPeriod: 14,

    // Cooldown: 10 minutes between same-type alerts
    alertCooldownMs: 10 * 60 * 1000,
};

module.exports = { config };

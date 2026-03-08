const { config } = require('./config');

function analyzeRSI(rsiValue) {
    if (rsiValue >= config.rsiOverbought) {
        return {
            isOverbought: true,
            isOversold: false,
            signal: 'OVERBOUGHT',
            emoji: '🔴',
            description: `RSI สูงเกิน ${config.rsiOverbought} → สัญญาณ Overbought (อาจปรับตัวลง)`,
            color: 0xFF4444,
        };
    }

    if (rsiValue <= config.rsiOversold) {
        return {
            isOverbought: false,
            isOversold: true,
            signal: 'OVERSOLD',
            emoji: '🟢',
            description: `RSI ต่ำกว่า ${config.rsiOversold} → สัญญาณ Oversold (อาจดีดตัวขึ้น)`,
            color: 0x00CC66,
        };
    }

    return {
        isOverbought: false,
        isOversold: false,
        signal: null,
        emoji: '⚪',
        description: 'RSI อยู่ในเขตปกติ',
        color: 0x888888,
    };
}

function formatRSI(value) {
    return value.toFixed(2);
}

function getRSIZone(rsiValue) {
    if (rsiValue >= 80) return 'Extreme Overbought 🔥';
    if (rsiValue >= 73) return 'Overbought 🔴';
    if (rsiValue >= 60) return 'Bullish Zone 📈';
    if (rsiValue >= 40) return 'Neutral Zone ⚖️';
    if (rsiValue >= 27) return 'Bearish Zone 📉';
    if (rsiValue >= 20) return 'Oversold 🟢';
    return 'Extreme Oversold ❄️';
}

module.exports = { analyzeRSI, formatRSI, getRSIZone };

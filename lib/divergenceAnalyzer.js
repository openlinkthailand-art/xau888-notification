/**
 * RSI Divergence Analyzer
 * 
 * Detects 4 types of divergence between price and RSI:
 * 
 * REGULAR BULLISH:  Price lower lows + RSI higher lows → Reversal UP 📈
 * REGULAR BEARISH:  Price higher highs + RSI lower highs → Reversal DOWN 📉
 * HIDDEN BULLISH:   Price higher lows + RSI lower lows → Continuation UP 📈
 * HIDDEN BEARISH:   Price lower highs + RSI higher highs → Continuation DOWN 📉
 */

/**
 * Find swing highs and lows in a data series
 * @param {number[]} data - Array of values (oldest to newest)
 * @param {number} lookback - Bars to look left/right (default 3)
 * @returns {{ highs: {index, value}[], lows: {index, value}[] }}
 */
function findSwingPoints(data, lookback = 3) {
    const highs = [];
    const lows = [];

    for (let i = lookback; i < data.length - lookback; i++) {
        let isHigh = true;
        let isLow = true;

        for (let j = 1; j <= lookback; j++) {
            if (data[i] <= data[i - j] || data[i] <= data[i + j]) {
                isHigh = false;
            }
            if (data[i] >= data[i - j] || data[i] >= data[i + j]) {
                isLow = false;
            }
        }

        if (isHigh) highs.push({ index: i, value: data[i] });
        if (isLow) lows.push({ index: i, value: data[i] });
    }

    return { highs, lows };
}

/**
 * Calculate RSI for each bar position (rolling RSI)
 * @param {number[]} closes - Close prices (oldest to newest)
 * @param {number} period - RSI period
 * @returns {number[]} Array of RSI values (same length, first `period` are null)
 */
function calculateRollingRSI(closes, period = 14) {
    const rsiValues = new Array(closes.length).fill(null);

    if (closes.length < period + 1) return rsiValues;

    const changes = [];
    for (let i = 1; i < closes.length; i++) {
        changes.push(closes[i] - closes[i - 1]);
    }

    // Initial average
    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) {
        if (changes[i] >= 0) avgGain += changes[i];
        else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;

    // First RSI
    if (avgLoss === 0) rsiValues[period] = 100;
    else {
        const rs = avgGain / avgLoss;
        rsiValues[period] = 100 - (100 / (1 + rs));
    }

    // Rolling RSI
    for (let i = period; i < changes.length; i++) {
        const gain = changes[i] >= 0 ? changes[i] : 0;
        const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        if (avgLoss === 0) rsiValues[i + 1] = 100;
        else {
            const rs = avgGain / avgLoss;
            rsiValues[i + 1] = 100 - (100 / (1 + rs));
        }
    }

    return rsiValues;
}

/**
 * Analyze divergence between price and RSI
 * @param {number[]} closes - Close prices (oldest to newest)
 * @param {number} rsiPeriod - RSI period
 * @returns {Object} Divergence analysis result
 */
function analyzeDivergence(closes, rsiPeriod = 14) {
    if (closes.length < 30) {
        return { detected: false, message: 'ข้อมูลไม่เพียงพอสำหรับวิเคราะห์ Divergence' };
    }

    // Calculate rolling RSI
    const rsiValues = calculateRollingRSI(closes, rsiPeriod);

    // Filter valid RSI values (non-null) and their corresponding prices
    const validStart = rsiValues.findIndex(v => v !== null);
    if (validStart === -1) {
        return { detected: false, message: 'ไม่สามารถคำนวณ RSI ได้' };
    }

    const validCloses = closes.slice(validStart);
    const validRSI = rsiValues.slice(validStart);

    // Find swing points in price and RSI
    const priceSwings = findSwingPoints(validCloses, 3);
    const rsiSwings = findSwingPoints(validRSI, 3);

    const results = [];

    // ─── Check Bullish Divergence (using swing lows) ───
    if (priceSwings.lows.length >= 2 && rsiSwings.lows.length >= 2) {
        const priceLow1 = priceSwings.lows[priceSwings.lows.length - 2];
        const priceLow2 = priceSwings.lows[priceSwings.lows.length - 1];
        const rsiLow1 = rsiSwings.lows[rsiSwings.lows.length - 2];
        const rsiLow2 = rsiSwings.lows[rsiSwings.lows.length - 1];

        // Regular Bullish: Price ↓↓, RSI ↑↑
        if (priceLow2.value < priceLow1.value && rsiLow2.value > rsiLow1.value) {
            results.push({
                type: 'REGULAR_BULLISH',
                label: 'Regular Bullish Divergence',
                emoji: '🟢📈',
                trend: 'UP',
                trendThai: 'ขาขึ้น',
                description: 'ราคาทำ Lower Low แต่ RSI ทำ Higher Low → สัญญาณกลับตัวขึ้น',
                strength: 'strong',
            });
        }

        // Hidden Bullish: Price ↑↑, RSI ↓↓
        if (priceLow2.value > priceLow1.value && rsiLow2.value < rsiLow1.value) {
            results.push({
                type: 'HIDDEN_BULLISH',
                label: 'Hidden Bullish Divergence',
                emoji: '🔵📈',
                trend: 'UP',
                trendThai: 'ขาขึ้น (ต่อเนื่อง)',
                description: 'ราคาทำ Higher Low แต่ RSI ทำ Lower Low → แนวโน้มขาขึ้นยังคงอยู่',
                strength: 'moderate',
            });
        }
    }

    // ─── Check Bearish Divergence (using swing highs) ───
    if (priceSwings.highs.length >= 2 && rsiSwings.highs.length >= 2) {
        const priceHigh1 = priceSwings.highs[priceSwings.highs.length - 2];
        const priceHigh2 = priceSwings.highs[priceSwings.highs.length - 1];
        const rsiHigh1 = rsiSwings.highs[rsiSwings.highs.length - 2];
        const rsiHigh2 = rsiSwings.highs[rsiSwings.highs.length - 1];

        // Regular Bearish: Price ↑↑, RSI ↓↓
        if (priceHigh2.value > priceHigh1.value && rsiHigh2.value < rsiHigh1.value) {
            results.push({
                type: 'REGULAR_BEARISH',
                label: 'Regular Bearish Divergence',
                emoji: '🔴📉',
                trend: 'DOWN',
                trendThai: 'ขาลง',
                description: 'ราคาทำ Higher High แต่ RSI ทำ Lower High → สัญญาณกลับตัวลง',
                strength: 'strong',
            });
        }

        // Hidden Bearish: Price ↓↓, RSI ↑↑
        if (priceHigh2.value < priceHigh1.value && rsiHigh2.value > rsiHigh1.value) {
            results.push({
                type: 'HIDDEN_BEARISH',
                label: 'Hidden Bearish Divergence',
                emoji: '🟠📉',
                trend: 'DOWN',
                trendThai: 'ขาลง (ต่อเนื่อง)',
                description: 'ราคาทำ Lower High แต่ RSI ทำ Higher High → แนวโน้มขาลงยังคงอยู่',
                strength: 'moderate',
            });
        }
    }

    // ─── Return result ───
    if (results.length === 0) {
        return {
            detected: false,
            type: 'NONE',
            message: 'ไม่พบ Divergence ในขณะนี้',
            trend: 'NEUTRAL',
            trendThai: 'ทรงตัว',
            emoji: '⚖️',
            currentRSI: validRSI[validRSI.length - 1],
        };
    }

    // Pick the strongest/most recent signal
    const strongest = results.find(r => r.strength === 'strong') || results[0];

    return {
        detected: true,
        type: strongest.type,
        label: strongest.label,
        emoji: strongest.emoji,
        trend: strongest.trend,
        trendThai: strongest.trendThai,
        description: strongest.description,
        strength: strongest.strength,
        allSignals: results.map(r => r.type),
        currentRSI: validRSI[validRSI.length - 1],
    };
}

module.exports = { analyzeDivergence, findSwingPoints, calculateRollingRSI };

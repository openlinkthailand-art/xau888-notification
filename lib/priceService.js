const axios = require('axios');
const { config } = require('./config');

/**
 * Fetch forex candle data from Finnhub
 * @param {string} resolution - '1' for 1min, '5' for 5min
 * @param {number} lookbackMinutes - How many minutes of data to fetch
 */
async function fetchCandles(resolution, lookbackMinutes) {
    try {
        const now = Math.floor(Date.now() / 1000);
        const from = now - (lookbackMinutes * 60);

        const response = await axios.get(`${config.finnhubBaseUrl}/forex/candle`, {
            params: {
                symbol: config.symbol,
                resolution: resolution,
                from: from,
                to: now,
                token: config.finnhubApiKey,
            },
            timeout: 8000,
        });

        if (response.data.s === 'no_data') {
            console.log(`No candle data for resolution ${resolution}. Market may be closed.`);
            return null;
        }

        if (response.data.c && response.data.c.length > 0) {
            return {
                closes: response.data.c,       // Close prices
                highs: response.data.h,        // High prices
                lows: response.data.l,         // Low prices
                opens: response.data.o,        // Open prices
                timestamps: response.data.t,   // Unix timestamps
                volume: response.data.v,       // Volume
            };
        }

        return null;
    } catch (error) {
        console.error(`Error fetching candles (res=${resolution}): ${error.message}`);
        return null;
    }
}

/**
 * Calculate RSI from close prices using Wilder's Smoothing
 * (Same method as TradingView)
 * @param {number[]} closes - Array of close prices (oldest to newest)
 * @param {number} period - RSI period (default 14)
 */
function calculateRSI(closes, period = 14) {
    if (closes.length < period + 1) {
        console.log(`Not enough data for RSI: ${closes.length} bars, need ${period + 1}`);
        return null;
    }

    // Calculate price changes
    const changes = [];
    for (let i = 1; i < closes.length; i++) {
        changes.push(closes[i] - closes[i - 1]);
    }

    // Initial average gain/loss (SMA for first period)
    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
        if (changes[i] >= 0) {
            avgGain += changes[i];
        } else {
            avgLoss += Math.abs(changes[i]);
        }
    }
    avgGain /= period;
    avgLoss /= period;

    // Wilder's smoothing for remaining periods
    for (let i = period; i < changes.length; i++) {
        const gain = changes[i] >= 0 ? changes[i] : 0;
        const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

/**
 * Fetch all data: price + RSI for all timeframes
 * Uses only 2 API calls (1 per timeframe)
 */
async function fetchAllData() {
    const rsiResults = {};
    let price = null;

    for (const tf of config.timeframes) {
        const candles = await fetchCandles(tf.resolution, tf.barsMinutes);

        if (candles && candles.closes.length > 0) {
            // Get current price from latest candle close
            if (!price) {
                price = candles.closes[candles.closes.length - 1];
            }

            // Calculate RSI (Finnhub returns oldest to newest, which is what we need)
            const rsi = calculateRSI(candles.closes, config.rsiPeriod);

            if (rsi !== null) {
                // Get the timestamp of the latest candle
                const latestTimestamp = candles.timestamps[candles.timestamps.length - 1];
                const datetime = new Date(latestTimestamp * 1000).toISOString();

                rsiResults[tf.label] = {
                    rsi: rsi,
                    datetime: datetime,
                    interval: tf.label,
                    barsCount: candles.closes.length,
                };
            }
        }
    }

    return { price, rsiResults };
}

module.exports = { fetchAllData, calculateRSI };

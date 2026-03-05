const axios = require('axios');
const { config } = require('./config');

/**
 * Fetch time series candle data from Twelve Data
 * Then calculate RSI locally — saves 1 API call per cycle!
 * @param {string} interval - '1min' or '5min'
 */
async function fetchTimeSeries(interval) {
    try {
        const response = await axios.get(`${config.twelveDataBaseUrl}/time_series`, {
            params: {
                symbol: config.symbol,
                interval: interval,
                outputsize: 50,  // Need enough bars for RSI(14) calculation
                apikey: config.twelveDataApiKey,
            },
            timeout: 8000,
        });

        if (response.data.code) {
            throw new Error(`API Error (${interval}): ${response.data.message}`);
        }

        if (response.data.values && response.data.values.length > 0) {
            return {
                values: response.data.values,
                interval: interval,
            };
        }

        throw new Error(`No data for ${interval}`);
    } catch (error) {
        console.error(`Error fetching time_series (${interval}): ${error.message}`);
        return null;
    }
}

/**
 * Calculate RSI from candle close prices
 * Uses Wilder's Smoothing (same as TradingView)
 * @param {number[]} closes - Array of close prices (newest first)
 * @param {number} period - RSI period (default 14)
 */
function calculateRSI(closes, period = 14) {
    // Reverse so oldest is first
    const prices = [...closes].reverse();

    if (prices.length < period + 1) {
        return null;
    }

    // Calculate price changes
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
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
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
}

/**
 * Fetch all data: price + RSI for all timeframes
 * Only 2 API calls instead of 3!
 */
async function fetchAllData() {
    const rsiResults = {};
    let price = null;

    for (const tf of config.timeframes) {
        const data = await fetchTimeSeries(tf);
        if (data && data.values.length > 0) {
            // Get current price from latest candle
            if (!price) {
                price = parseFloat(data.values[0].close);
            }

            // Calculate RSI from close prices
            const closes = data.values.map(v => parseFloat(v.close));
            const rsi = calculateRSI(closes, config.rsiPeriod);

            if (rsi !== null) {
                rsiResults[tf] = {
                    rsi: rsi,
                    datetime: data.values[0].datetime,
                    interval: tf,
                };
            }
        }
    }

    return { price, rsiResults };
}

module.exports = { fetchAllData, calculateRSI };

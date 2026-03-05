const axios = require('axios');
const { config } = require('./config');

/**
 * Fetch time series data from Twelve Data for a specific interval
 * and calculate RSI locally (saves 1 API call vs using /rsi endpoint)
 */
async function fetchTimeSeries(interval) {
    try {
        const response = await axios.get(`${config.apiBaseUrl}/time_series`, {
            params: {
                symbol: config.symbol,
                interval: interval,
                outputsize: 50,
                apikey: config.apiKey,
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

        return null;
    } catch (error) {
        console.error(`Error fetching time_series (${interval}): ${error.message}`);
        return null;
    }
}

/**
 * Calculate RSI using Wilder's Smoothing (same as TradingView)
 * @param {number[]} closes - Close prices, NEWEST first (Twelve Data order)
 * @param {number} period - RSI period
 */
function calculateRSI(closes, period = 14) {
    // Reverse so oldest is first
    const prices = [...closes].reverse();

    if (prices.length < period + 1) return null;

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
    }

    let avgGain = 0;
    let avgLoss = 0;
    for (let i = 0; i < period; i++) {
        if (changes[i] >= 0) avgGain += changes[i];
        else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;

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
 * Smart fetch: alternates timeframes to use only 1 API call per invocation
 * 
 * How it works:
 * - Each cron call picks which timeframe to check based on current minute
 * - Even minutes → check 1min RSI
 * - Odd minutes  → check 5min RSI
 * - This way each timeframe is checked every 2 cron cycles
 * 
 * With cron every 2 min → each TF checked every 4 min, using only 1 call/cycle
 * Total: ~720 calls/day (within free 800 limit!)
 * 
 * OR pass ?tf=all to check both (2 calls, for manual/status checks)
 */
async function fetchAllData(forceAll = false) {
    const rsiResults = {};
    let price = null;

    let timeframesToCheck;

    if (forceAll) {
        // Check both timeframes (2 API calls)
        timeframesToCheck = config.timeframes;
    } else {
        // Alternate: pick one timeframe based on current minute
        const minute = new Date().getMinutes();
        const index = minute % 2; // 0 or 1
        timeframesToCheck = [config.timeframes[index]];
    }

    for (const tf of timeframesToCheck) {
        const data = await fetchTimeSeries(tf);
        if (data && data.values.length > 0) {
            // Get price from latest candle
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

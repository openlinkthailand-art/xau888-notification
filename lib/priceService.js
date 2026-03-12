const axios = require('axios');
const { config } = require('./config');

/**
 * Fetch time series data from Twelve Data
 */
async function fetchTimeSeries(interval, outputsize = 50) {
    try {
        const response = await axios.get(`${config.apiBaseUrl}/time_series`, {
            params: {
                symbol: config.symbol,
                interval: interval,
                outputsize: outputsize,
                apikey: config.apiKey,
            },
            timeout: 8000,
        });

        if (response.data.code) {
            throw new Error(`API Error (${interval}): ${response.data.message}`);
        }

        if (response.data.values && response.data.values.length > 0) {
            return { values: response.data.values, interval };
        }
        return null;
    } catch (error) {
        console.error(`Error fetching time_series (${interval}): ${error.message}`);
        return null;
    }
}

/**
 * Calculate RSI using Wilder's Smoothing
 */
function calculateRSI(closes, period = 14) {
    const prices = [...closes].reverse();
    if (prices.length < period + 1) return null;

    const changes = [];
    for (let i = 1; i < prices.length; i++) {
        changes.push(prices[i] - prices[i - 1]);
    }

    let avgGain = 0, avgLoss = 0;
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
    return 100 - (100 / (1 + avgGain / avgLoss));
}

/**
 * Fetch 1min RSI data (1 API call)
 */
async function fetch1minData() {
    const data = await fetchTimeSeries('1min', 50);
    if (!data || data.values.length === 0) return null;

    const price = parseFloat(data.values[0].close);
    const closes = data.values.map(v => parseFloat(v.close));
    const rsi = calculateRSI(closes, config.rsiPeriod);

    return {
        price,
        rsi,
        datetime: data.values[0].datetime,
    };
}

/**
 * Fetch 15min candle data for Divergence analysis (1 API call)
 * Returns close prices in oldest-to-newest order for divergence calc
 */
async function fetch15minData() {
    const data = await fetchTimeSeries('15min', 80);
    if (!data || data.values.length === 0) return null;

    // Twelve Data returns newest first — reverse for analysis
    const closes = data.values.map(v => parseFloat(v.close)).reverse();
    const datetime = data.values[0].datetime;

    return { closes, datetime };
}

module.exports = { fetch1minData, fetch15minData, calculateRSI };

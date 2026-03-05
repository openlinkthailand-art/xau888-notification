const axios = require('axios');
const { config } = require('./config');

/**
 * Fetch current XAUUSD price from Twelve Data API
 */
async function fetchCurrentPrice() {
    try {
        const response = await axios.get(`${config.twelveDataBaseUrl}/price`, {
            params: {
                symbol: config.symbol,
                apikey: config.twelveDataApiKey,
            },
            timeout: 8000,
        });

        if (response.data.code) {
            throw new Error(`API Error: ${response.data.message}`);
        }

        return parseFloat(response.data.price);
    } catch (error) {
        console.error(`Error fetching price: ${error.message}`);
        return null;
    }
}

/**
 * Fetch RSI for XAUUSD from Twelve Data API
 * @param {string} interval - Time interval (1min, 5min)
 */
async function fetchRSI(interval) {
    try {
        const response = await axios.get(`${config.twelveDataBaseUrl}/rsi`, {
            params: {
                symbol: config.symbol,
                interval: interval,
                time_period: config.rsiPeriod,
                apikey: config.twelveDataApiKey,
                outputsize: 1,
            },
            timeout: 8000,
        });

        if (response.data.code) {
            throw new Error(`API Error (${interval}): ${response.data.message}`);
        }

        if (response.data.values && response.data.values.length > 0) {
            return {
                rsi: parseFloat(response.data.values[0].rsi),
                datetime: response.data.values[0].datetime,
                interval: interval,
            };
        }

        throw new Error(`No RSI data for ${interval}`);
    } catch (error) {
        console.error(`Error fetching RSI (${interval}): ${error.message}`);
        return null;
    }
}

/**
 * Fetch price and RSI for all timeframes
 */
async function fetchAllData() {
    // Fetch price first
    const price = await fetchCurrentPrice();

    // Fetch RSI for each timeframe sequentially (API rate limit)
    const rsiResults = {};
    for (const tf of config.timeframes) {
        const data = await fetchRSI(tf);
        if (data) {
            rsiResults[tf] = data;
        }
    }

    return { price, rsiResults };
}

module.exports = { fetchCurrentPrice, fetchRSI, fetchAllData };

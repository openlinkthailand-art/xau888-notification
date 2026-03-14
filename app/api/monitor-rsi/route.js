import { NextResponse } from 'next/server';

const { config } = require('@/lib/config');
const { fetch1minData, fetchDivergenceData } = require('@/lib/priceService');
const { analyzeRSI, formatRSI, getRSIZone } = require('@/lib/rsiAnalyzer');
const { analyzeDivergence } = require('@/lib/divergenceAnalyzer');
const { sendRSIAlert } = require('@/lib/discordNotifier');
const { isMarketOpen, getMarketStatus } = require('@/lib/marketHours');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Cooldown tracker
let lastAlertTimestamp = 0;
let lastAlertSignal = '';

function isCooldownActive() {
    return (Date.now() - lastAlertTimestamp) < config.alertCooldownMs;
}
function recordAlert(signal) {
    lastAlertTimestamp = Date.now();
    lastAlertSignal = signal;
}

// ─── Divergence cache per TF ───
// Cache longer for higher TFs to save API calls
const divCache = {
    '5min': { data: null, at: 0, ttl: 5 * 60 * 1000 },   // cache 5 min
    '15min': { data: null, at: 0, ttl: 15 * 60 * 1000 },   // cache 15 min
    '1h': { data: null, at: 0, ttl: 60 * 60 * 1000 },    // cache 60 min
};

/**
 * Fetch divergence for a TF — uses cache, only calls API when expired
 */
async function getDivergence(tf) {
    const cache = divCache[tf];
    const now = Date.now();

    if (cache.data && (now - cache.at) < cache.ttl) {
        return { ...cache.data, cached: true };
    }

    const rawData = await fetchDivergenceData(tf);
    if (!rawData) return cache.data ? { ...cache.data, cached: true } : null;

    const result = analyzeDivergence(rawData.closes, config.rsiPeriod);
    result.datetime = rawData.datetime;
    result.tf = tf;

    cache.data = result;
    cache.at = now;

    return { ...result, cached: false };
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        if (config.cronSecret && secret !== config.cronSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isMarketOpen()) {
            return NextResponse.json({
                success: true,
                marketOpen: false,
                message: getMarketStatus().message,
                timestamp: new Date().toISOString(),
            });
        }

        // ─── 1) Fetch 1min RSI (always 1 API call) ───
        const data1min = await fetch1minData();
        if (!data1min || data1min.rsi === null) {
            return NextResponse.json({
                success: true,
                message: 'No RSI data available.',
                timestamp: new Date().toISOString(),
            });
        }

        // ─── 2) Fetch divergence for 3 TFs (cached, ~0-1 API calls each) ───
        const [div5, div15, div1h] = await Promise.all([
            getDivergence('5min'),
            getDivergence('15min'),
            getDivergence('1h'),
        ]);

        const divergences = {};
        if (div5) divergences['5min'] = div5;
        if (div15) divergences['15min'] = div15;
        if (div1h) divergences['1h'] = div1h;

        // ─── 3) Analyze 1min RSI ───
        const analysis = analyzeRSI(data1min.rsi);
        const now = Date.now();
        const cooldownActive = isCooldownActive();
        const cooldownRemainingSec = cooldownActive
            ? Math.ceil((config.alertCooldownMs - (now - lastAlertTimestamp)) / 1000)
            : 0;

        let alertSent = false;
        let alertSkipped = false;

        // ─── 4) Send Discord ONLY on overbought/oversold ───
        if (analysis.signal) {
            if (cooldownActive) {
                alertSkipped = true;
            } else {
                alertSent = await sendRSIAlert({
                    price: data1min.price,
                    rsi: data1min.rsi,
                    signal: analysis.signal,
                    description: analysis.description,
                    color: analysis.color,
                    emoji: analysis.emoji,
                    datetime: data1min.datetime,
                    divergences: divergences,
                });
                if (alertSent) recordAlert(analysis.signal);
            }
        }

        // ─── 5) JSON Response ───
        const tfLabels = { '5min': '5 นาที', '15min': '15 นาที', '1h': '1 ชั่วโมง' };
        const divResponse = {};
        for (const [tf, div] of Object.entries(divergences)) {
            divResponse[tf] = {
                label: tfLabels[tf],
                detected: div.detected,
                type: div.type || 'NONE',
                typeName: div.label || 'ไม่พบ Divergence',
                trend: div.trend || 'NEUTRAL',
                trendThai: div.trendThai || 'ทรงตัว',
                cached: div.cached,
            };
        }

        return NextResponse.json({
            success: true,
            marketOpen: true,
            price: `$${data1min.price.toFixed(2)}`,
            rsi: {
                tf: '1min',
                value: formatRSI(data1min.rsi),
                zone: getRSIZone(data1min.rsi),
                signal: analysis.signal,
            },
            divergence: divResponse,
            alert: {
                triggered: !!analysis.signal,
                sent: alertSent,
                skipped: alertSkipped,
                cooldown: { active: cooldownActive, remainingSec: cooldownRemainingSec },
            },
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Monitor error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

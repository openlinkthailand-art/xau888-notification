import { NextResponse } from 'next/server';

const { config } = require('@/lib/config');
const { fetch1minData, fetch15minData } = require('@/lib/priceService');
const { analyzeRSI, formatRSI, getRSIZone } = require('@/lib/rsiAnalyzer');
const { analyzeDivergence } = require('@/lib/divergenceAnalyzer');
const { sendRSIAlert } = require('@/lib/discordNotifier');
const { isMarketOpen, getMarketStatus } = require('@/lib/marketHours');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Cooldown tracker
let lastAlertTimestamp = 0;
let lastAlertSignal = '';

// Divergence cache (15min doesn't change every 2 min, cache 5 min)
let cachedDivergence = null;
let divergenceFetchedAt = 0;
const DIVERGENCE_CACHE_MS = 5 * 60 * 1000; // 5 min cache

function isCooldownActive() {
    return (Date.now() - lastAlertTimestamp) < config.alertCooldownMs;
}

function recordAlert(signal) {
    lastAlertTimestamp = Date.now();
    lastAlertSignal = signal;
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        if (config.cronSecret && secret !== config.cronSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Market hours check
        if (!isMarketOpen()) {
            const status = getMarketStatus();
            return NextResponse.json({
                success: true,
                marketOpen: false,
                message: status.message,
                timestamp: new Date().toISOString(),
            });
        }

        // ─── Fetch 1min RSI (1 API call) ───
        const data1min = await fetch1minData();

        if (!data1min || data1min.rsi === null) {
            return NextResponse.json({
                success: true,
                message: 'No RSI data available.',
                timestamp: new Date().toISOString(),
            });
        }

        // ─── Fetch 15min Divergence (1 API call, cached 5 min) ───
        let divergence = cachedDivergence;
        const now = Date.now();

        if (!divergence || (now - divergenceFetchedAt) > DIVERGENCE_CACHE_MS) {
            const data15min = await fetch15minData();
            if (data15min) {
                divergence = analyzeDivergence(data15min.closes, config.rsiPeriod);
                divergence.datetime = data15min.datetime;
                cachedDivergence = divergence;
                divergenceFetchedAt = now;
            }
        }

        // ─── Analyze 1min RSI ───
        const analysis = analyzeRSI(data1min.rsi);
        const cooldownActive = isCooldownActive();
        const cooldownRemainingSec = cooldownActive
            ? Math.ceil((config.alertCooldownMs - (now - lastAlertTimestamp)) / 1000)
            : 0;

        let alertSent = false;
        let alertSkipped = false;

        // ─── Send Discord ONLY on overbought/oversold ───
        if (analysis.signal) {
            if (cooldownActive) {
                alertSkipped = true;
            } else {
                alertSent = await sendRSIAlert({
                    price: data1min.price,
                    rsi: data1min.rsi,
                    interval: '1min',
                    signal: analysis.signal,
                    description: analysis.description,
                    color: analysis.color,
                    emoji: analysis.emoji,
                    datetime: data1min.datetime,
                    divergence: divergence,
                });

                if (alertSent) recordAlert(analysis.signal);
            }
        }

        // ─── JSON Response ───
        return NextResponse.json({
            success: true,
            marketOpen: true,
            price: `$${data1min.price.toFixed(2)}`,
            rsi: {
                tf: '1min',
                value: formatRSI(data1min.rsi),
                zone: getRSIZone(data1min.rsi),
                signal: analysis.signal,
                datetime: data1min.datetime,
            },
            divergence: divergence ? {
                tf: '15min',
                detected: divergence.detected,
                type: divergence.type || 'NONE',
                label: divergence.label || 'ไม่พบ Divergence',
                trend: divergence.trend || 'NEUTRAL',
                trendThai: divergence.trendThai || 'ทรงตัว',
                description: divergence.description || divergence.message,
                cached: (now - divergenceFetchedAt) < DIVERGENCE_CACHE_MS && divergenceFetchedAt > 0,
            } : null,
            alert: {
                triggered: !!analysis.signal,
                sent: alertSent,
                skipped: alertSkipped,
                cooldown: {
                    active: cooldownActive,
                    remainingSec: cooldownRemainingSec,
                },
            },
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Monitor error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

import { NextResponse } from 'next/server';

const { config } = require('@/lib/config');
const { fetchAllData } = require('@/lib/priceService');
const { analyzeRSI, formatRSI, getRSIZone } = require('@/lib/rsiAnalyzer');
const { sendRSIAlert } = require('@/lib/discordNotifier');
const { isMarketOpen, getMarketStatus } = require('@/lib/marketHours');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Cooldown tracker — persists across warm invocations
 */
let lastAlertTimestamp = 0;
let lastAlertSignal = '';

function isCooldownActive() {
    const elapsed = Date.now() - lastAlertTimestamp;
    return elapsed < config.alertCooldownMs;
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

        // ─── Market hours check: ตลาดปิด = ไม่ทำอะไรเลย ───
        if (!isMarketOpen()) {
            const status = getMarketStatus();
            return NextResponse.json({
                success: true,
                marketOpen: false,
                message: status.message,
                timestamp: new Date().toISOString(),
            });
        }

        // ─── Fetch price & RSI ───
        const { price, rsiResults } = await fetchAllData();

        if (Object.keys(rsiResults).length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No RSI data available.',
                timestamp: new Date().toISOString(),
            });
        }

        // ─── Analyze RSI ───
        const alerts = [];
        const results = {};
        const cooldownActive = isCooldownActive();
        const cooldownRemainingSec = cooldownActive
            ? Math.ceil((config.alertCooldownMs - (Date.now() - lastAlertTimestamp)) / 1000)
            : 0;

        for (const [interval, data] of Object.entries(rsiResults)) {
            const analysis = analyzeRSI(data.rsi);

            results[interval] = {
                rsi: formatRSI(data.rsi),
                zone: getRSIZone(data.rsi),
                signal: analysis.signal,
                datetime: data.datetime,
            };

            // ─── ONLY send Discord when RSI hits threshold ───
            if (analysis.signal) {
                if (cooldownActive) {
                    alerts.push({
                        timeframe: interval,
                        signal: analysis.signal,
                        rsi: formatRSI(data.rsi),
                        sent: false,
                        reason: `Cooldown (${cooldownRemainingSec}s left)`,
                    });
                } else {
                    const sent = await sendRSIAlert({
                        price,
                        rsi: data.rsi,
                        interval,
                        signal: analysis.signal,
                        description: analysis.description,
                        color: analysis.color,
                        emoji: analysis.emoji,
                        datetime: data.datetime,
                    });

                    if (sent) recordAlert(analysis.signal);

                    alerts.push({
                        timeframe: interval,
                        signal: analysis.signal,
                        rsi: formatRSI(data.rsi),
                        sent,
                    });
                }
            }
        }

        // ─── Response (JSON only, NO Discord unless alert) ───
        return NextResponse.json({
            success: true,
            marketOpen: true,
            price: price ? `$${price.toFixed(2)}` : 'N/A',
            results,
            alerts,
            alertCount: alerts.filter(a => a.sent).length,
            cooldown: {
                active: cooldownActive,
                remainingSec: cooldownRemainingSec,
                lastSignal: lastAlertSignal || 'none',
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

import { NextResponse } from 'next/server';

const { config } = require('@/lib/config');
const { fetchAllData } = require('@/lib/priceService');
const { analyzeRSI, formatRSI, getRSIZone } = require('@/lib/rsiAnalyzer');
const { sendRSIAlert, sendStatusUpdate } = require('@/lib/discordNotifier');
const { isMarketOpen, getMarketStatus } = require('@/lib/marketHours');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Cooldown tracker — persists across warm invocations
 * Cron hits every 2 min so instance stays warm = cooldown works reliably
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

        const testMode = searchParams.get('test') === '1';

        // ─── Market hours check: skip everything when closed ───
        if (!isMarketOpen() && !testMode) {
            const status = getMarketStatus();
            return NextResponse.json({
                success: true,
                marketOpen: false,
                message: status.message,
                timestamp: new Date().toISOString(),
            });
        }

        const { price, rsiResults } = await fetchAllData();

        if (Object.keys(rsiResults).length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No RSI data available. Market might be closed.',
                timestamp: new Date().toISOString(),
            });
        }

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

            if (analysis.signal) {
                if (cooldownActive) {
                    // Skip alert — cooldown active
                    alerts.push({
                        timeframe: interval,
                        signal: analysis.signal,
                        rsi: formatRSI(data.rsi),
                        sent: false,
                        skipped: true,
                        reason: `Cooldown active (${cooldownRemainingSec}s remaining)`,
                    });
                } else {
                    // Send alert!
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

                    if (sent) {
                        recordAlert(analysis.signal);
                    }

                    alerts.push({
                        timeframe: interval,
                        signal: analysis.signal,
                        rsi: formatRSI(data.rsi),
                        sent,
                        skipped: false,
                    });
                }
            }
        }

        // Test mode: always send status to Discord
        if (testMode) {
            await sendStatusUpdate(rsiResults, price);
            return NextResponse.json({
                success: true,
                testMode: true,
                message: '✅ Test notification sent to Discord!',
                price: price ? `$${price.toFixed(2)}` : 'N/A',
                results,
                alerts,
                cooldown: {
                    active: cooldownActive,
                    remainingSec: cooldownRemainingSec,
                    lastSignal: lastAlertSignal || 'none',
                },
                timestamp: new Date().toISOString(),
            });
        }

        return NextResponse.json({
            success: true,
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

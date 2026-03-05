import { NextResponse } from 'next/server';

const { config } = require('@/lib/config');
const { fetchAllData } = require('@/lib/priceService');
const { analyzeRSI, formatRSI, getRSIZone } = require('@/lib/rsiAnalyzer');
const { sendRSIAlert, sendStatusUpdate } = require('@/lib/discordNotifier');

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        if (config.cronSecret && secret !== config.cronSecret) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const forceStatus = searchParams.get('status') === '1';
        const forceAll = searchParams.get('tf') === 'all';
        const testMode = searchParams.get('test') === '1';

        const { price, rsiResults } = await fetchAllData(forceAll || testMode);

        if (Object.keys(rsiResults).length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No RSI data available. Market might be closed.',
                timestamp: new Date().toISOString(),
            });
        }

        const alerts = [];
        const results = {};

        for (const [interval, data] of Object.entries(rsiResults)) {
            const analysis = analyzeRSI(data.rsi);
            const tfLabel = interval === '1min' ? '1 นาที' : '5 นาที';

            results[interval] = {
                rsi: formatRSI(data.rsi),
                zone: getRSIZone(data.rsi),
                signal: analysis.signal,
                datetime: data.datetime,
            };

            if (analysis.signal) {
                // Real alert — RSI is overbought or oversold
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

                alerts.push({
                    timeframe: tfLabel,
                    signal: analysis.signal,
                    rsi: formatRSI(data.rsi),
                    sent,
                });
            }
        }

        // Test mode: always send a status update to Discord so user can verify
        if (testMode) {
            await sendStatusUpdate(rsiResults, price);
            return NextResponse.json({
                success: true,
                testMode: true,
                message: '✅ Test notification sent to Discord!',
                price: price ? `$${price.toFixed(2)}` : 'N/A',
                results,
                alerts,
                alertCount: alerts.length,
                timestamp: new Date().toISOString(),
            });
        }

        // Force status update if requested and no alerts
        if (forceStatus && alerts.length === 0) {
            await sendStatusUpdate(rsiResults, price);
        }

        return NextResponse.json({
            success: true,
            price: price ? `$${price.toFixed(2)}` : 'N/A',
            results,
            alerts,
            alertCount: alerts.length,
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

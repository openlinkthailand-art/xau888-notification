/**
 * Gold (XAU/USD) Market Hours Checker
 * 
 * Forex gold market hours (approximate):
 * - Opens:  Sunday  22:00 UTC  (Monday  05:00 Bangkok)
 * - Closes: Friday  21:00 UTC  (Saturday 04:00 Bangkok)
 * - Daily maintenance break: ~21:00-22:00 UTC (Mon-Thu)
 * 
 * Closed:
 * - All of Saturday (after 21:00 UTC Friday)
 * - Most of Sunday (until 22:00 UTC Sunday)
 */

function isMarketOpen() {
    const now = new Date();
    const utcDay = now.getUTCDay();    // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    const utcHour = now.getUTCHours();

    // Saturday = always closed
    if (utcDay === 6) return false;

    // Sunday = closed until ~22:00 UTC (market opens Sunday evening)
    if (utcDay === 0 && utcHour < 22) return false;

    // Friday = closes at ~21:00 UTC
    if (utcDay === 5 && utcHour >= 21) return false;

    // Daily maintenance break ~21:00-22:00 UTC (Mon-Thu)
    if (utcDay >= 1 && utcDay <= 4 && utcHour === 21) return false;

    return true;
}

function getMarketStatus() {
    if (isMarketOpen()) {
        return { open: true, message: 'Market is OPEN 🟢' };
    }

    const now = new Date();
    const utcDay = now.getUTCDay();

    if (utcDay === 6 || (utcDay === 0 && now.getUTCHours() < 22)) {
        return { open: false, message: 'Weekend — ตลาดปิด (เปิดวันจันทร์ 05:00 เวลาไทย) 🔴' };
    }

    if (utcDay === 5 && now.getUTCHours() >= 21) {
        return { open: false, message: 'ตลาดปิดสิ้นสัปดาห์แล้ว (เปิดใหม่วันจันทร์ 05:00 เวลาไทย) 🔴' };
    }

    return { open: false, message: 'Daily maintenance break (~04:00-05:00 เวลาไทย) ⏸️' };
}

module.exports = { isMarketOpen, getMarketStatus };

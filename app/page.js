export default function Home() {
  return (
    <div className="container">
      {/* Hero */}
      <section className="hero">
        <div className="hero-icon">🪙</div>
        <h1>XAU888 Notification</h1>
        <p>Real-time XAUUSD Gold RSI Monitor → Discord Alerts</p>
        <div className="status-badge">
          <span className="status-dot"></span>
          System Active
        </div>
      </section>

      {/* Info Cards */}
      <div className="cards-grid">
        <div className="card">
          <div className="card-icon">📊</div>
          <div className="card-label">Indicator</div>
          <div className="card-value">RSI (14)</div>
          <div className="card-sub">Relative Strength Index</div>
        </div>

        <div className="card">
          <div className="card-icon">⏰</div>
          <div className="card-label">Timeframes</div>
          <div className="card-value">1m / 5m</div>
          <div className="card-sub">1 minute &amp; 5 minutes</div>
        </div>

        <div className="card">
          <div className="card-icon">🔴</div>
          <div className="card-label">Overbought</div>
          <div className="card-value" style={{ color: '#f87171' }}>&ge; 70</div>
          <div className="card-sub">อาจปรับตัวลง</div>
        </div>

        <div className="card">
          <div className="card-icon">🟢</div>
          <div className="card-label">Oversold</div>
          <div className="card-value" style={{ color: '#4ade80' }}>&le; 30</div>
          <div className="card-sub">อาจดีดตัวขึ้น</div>
        </div>

        <div className="card">
          <div className="card-icon">💬</div>
          <div className="card-label">Alert Channel</div>
          <div className="card-value">Discord</div>
          <div className="card-sub">Via Webhook</div>
        </div>

        <div className="card">
          <div className="card-icon">🔄</div>
          <div className="card-label">Trigger</div>
          <div className="card-value">Cron Job</div>
          <div className="card-sub">External cron service</div>
        </div>
      </div>

      {/* API Endpoint */}
      <section className="endpoint-section">
        <div className="config-section">
          <h2>🔗 API Endpoint</h2>
        </div>
        <div className="endpoint-box">
          <div className="endpoint-label">Monitor RSI</div>
          <div className="endpoint-url">
            GET /api/monitor-rsi?secret=YOUR_CRON_SECRET
          </div>
          <div className="endpoint-note">
            ใช้ URL นี้กับ cron-job.org เพื่อตรวจสอบ RSI ตามความถี่ที่ต้องการ<br />
            เพิ่ม <code>?status=1</code> เพื่อบังคับส่ง status update ไป Discord
          </div>
        </div>
      </section>

      {/* Config Table */}
      <section className="config-section">
        <h2>⚙️ Configuration</h2>
        <table className="config-table">
          <thead>
            <tr>
              <th>Environment Variable</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>TWELVE_DATA_API_KEY</td>
              <td>Set in Vercel Dashboard</td>
            </tr>
            <tr>
              <td>DISCORD_WEBHOOK_URL</td>
              <td>Set in Vercel Dashboard</td>
            </tr>
            <tr>
              <td>CRON_SECRET</td>
              <td>Set in Vercel Dashboard</td>
            </tr>
            <tr>
              <td>RSI_OVERBOUGHT</td>
              <td>70</td>
            </tr>
            <tr>
              <td>RSI_OVERSOLD</td>
              <td>30</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Footer */}
      <footer className="footer">
        XAU888 Notification System v2.0 — Powered by Next.js + Vercel + Twelve Data
      </footer>
    </div>
  );
}

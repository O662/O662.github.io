/* =============================================================
   Commodity Tracker – JavaScript
   Fetches data from Yahoo Finance via CORS proxy.
   Falls back to realistic simulated data when the API is
   unreachable (common on static GitHub-Pages sites).
   ============================================================= */

// ── Commodity Definitions (grouped by type) ─────────────────
const COMMODITY_GROUPS = {
    precious: {
        label: 'Precious Metals',
        color: '#FFD700',
        items: [
            { symbol: 'GC=F', name: 'Gold',     unit: '$/oz',  basePrice: 2380 },
            { symbol: 'SI=F', name: 'Silver',   unit: '$/oz',  basePrice: 28.5 },
            { symbol: 'PL=F', name: 'Platinum', unit: '$/oz',  basePrice: 1015 },
        ],
    },
    industrial: {
        label: 'Industrial Metals',
        color: '#5DADE2',
        items: [
            { symbol: 'HG=F',  name: 'Copper',  unit: '$/lb',  basePrice: 4.25 },
            { symbol: 'MZN=F', name: 'Zinc',    unit: '$/lb',  basePrice: 1.28 },
            { symbol: 'MCU=F', name: 'Cobalt',  unit: '$/lb',  basePrice: 13.6 },
            { symbol: 'MPB=F', name: 'Lead',    unit: '$/lb',  basePrice: 0.96 },
        ],
    },
    energy: {
        label: 'Energy',
        color: '#E74C3C',
        items: [
            { symbol: 'CL=F', name: 'Crude Oil',   unit: '$/bbl',   basePrice: 72.4 },
            { symbol: 'NG=F', name: 'Natural Gas',  unit: '$/MMBtu', basePrice: 2.55 },
        ],
    },
    agriculture: {
        label: 'Agriculture',
        color: '#27AE60',
        items: [
            { symbol: 'CC=F', name: 'Cocoa',    unit: '$/ton', basePrice: 4050 },
            { symbol: 'KC=F', name: 'Coffee',   unit: '$/lb',  basePrice: 2.22 },
            { symbol: 'SB=F', name: 'Sugar',    unit: '¢/lb',  basePrice: 22.3 },
            { symbol: 'ZS=F', name: 'Soybeans', unit: '$/bu',  basePrice: 12.45 },
            { symbol: 'ZW=F', name: 'Wheat',    unit: '$/bu',  basePrice: 6.52 },
        ],
    },
};

// ── State ───────────────────────────────────────────────────
let selectedCommodity = null;   // { groupKey, index, ...commodity }
let chart1Day = null;
let chart90Day = null;
let isLiveData = false;

// ── CORS Proxies (tried in order) ───────────────────────────
const CORS_PROXIES = [
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

// ── Yahoo Finance helpers ───────────────────────────────────
function yahooChartURL(symbol, range, interval) {
    return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
}

async function fetchWithProxy(url) {
    for (const makeProxy of CORS_PROXIES) {
        try {
            const res = await fetch(makeProxy(url), { signal: AbortSignal.timeout(8000) });
            if (!res.ok) continue;
            return await res.json();
        } catch { /* try next proxy */ }
    }
    return null;
}

/**
 * Fetch chart data from Yahoo Finance.
 * Returns { timestamps[], closes[], meta } or null on failure.
 */
async function fetchChartData(symbol, range, interval) {
    const raw = await fetchWithProxy(yahooChartURL(symbol, range, interval));
    try {
        const result = raw.chart.result[0];
        const timestamps = result.timestamp.map(t => t * 1000); // ms
        const closes = result.indicators.quote[0].close;
        return { timestamps, closes, meta: result.meta };
    } catch {
        return null;
    }
}

/**
 * Fetch current quote snapshot for a commodity.
 * Returns { price, prevClose } or null.
 */
async function fetchQuote(symbol) {
    // We reuse the 1-day chart endpoint because Yahoo's v7 quote
    // endpoint requires authentication.
    const data = await fetchChartData(symbol, '1d', '5m');
    if (!data) return null;
    const price = data.meta.regularMarketPrice;
    const prevClose = data.meta.chartPreviousClose ?? data.meta.previousClose;
    return { price, prevClose };
}

// ── Demo / Simulated Data ───────────────────────────────────
function generateDemoTimestamps1Day() {
    const now = new Date();
    const open = new Date(now);
    open.setHours(9, 30, 0, 0);
    const points = [];
    for (let m = 0; m < 390; m += 5) {      // 9:30 → 16:00 in 5-min steps
        const t = new Date(open.getTime() + m * 60000);
        if (t > now) break;
        points.push(t.getTime());
    }
    return points.length > 0 ? points : [now.getTime()];
}

function generateDemoTimestamps90Day() {
    const points = [];
    const now = new Date();
    for (let d = 90; d >= 0; d--) {
        const t = new Date(now);
        t.setDate(t.getDate() - d);
        t.setHours(16, 0, 0, 0);
        if (t.getDay() === 0 || t.getDay() === 6) continue; // skip weekends
        points.push(t.getTime());
    }
    return points;
}

function generateDemoPrices(base, count, volatility = 0.004) {
    const prices = [base * (1 + (Math.random() - 0.5) * 0.01)];
    for (let i = 1; i < count; i++) {
        const change = prices[i - 1] * (Math.random() - 0.48) * volatility;
        prices.push(+(prices[i - 1] + change).toFixed(4));
    }
    return prices;
}

function getDemoData(commodity, range) {
    const is1d = range === '1d';
    const timestamps = is1d ? generateDemoTimestamps1Day() : generateDemoTimestamps90Day();
    const vol = is1d ? 0.003 : 0.012;
    const closes = generateDemoPrices(commodity.basePrice, timestamps.length, vol);
    return { timestamps, closes };
}

function getDemoQuote(commodity) {
    const swing = commodity.basePrice * (Math.random() - 0.48) * 0.015;
    const price = +(commodity.basePrice + swing).toFixed(2);
    const prevClose = +(price - price * (Math.random() - 0.45) * 0.012).toFixed(2);
    return { price, prevClose };
}

// ── Formatting Helpers ──────────────────────────────────────
function fmtPrice(val) {
    if (val >= 1000) return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (val >= 10)   return val.toFixed(2);
    return val.toFixed(val < 1 ? 4 : 2);
}

function fmtChange(price, prevClose) {
    if (!prevClose || prevClose === 0) return { text: '—', positive: true };
    const diff = price - prevClose;
    const pct = (diff / prevClose) * 100;
    const sign = diff >= 0 ? '+' : '';
    return {
        text: `${sign}${diff.toFixed(2)} (${sign}${pct.toFixed(2)}%)`,
        positive: diff >= 0,
    };
}

// ── Card Rendering ──────────────────────────────────────────
function renderCards() {
    for (const [groupKey, group] of Object.entries(COMMODITY_GROUPS)) {
        const container = document.getElementById(`group-${groupKey}`);
        if (!container) continue;
        container.innerHTML = '';

        group.items.forEach((commodity, idx) => {
            const card = document.createElement('div');
            card.className = `commodity-card ${groupKey}`;
            card.dataset.group = groupKey;
            card.dataset.index = idx;

            card.innerHTML = `
                <div class="card-name">${commodity.name}</div>
                <div class="card-price card-loading">Loading…</div>
                <div class="card-change"></div>
            `;

            card.addEventListener('click', () => selectCommodity(groupKey, idx));
            container.appendChild(card);
        });
    }
}

async function loadQuotes() {
    const tasks = [];
    for (const [groupKey, group] of Object.entries(COMMODITY_GROUPS)) {
        group.items.forEach((commodity, idx) => {
            tasks.push(
                fetchQuote(commodity.symbol).then(quote => ({ groupKey, idx, commodity, quote }))
            );
        });
    }

    const results = await Promise.allSettled(tasks);
    let anyLive = false;

    for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        const { groupKey, idx, commodity, quote } = r.value;
        const container = document.getElementById(`group-${groupKey}`);
        const card = container?.children[idx];
        if (!card) continue;

        const q = quote || getDemoQuote(commodity);
        if (quote) anyLive = true;

        const chg = fmtChange(q.price, q.prevClose);
        card.querySelector('.card-price').textContent = `${fmtPrice(q.price)}`;
        card.querySelector('.card-price').classList.remove('card-loading');
        card.querySelector('.card-price').innerHTML = `${fmtPrice(q.price)} <span class="card-unit">${commodity.unit}</span>`;
        const changeEl = card.querySelector('.card-change');
        changeEl.textContent = chg.text;
        changeEl.className = `card-change ${chg.positive ? 'positive' : 'negative'}`;

        // Store quote on the commodity object for later use
        commodity._quote = q;
    }

    isLiveData = anyLive;
    const statusEl = document.getElementById('data-status');
    if (statusEl) {
        statusEl.textContent = anyLive
            ? '● Live data from Yahoo Finance'
            : '● Simulated data – live feed unavailable';
        statusEl.className = `data-status ${anyLive ? 'live' : 'demo'}`;
    }
}

// ── Chart Rendering ─────────────────────────────────────────
const CHART_COLORS = {
    precious:    { line: '#FFD700', fill: 'rgba(255, 215, 0, 0.08)' },
    industrial:  { line: '#5DADE2', fill: 'rgba(93, 173, 226, 0.08)' },
    energy:      { line: '#E74C3C', fill: 'rgba(231, 76, 60, 0.08)' },
    agriculture: { line: '#27AE60', fill: 'rgba(39, 174, 96, 0.08)' },
};

function buildChartConfig(labels, data, groupKey, is1Day) {
    const colors = CHART_COLORS[groupKey] || CHART_COLORS.precious;
    return {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data,
                borderColor: colors.line,
                backgroundColor: colors.fill,
                borderWidth: 2,
                pointRadius: 0,
                pointHitRadius: 6,
                fill: true,
                tension: 0.3,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e1e1e',
                    titleColor: '#aaa',
                    bodyColor: '#efefef',
                    borderColor: '#333',
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        label: ctx => `  ${fmtPrice(ctx.parsed.y)}`,
                    },
                },
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: is1Day ? 'hour' : 'week',
                        tooltipFormat: is1Day ? 'HH:mm' : 'MMM d, yyyy',
                        displayFormats: {
                            hour: 'HH:mm',
                            day: 'MMM d',
                            week: 'MMM d',
                        },
                    },
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#666', maxTicksLimit: 8 },
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        color: '#666',
                        callback: v => fmtPrice(v),
                    },
                },
            },
        },
    };
}

async function updateCharts(groupKey, commodity) {
    // Fetch (or generate demo) data for both ranges in parallel
    const [data1d, data90d] = await Promise.all([
        fetchChartData(commodity.symbol, '1d', '5m').then(d => d || getDemoData(commodity, '1d')),
        fetchChartData(commodity.symbol, '3mo', '1d').then(d => d || getDemoData(commodity, '90d')),
    ]);

    // 1-Day chart
    const labels1d = data1d.timestamps.map(t => new Date(t));
    const closes1d = data1d.closes;
    if (chart1Day) chart1Day.destroy();
    chart1Day = new Chart(
        document.getElementById('chart-1day'),
        buildChartConfig(labels1d, closes1d, groupKey, true),
    );
    document.getElementById('overlay-1day')?.classList.add('hidden');

    // 90-Day chart
    const labels90d = data90d.timestamps.map(t => new Date(t));
    const closes90d = data90d.closes;
    if (chart90Day) chart90Day.destroy();
    chart90Day = new Chart(
        document.getElementById('chart-90day'),
        buildChartConfig(labels90d, closes90d, groupKey, false),
    );
    document.getElementById('overlay-90day')?.classList.add('hidden');
}

// ── Selection Logic ─────────────────────────────────────────
async function selectCommodity(groupKey, idx) {
    const commodity = COMMODITY_GROUPS[groupKey].items[idx];
    selectedCommodity = { groupKey, idx, ...commodity };

    // Highlight active card
    document.querySelectorAll('.commodity-card').forEach(c => c.classList.remove('active'));
    const container = document.getElementById(`group-${groupKey}`);
    container?.children[idx]?.classList.add('active');

    // Update info banner
    const infoEl = document.getElementById('selected-commodity-info');
    infoEl?.classList.remove('hidden');
    document.getElementById('selected-name').textContent = commodity.name;

    const q = commodity._quote || getDemoQuote(commodity);
    document.getElementById('selected-price').textContent = `${fmtPrice(q.price)} ${commodity.unit}`;
    const chg = fmtChange(q.price, q.prevClose);
    const changeEl = document.getElementById('selected-change');
    changeEl.textContent = chg.text;
    changeEl.className = `selected-change ${chg.positive ? 'positive' : 'negative'}`;

    // Show loading state on charts briefly
    document.getElementById('overlay-1day')?.classList.remove('hidden');
    document.getElementById('overlay-90day')?.classList.remove('hidden');
    document.querySelector('#overlay-1day p').textContent = 'Loading chart…';
    document.querySelector('#overlay-90day p').textContent = 'Loading chart…';

    await updateCharts(groupKey, commodity);
}

// ── Initialise ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderCards();
    loadQuotes();
});

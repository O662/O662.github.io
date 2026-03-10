/* =============================================================
   Commodity Tracker – JavaScript
   Fetches data from Yahoo Finance via CORS proxy.
   Falls back to realistic simulated data when the API is
   unreachable (common on static GitHub-Pages sites).
   ============================================================= */

// ── Commodity Definitions (grouped by type) ─────────────────
// No hardcoded prices – all prices are fetched dynamically.
// _fallbackBase is only used as a last-resort seed for simulated
// data when the API is completely unreachable and no live quote
// has been received yet. Once a live quote arrives it is used instead.
const COMMODITY_GROUPS = {
    precious: {
        label: 'Precious Metals',
        color: '#FFD700',
        items: [
            { symbol: 'GC=F', name: 'Gold',     unit: '$/oz',  _fallbackBase: 2380 },
            { symbol: 'SI=F', name: 'Silver',   unit: '$/oz',  _fallbackBase: 28.5 },
            { symbol: 'PL=F', name: 'Platinum', unit: '$/oz',  _fallbackBase: 1015 },
        ],
    },
    industrial: {
        label: 'Industrial Metals',
        color: '#5DADE2',
        items: [
            { symbol: 'HG=F',  name: 'Copper',  unit: '$/lb',  _fallbackBase: 4.25 },
            { symbol: 'MZN=F', name: 'Zinc',    unit: '$/lb',  _fallbackBase: 1.28 },
            { symbol: 'MCU=F', name: 'Cobalt',  unit: '$/lb',  _fallbackBase: 13.6 },
            { symbol: 'MPB=F', name: 'Lead',    unit: '$/lb',  _fallbackBase: 0.96 },
        ],
    },
    energy: {
        label: 'Energy',
        color: '#E74C3C',
        items: [
            { symbol: 'CL=F', name: 'Crude Oil',   unit: '$/bbl',   _fallbackBase: 72.4 },
            { symbol: 'NG=F', name: 'Natural Gas',  unit: '$/MMBtu', _fallbackBase: 2.55 },
        ],
    },
    agriculture: {
        label: 'Agriculture',
        color: '#27AE60',
        items: [
            { symbol: 'CC=F', name: 'Cocoa',    unit: '$/ton', _fallbackBase: 4050 },
            { symbol: 'KC=F', name: 'Coffee',   unit: '$/lb',  _fallbackBase: 2.22 },
            { symbol: 'SB=F', name: 'Sugar',    unit: '¢/lb',  _fallbackBase: 22.3 },
            { symbol: 'ZS=F', name: 'Soybeans', unit: '$/bu',  _fallbackBase: 12.45 },
            { symbol: 'ZW=F', name: 'Wheat',    unit: '$/bu',  _fallbackBase: 6.52 },
        ],
    },
};

/** Return the best known base price for a commodity.
 *  Prefers the live quote price, falls back to _fallbackBase. */
function getBasePrice(commodity) {
    return commodity._quote?.price ?? commodity._fallbackBase;
}

// ── State ───────────────────────────────────────────────────
let selectedCommodity = null;   // { groupKey, index, ...commodity }
let chart1Day = null;
let chart90Day = null;
let isLiveData = false;
let currentRange = '3mo';       // default range for the second chart

// Range options for the second chart
const RANGE_OPTIONS = [
    { key: '1mo',  label: '30 Days',  yahooRange: '1mo',  yahooInterval: '1d',  timeUnit: 'day',  days: 30  },
    { key: '3mo',  label: '90 Days',  yahooRange: '3mo',  yahooInterval: '1d',  timeUnit: 'week', days: 90  },
    { key: '6mo',  label: '6 Months', yahooRange: '6mo',  yahooInterval: '1d',  timeUnit: 'month',days: 180 },
    { key: 'ytd',  label: 'YTD',      yahooRange: 'ytd',  yahooInterval: '1d',  timeUnit: 'month',days: null },
];

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

function generateDemoTimestampsNDay(days) {
    const points = [];
    const now = new Date();
    for (let d = days; d >= 0; d--) {
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
    const base = getBasePrice(commodity);
    if (range === '1d') {
        const timestamps = generateDemoTimestamps1Day();
        return { timestamps, closes: generateDemoPrices(base, timestamps.length, 0.003) };
    }
    // For multi-day ranges, determine how many calendar days to simulate
    let days = 90;
    if (range === '1mo')  days = 30;
    if (range === '6mo')  days = 180;
    if (range === 'ytd') {
        const now = new Date();
        const jan1 = new Date(now.getFullYear(), 0, 1);
        days = Math.ceil((now - jan1) / 86400000);
    }
    const timestamps = generateDemoTimestampsNDay(days);
    return { timestamps, closes: generateDemoPrices(base, timestamps.length, 0.012) };
}

function getDemoQuote(commodity) {
    const base = getBasePrice(commodity);
    const swing = base * (Math.random() - 0.48) * 0.015;
    const price = +(base + swing).toFixed(2);
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

function buildChartConfig(labels, data, groupKey, timeUnit) {
    const colors = CHART_COLORS[groupKey] || CHART_COLORS.precious;
    const is1Day = timeUnit === 'hour';
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
                        unit: timeUnit,
                        tooltipFormat: is1Day ? 'HH:mm' : 'MMM d, yyyy',
                        displayFormats: {
                            hour: 'HH:mm',
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy',
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

/** Update only the 1-day chart */
async function update1DayChart(groupKey, commodity) {
    const data1d = await fetchChartData(commodity.symbol, '1d', '5m')
        .then(d => d || getDemoData(commodity, '1d'));
    const labels1d = data1d.timestamps.map(t => new Date(t));
    if (chart1Day) chart1Day.destroy();
    chart1Day = new Chart(
        document.getElementById('chart-1day'),
        buildChartConfig(labels1d, data1d.closes, groupKey, 'hour'),
    );
    document.getElementById('overlay-1day')?.classList.add('hidden');
}

/** Update only the range chart (30d / 90d / 6mo / YTD) */
async function updateRangeChart(groupKey, commodity) {
    const opt = RANGE_OPTIONS.find(o => o.yahooRange === currentRange) || RANGE_OPTIONS[1];
    const dataRange = await fetchChartData(commodity.symbol, opt.yahooRange, opt.yahooInterval)
        .then(d => d || getDemoData(commodity, opt.key === 'ytd' ? 'ytd' : opt.yahooRange));
    const labels = dataRange.timestamps.map(t => new Date(t));
    if (chart90Day) chart90Day.destroy();
    chart90Day = new Chart(
        document.getElementById('chart-90day'),
        buildChartConfig(labels, dataRange.closes, groupKey, opt.timeUnit),
    );
    document.getElementById('overlay-90day')?.classList.add('hidden');
}

async function updateCharts(groupKey, commodity) {
    await Promise.all([
        update1DayChart(groupKey, commodity),
        updateRangeChart(groupKey, commodity),
    ]);
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

// ── Range Selector Logic ────────────────────────────────────
function initRangeSelector() {
    const container = document.getElementById('range-selector');
    if (!container) return;
    container.innerHTML = '';

    for (const opt of RANGE_OPTIONS) {
        const btn = document.createElement('button');
        btn.className = `range-btn${opt.yahooRange === currentRange ? ' active' : ''}`;
        btn.textContent = opt.label;
        btn.dataset.range = opt.yahooRange;
        btn.addEventListener('click', async () => {
            if (opt.yahooRange === currentRange) return;
            currentRange = opt.yahooRange;
            container.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (selectedCommodity) {
                document.getElementById('overlay-90day')?.classList.remove('hidden');
                document.querySelector('#overlay-90day p').textContent = 'Loading chart…';
                const commodity = COMMODITY_GROUPS[selectedCommodity.groupKey].items[selectedCommodity.idx];
                await updateRangeChart(selectedCommodity.groupKey, commodity);
            }
        });
        container.appendChild(btn);
    }
}

// ── Initialise ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderCards();
    loadQuotes();
    initRangeSelector();
});

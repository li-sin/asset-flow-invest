const YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const symbols = String(params.symbols || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!symbols.length) {
    return jsonResponse({ quotes: {}, history: {} });
  }

  if (String(params.mode || "").toLowerCase() === "history") {
    return jsonResponse({
      history: fetchHistoricalCloses_(symbols, params.start, params.end),
    });
  }

  return jsonResponse({
    quotes: fetchCurrentQuotes_(symbols),
  });
}

function fetchCurrentQuotes_(symbols) {
  const url = `${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(symbols.join(","))}`;
  const payload = fetchJson_(url);
  const rows = payload && payload.quoteResponse && payload.quoteResponse.result
    ? payload.quoteResponse.result
    : [];
  const quotes = {};
  rows.forEach((row) => {
    const symbol = row.symbol;
    if (!symbol) return;
    quotes[symbol] = {
      price: numberOrNull_(row.regularMarketPrice),
      prevClose: numberOrNull_(row.regularMarketPreviousClose),
      currency: row.currency || "",
      yahooSymbol: symbol,
    };
  });
  return quotes;
}

function fetchHistoricalCloses_(symbols, start, end) {
  const startDate = parseDate_(start);
  const endDate = parseDate_(end);
  if (!startDate || !endDate) return {};

  const period1 = Math.floor(startDate.getTime() / 1000);
  const period2 = Math.floor((endDate.getTime() + 86400000) / 1000);
  const history = {};

  symbols.forEach((symbol) => {
    const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
    try {
      const payload = fetchJson_(url);
      const result = payload && payload.chart && payload.chart.result && payload.chart.result[0];
      const timestamps = result && result.timestamp ? result.timestamp : [];
      const quotes = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
      const closes = quotes && quotes.close ? quotes.close : [];
      history[symbol] = {};
      timestamps.forEach((ts, index) => {
        const close = numberOrNull_(closes[index]);
        if (close === null || close <= 0) return;
        const date = Utilities.formatDate(new Date(ts * 1000), "GMT", "yyyy-MM-dd");
        history[symbol][date] = close;
      });
    } catch (err) {
      history[symbol] = history[symbol] || {};
    }
  });

  return history;
}

function fetchJson_(url) {
  const response = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: {
      "User-Agent": "Mozilla/5.0 AssetFlowInvest/1.0",
    },
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(`Yahoo request failed: ${code}`);
  }
  return JSON.parse(response.getContentText());
}

function parseDate_(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return new Date(`${text}T00:00:00Z`);
}

function numberOrNull_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

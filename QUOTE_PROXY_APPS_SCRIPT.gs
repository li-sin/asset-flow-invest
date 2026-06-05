const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";

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

// 使用 Yahoo Finance v7 batch quote API，一次請求取所有代號現價
function fetchCurrentQuotes_(symbols) {
  const BATCH_SIZE = 20;
  const quotes = {};

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const symbolList = batch.join(",");
    const url = `${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(symbolList)}&fields=regularMarketPrice,regularMarketPreviousClose,currency`;
    try {
      const payload = fetchJson_(url);
      const results = (payload && payload.quoteResponse && payload.quoteResponse.result) || [];
      results.forEach((item) => {
        const sym = item.symbol || "";
        if (!sym) return;
        quotes[sym] = {
          price: numberOrNull_(item.regularMarketPrice),
          prevClose: numberOrNull_(item.regularMarketPreviousClose),
          currency: item.currency || "",
          yahooSymbol: sym,
        };
      });
    } catch (err) {
      // batch failed — 每支 fallback 為 null
      batch.forEach((sym) => {
        if (!quotes[sym]) quotes[sym] = { price: null, prevClose: null, currency: "", yahooSymbol: sym };
      });
    }
  }

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
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      "Referer": "https://finance.yahoo.com/",
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

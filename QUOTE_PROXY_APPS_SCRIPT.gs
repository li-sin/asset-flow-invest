const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const TWSE_QUOTE_URL = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";

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

// 台股用 TWSE API，美股用 Yahoo Finance
function fetchCurrentQuotes_(symbols) {
  const quotes = {};
  const twSymbols = [];
  const usSymbols = [];

  symbols.forEach((sym) => {
    // .TW 或 .TWO 結尾，或純數字開頭 → 台股
    if (/\.(TW[O]?)$/i.test(sym) || /^\d/.test(sym)) {
      twSymbols.push(sym);
    } else {
      usSymbols.push(sym);
    }
  });

  // 台股：TWSE API（不受 Yahoo 封鎖）
  if (twSymbols.length) {
    const exCh = twSymbols.map((s) => {
      const code = s.replace(/\.(TW[O]?)$/i, "");
      return `tse_${code}.tw`;
    }).join("|");
    try {
      const url = `${TWSE_QUOTE_URL}?ex_ch=${encodeURIComponent(exCh)}&json=1&delay=0`;
      const payload = fetchJson_(url);
      const msgArray = (payload && payload.msgArray) ? payload.msgArray : [];
      msgArray.forEach((item) => {
        const code = item.c || "";
        const price = numberOrNull_(item.z !== "-" ? item.z : item.y); // z=現價, y=昨收
        const prevClose = numberOrNull_(item.y);
        if (code) {
          quotes[`${code}.TW`] = { price, prevClose, currency: "TWD", yahooSymbol: `${code}.TW` };
        }
      });
    } catch (err) {
      twSymbols.forEach((sym) => {
        if (!quotes[sym]) quotes[sym] = { price: null, prevClose: null, currency: "TWD", yahooSymbol: sym };
      });
    }
  }

  // 美股：Yahoo Finance（每支一次，數量少影響小）
  usSymbols.forEach((symbol) => {
    const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    try {
      const payload = fetchJson_(url);
      const result = payload && payload.chart && payload.chart.result && payload.chart.result[0];
      const meta = result && result.meta ? result.meta : {};
      const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
      const closes = quote && quote.close ? quote.close.filter((v) => v !== null && v !== undefined) : [];
      const latestClose = closes.length ? closes[closes.length - 1] : null;
      const previousClose = closes.length > 1 ? closes[closes.length - 2] : meta.chartPreviousClose;
      const price = numberOrNull_(meta.regularMarketPrice) || numberOrNull_(latestClose);
      quotes[symbol] = {
        price,
        prevClose: numberOrNull_(previousClose),
        currency: meta.currency || "",
        yahooSymbol: meta.symbol || symbol,
      };
    } catch (err) {
      quotes[symbol] = { price: null, prevClose: null, currency: "", yahooSymbol: symbol };
    }
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
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      "Referer": "https://finance.yahoo.com/",
    },
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error(`Request failed: ${code}`);
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

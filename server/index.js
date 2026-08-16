import express from "express";
import YahooFinance from "yahoo-finance2";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const cacheTtlMs = 5 * 60 * 1000;
const cache = new Map();
const yahooFinance = new YahooFinance();

const defaultSymbols = [
  "PGIL",
  "BLS",
  "STEELCAS",
  "APARINDS",
  "ASKAUTOLTD",
  "TTKPRESTIG",
  "ESABINDIA",
  "ACE",
  "BALUFORGE",
  "INGERRAND",
  "RELIANCE",
  "TCS",
  "INFY",
  "HDFCBANK",
  "ICICIBANK",
  "SBIN",
  "LT",
  "ITC",
  "BHARTIARTL",
  "MARUTI",
];

function asYahooSymbol(symbol) {
  const cleanSymbol = symbol.trim().toUpperCase();
  return cleanSymbol.includes(".") ? cleanSymbol : `${cleanSymbol}.NS`;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function simpleMovingAverage(values, length) {
  if (values.length < length) {
    return undefined;
  }

  return average(values.slice(-length));
}

function momentum(values, lookback) {
  if (values.length <= lookback) {
    return 0;
  }

  const previous = values.at(-lookback - 1);
  const current = values.at(-1);

  if (!previous || !current) {
    return 0;
  }

  return (current - previous) / previous;
}

function calculateRsi(values, period = 14) {
  if (values.length <= period) {
    return 50;
  }

  const recent = values.slice(-period - 1);
  let gains = 0;
  let losses = 0;

  for (let index = 1; index < recent.length; index += 1) {
    const change = recent[index] - recent[index - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  if (losses === 0) {
    return 100;
  }

  const relativeStrength = gains / period / (losses / period);
  return 100 - 100 / (1 + relativeStrength);
}

function dailyVolatility(values) {
  if (values.length < 22) {
    return 0.02;
  }

  const returns = [];
  const recent = values.slice(-45);

  for (let index = 1; index < recent.length; index += 1) {
    returns.push((recent[index] - recent[index - 1]) / recent[index - 1]);
  }

  const mean = average(returns);
  const variance = average(returns.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function computeTrendScore(closes) {
  const current = closes.at(-1);
  const sma20 = simpleMovingAverage(closes, 20);
  const sma50 = simpleMovingAverage(closes, 50);
  const sma120 = simpleMovingAverage(closes, 120);
  const oneMonthMomentum = momentum(closes, 22);
  const threeMonthMomentum = momentum(closes, 63);
  const rsi = calculateRsi(closes);
  const recentHigh = Math.max(...closes.slice(-120));

  if (!current || !sma20 || !sma50) {
    return 5;
  }

  let score = 0;
  score += current > sma20 ? 1.25 : 0.3;
  score += current > sma50 ? 1.45 : 0.35;
  score += sma20 > sma50 ? 1.2 : 0.25;
  score += sma120 && current > sma120 ? 1.2 : 0.45;
  score += clamp((oneMonthMomentum + 0.08) / 0.18, 0, 1) * 1.35;
  score += clamp((threeMonthMomentum + 0.12) / 0.28, 0, 1) * 1.35;
  score += clamp((rsi - 35) / 35, 0, 1) * 1.35;
  score += clamp(current / recentHigh, 0, 1) * 0.85;

  return round(clamp(score, 0, 10), 3);
}

function computeSuperInvestingScore(indicatorScore, closes) {
  const volatility = dailyVolatility(closes);
  const volatilityScore = clamp((0.06 - volatility) / 0.05, 0, 1) * 18;
  const trendScore = indicatorScore * 8.2;

  return round(clamp(trendScore + volatilityScore, 0, 100), 1);
}

async function buildIndicator(symbol) {
  const yahooSymbol = asYahooSymbol(symbol);
  const period1 = new Date();
  period1.setDate(period1.getDate() - 220);

  const [quote, history] = await Promise.all([
    yahooFinance.quote(yahooSymbol),
    yahooFinance.historical(yahooSymbol, {
      period1,
      interval: "1d",
    }),
  ]);

  const closes = history
    .map((row) => row.close)
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  if (closes.length < 50) {
    throw new Error(`Not enough price history for ${yahooSymbol}`);
  }

  const currentPrice = quote.regularMarketPrice ?? closes.at(-1);
  const marketCap = quote.marketCap ? quote.marketCap / 10_000_000 : 0;
  const indicatorScore = computeTrendScore(closes);
  const previousCloses = closes.slice(0, -5);
  const previousScore = previousCloses.length >= 50 ? computeTrendScore(previousCloses) : indicatorScore;

  return {
    ticker: symbol.toUpperCase(),
    exchangeSymbol: yahooSymbol,
    closePrice: round(currentPrice ?? closes.at(-1) ?? 0, 2),
    superInvestingScore: computeSuperInvestingScore(indicatorScore, closes),
    indicatorScore,
    marketCap: round(marketCap, 2),
    previousScore,
  };
}

async function getIndicators(symbols) {
  const cacheKey = symbols.join(",");
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.createdAt < cacheTtlMs) {
    return cached.payload;
  }

  const settledRows = await Promise.allSettled(symbols.map((symbol) => buildIndicator(symbol)));
  const rows = settledRows
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((a, b) => b.indicatorScore - a.indicatorScore);
  const failed = settledRows
    .map((result, index) => (result.status === "rejected" ? symbols[index] : undefined))
    .filter(Boolean);
  const payload = {
    source: "Yahoo Finance delayed market data",
    generatedAt: new Date().toISOString(),
    rows,
    failed,
  };

  cache.set(cacheKey, { createdAt: Date.now(), payload });
  return payload;
}

app.get("/api/trend-indicators", async (request, response) => {
  try {
    const requestedSymbols = String(request.query.symbols ?? "")
      .split(",")
      .map((symbol) => symbol.trim())
      .filter(Boolean);
    const symbols = requestedSymbols.length ? requestedSymbols.slice(0, 40) : defaultSymbols;

    response.json(await getIndicators(symbols));
  } catch (error) {
    response.status(500).json({
      error: "Unable to fetch trend indicators",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.listen(port, () => {
  console.log(`Trend indicator API listening on http://localhost:${port}`);
});

import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Sentiment = "Strong Bullish" | "Bullish" | "Neutral/Mixed" | "Bearish";

type StockIndicator = {
  ticker: string;
  exchangeSymbol: string;
  closePrice: number;
  superInvestingScore: number;
  indicatorScore: number;
  marketCap: number;
  previousScore: number;
};

type TrendIndicatorResponse = {
  source: string;
  generatedAt: string;
  rows: StockIndicator[];
  failed: string[];
};

type TabKey =
  | "super-investing"
  | "top-bullish"
  | "top-bearish"
  | "shift-bullish"
  | "shift-bearish";

type SortKey = "indicatorScore" | "superInvestingScore" | "marketCap" | "closePrice";

const formatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "super-investing", label: "Super Investing" },
  { key: "top-bullish", label: "Top Bullish" },
  { key: "top-bearish", label: "Top Bearish" },
  { key: "shift-bullish", label: "Shift To Bullish" },
  { key: "shift-bearish", label: "Shift To Bearish" },
];

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "indicatorScore", label: "Sort by Indicator Score" },
  { key: "superInvestingScore", label: "Sort by Super Investing" },
  { key: "marketCap", label: "Sort by Market Cap" },
  { key: "closePrice", label: "Sort by Close Price" },
];

function sentimentFor(score: number): Sentiment {
  if (score >= 8) {
    return "Strong Bullish";
  }

  if (score >= 7) {
    return "Bullish";
  }

  if (score >= 4) {
    return "Neutral/Mixed";
  }

  return "Bearish";
}

function getVisibleStocks(tab: TabKey, stocks: StockIndicator[]): StockIndicator[] {
  switch (tab) {
    case "top-bearish":
      return [...stocks].sort((a, b) => a.indicatorScore - b.indicatorScore).slice(0, 10);
    case "shift-bullish":
      return stocks.filter((stock) => stock.indicatorScore - stock.previousScore >= 0.35);
    case "shift-bearish":
      return stocks.filter((stock) => stock.previousScore - stock.indicatorScore >= 0.35);
    case "top-bullish":
      return stocks.filter((stock) => stock.indicatorScore >= 8);
    case "super-investing":
    default:
      return stocks;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("super-investing");
  const [sortKey, setSortKey] = useState<SortKey>("indicatorScore");
  const [data, setData] = useState<TrendIndicatorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchIndicators() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/trend-indicators", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Market data request failed with ${response.status}`);
        }

        setData((await response.json()) as TrendIndicatorResponse);
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : "Unable to fetch market data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchIndicators();

    return () => controller.abort();
  }, []);

  const visibleStocks = useMemo(() => {
    return [...getVisibleStocks(activeTab, data?.rows ?? [])].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [activeTab, data?.rows, sortKey]);

  return (
    <main className="dashboard">
      <header className="hero">
        <div className="title-mark" aria-hidden="true">
          <span />
        </div>
        <div>
          <h1>Trend Indicator Score</h1>
          <p>
            Scores of magic trend indicator: <strong>0-4</strong> = <em>Bearish</em>,{" "}
            <strong>4-7</strong> = <em>Neutral/Mixed</em>, <strong>7-10</strong> ={" "}
            <em>Bullish</em>
          </p>
          {data && (
            <p className="data-source">
              {data.source} • Updated {new Date(data.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      </header>

      <section className="controls" aria-label="Trend indicator filters">
        <div className="tabs" role="tablist" aria-label="Score categories">
          {tabs.map((tab) => (
            <button
              aria-selected={activeTab === tab.key}
              className="tab"
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              role="tab"
              type="button"
            >
              {tab.key === "super-investing" && <span className="spark">✣</span>}
              {tab.label}
            </button>
          ))}
        </div>

        <label className="sort-select">
          <span className="sr-only">Sort indicator list</span>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="table-card" aria-label="Trend indicator score table">
        {isLoading && <div className="state-message">Loading live market indicators...</div>}
        {error && <div className="state-message error">Could not load market data: {error}</div>}
        {!isLoading && !error && visibleStocks.length === 0 && (
          <div className="state-message">No stocks match this filter right now.</div>
        )}

        {!isLoading && !error && visibleStocks.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>
                  Ticker <span>↕</span>
                </th>
                <th>
                  Close Price <span>↕</span>
                </th>
                <th>
                  Super Investing Score <span>↕</span>
                </th>
                <th className={sortKey === "indicatorScore" ? "sorted" : undefined}>
                  Indicator Score <span>↓</span>
                </th>
                <th>
                  Market Cap (Cr) <span>↕</span>
                </th>
                <th>
                  Sentiment <span>↕</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleStocks.map((stock) => {
                const sentiment = sentimentFor(stock.indicatorScore);

                return (
                  <tr key={`${activeTab}-${stock.exchangeSymbol}`}>
                    <th scope="row">
                      {stock.ticker}
                      <small>{stock.exchangeSymbol}</small>
                    </th>
                    <td>₹{formatter.format(stock.closePrice)}</td>
                    <td>
                      {stock.superInvestingScore.toFixed(stock.superInvestingScore % 1 ? 1 : 0)}
                    </td>
                    <td className="score">{stock.indicatorScore.toFixed(3)}</td>
                    <td>{stock.marketCap ? formatter.format(stock.marketCap) : "N/A"}</td>
                    <td>
                      <span
                        className={`badge ${sentiment.toLowerCase().replace("/", "-").replace(" ", "-")}`}
                      >
                        {sentiment}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

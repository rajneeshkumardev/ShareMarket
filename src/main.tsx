import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Sentiment = "Strong Bullish" | "Bullish" | "Neutral/Mixed" | "Bearish";

type StockIndicator = {
  ticker: string;
  closePrice: number;
  superInvestingScore: number;
  indicatorScore: number;
  marketCap: number;
  previousScore: number;
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

const stocks: StockIndicator[] = [
  {
    ticker: "PGIL",
    closePrice: 2474.6,
    superInvestingScore: 72.6,
    indicatorScore: 9.03,
    marketCap: 11428.72,
    previousScore: 8.18,
  },
  {
    ticker: "BLS",
    closePrice: 278.12,
    superInvestingScore: 69.6,
    indicatorScore: 8.968,
    marketCap: 11451.34,
    previousScore: 8.22,
  },
  {
    ticker: "STEELCAS",
    closePrice: 351.85,
    superInvestingScore: 67,
    indicatorScore: 8.778,
    marketCap: 3560.72,
    previousScore: 8.41,
  },
  {
    ticker: "APARINDS",
    closePrice: 16691,
    superInvestingScore: 68.4,
    indicatorScore: 8.504,
    marketCap: 67054.76,
    previousScore: 8.03,
  },
  {
    ticker: "ASKAUTOLTD",
    closePrice: 644.7,
    superInvestingScore: 67,
    indicatorScore: 8.503,
    marketCap: 12709.78,
    previousScore: 8.11,
  },
  {
    ticker: "TTDCEM",
    closePrice: 637.55,
    superInvestingScore: 71.5,
    indicatorScore: 8.434,
    marketCap: 10334.74,
    previousScore: 7.91,
  },
  {
    ticker: "ESABINDIA",
    closePrice: 6232,
    superInvestingScore: 65.4,
    indicatorScore: 8.189,
    marketCap: 9592.93,
    previousScore: 7.76,
  },
  {
    ticker: "ACE",
    closePrice: 1085.6,
    superInvestingScore: 73.4,
    indicatorScore: 8.12,
    marketCap: 12921.67,
    previousScore: 7.82,
  },
  {
    ticker: "BALUFORGE",
    closePrice: 493.75,
    superInvestingScore: 56,
    indicatorScore: 8.055,
    marketCap: 5677.73,
    previousScore: 7.24,
  },
  {
    ticker: "INGERRAND",
    closePrice: 4608.7,
    superInvestingScore: 67.2,
    indicatorScore: 7.82,
    marketCap: 14548.74,
    previousScore: 7.31,
  },
  {
    ticker: "NESCO",
    closePrice: 998.4,
    superInvestingScore: 62.8,
    indicatorScore: 7.428,
    marketCap: 7028.64,
    previousScore: 6.82,
  },
  {
    ticker: "MAHSEAMLES",
    closePrice: 693.85,
    superInvestingScore: 54.7,
    indicatorScore: 7.118,
    marketCap: 9299.22,
    previousScore: 6.74,
  },
];

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

function getVisibleStocks(tab: TabKey): StockIndicator[] {
  switch (tab) {
    case "top-bearish":
      return [...stocks]
        .map((stock) => ({
          ...stock,
          indicatorScore: Math.max(0.8, 10 - stock.indicatorScore),
        }))
        .sort((a, b) => a.indicatorScore - b.indicatorScore);
    case "shift-bullish":
      return stocks.filter((stock) => stock.indicatorScore - stock.previousScore >= 0.5);
    case "shift-bearish":
      return stocks
        .map((stock, index) => ({
          ...stock,
          indicatorScore: Math.max(3.2, stock.indicatorScore - 0.45 - index * 0.08),
        }))
        .filter((stock) => stock.previousScore - stock.indicatorScore >= 0.25);
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

  const visibleStocks = useMemo(() => {
    return [...getVisibleStocks(activeTab)].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [activeTab, sortKey]);

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
        <table>
          <thead>
            <tr>
              <th>Ticker <span>↕</span></th>
              <th>Close Price <span>↕</span></th>
              <th>Super Investing Score <span>↕</span></th>
              <th className={sortKey === "indicatorScore" ? "sorted" : undefined}>
                Indicator Score <span>↓</span>
              </th>
              <th>Market Cap (Cr) <span>↕</span></th>
              <th>Sentiment <span>↕</span></th>
            </tr>
          </thead>
          <tbody>
            {visibleStocks.map((stock) => {
              const sentiment = sentimentFor(stock.indicatorScore);

              return (
                <tr key={`${activeTab}-${stock.ticker}`}>
                  <th scope="row">{stock.ticker}</th>
                  <td>₹{formatter.format(stock.closePrice)}</td>
                  <td>{stock.superInvestingScore.toFixed(stock.superInvestingScore % 1 ? 1 : 0)}</td>
                  <td className="score">{stock.indicatorScore.toFixed(3)}</td>
                  <td>{formatter.format(stock.marketCap)}</td>
                  <td>
                    <span className={`badge ${sentiment.toLowerCase().replace("/", "-").replace(" ", "-")}`}>
                      {sentiment}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

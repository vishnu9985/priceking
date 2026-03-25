# StockPredict AI — NSE Price Prediction & Real-time Valuation

> React 19 + Vite 6 · Node.js/Express · Yahoo Finance API (real-time) · ML Ensemble Forecast · CAPM-DCF Valuation

---

## Quick Start

### Step 1 — Backend (Express + Yahoo Finance)
```bash
cd server
npm install
npm start
# ✅ Runs at http://localhost:5000
```

### Step 2 — Frontend (React + Vite)
```bash
# from project root
npm install
npm run dev
# ✅ Runs at http://localhost:5173
```

Open **http://localhost:5173** → click any stock → view live predictions.

---

## Features

### Price Prediction (ML Ensemble)
| Model | Weight | Method |
|---|---|---|
| Linear Regression | 30–45% | OLS on last 30 days; weight increases with R² |
| Monte Carlo | 20–30% | 600 stochastic paths with annualised historical volatility |
| Mean Reversion | 20–35% | Pull to 60-day mean; weight increases when RSI is extreme |

**Outputs:**
- 30-day daily price forecast with Upper/Lower 95% confidence bands
- 7-day, 15-day, 30-day price targets
- Monte Carlo: P5, P25, P50, P75, P95 terminal prices (bear/base/bull)
- 9 technical indicators: RSI, EMA-20, SMA-20, SMA-50, Volatility, Bollinger Bands, MACD, Trend, Sentiment

### Real-time Valuation (CAPM-DCF)
```
Discount rate = Rf + β × ERP
             = 7% + β × 8%   (Indian 10Y G-Sec + Equity Risk Premium)
```
- 5-year DCF with 10% FCF growth + terminal value (3% perpetuity)
- Relative valuation: sector P/E × EPS + sector P/B × BookValue
- Blended Fair Value = DCF (55%) + Relative (45%)
- Outputs: Fair Value, Best Buy Price, Upside %, 1Y Target, 2Y Target, Margin of Safety
- Signal: STRONG BUY / BUY / HOLD / AVOID

### Live Data (10-second refresh)
- `useRealtime` hook polls `/api/quote/:symbol` every 10 seconds
- Price ticker flashes green/red on each update
- Last updated timestamp shown in top bar

---

## Project Structure
```
stockpredict/
├── index.html
├── vite.config.js          ← proxy /api → :5000
├── package.json
├── src/
│   ├── App.jsx
│   ├── index.css            ← dark terminal theme
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── StockSelector.jsx
│   │   └── PredictionDashboard.jsx   ← main analysis (5 tabs)
│   ├── hooks/
│   │   └── useRealtime.js   ← 10s live price polling
│   ├── services/
│   │   └── api.js           ← fetch wrappers
│   └── utils/
│       └── format.js        ← INR formatter, color helpers
└── server/
    ├── index.js             ← ML engine + valuation + Yahoo Finance routes
    └── package.json
```

## API Endpoints
| Endpoint | Description |
|---|---|
| `GET /api/stocks` | List of 20 NSE stocks |
| `GET /api/search?q=` | Search by symbol/name |
| `GET /api/quote/:symbol` | Lightweight live quote (used for polling) |
| `GET /api/stock/:symbol` | Full data: quote + history + ML predictions + valuation + fundamentals |

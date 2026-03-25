import express from "express"
import cors from "cors"
import YahooFinance from "yahoo-finance2"
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey","ripHistorical"] })
const app     = express()
const PORT    = process.env.PORT || 5000
import cors from 'cors'
app.use(cors({ origin: '*' }))
// CORS — open to all origins (safe for a read-only public analytics API)
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://your-vercel-app.vercel.app',  
    /\.vercel\.app$/                        
  ]
}))
app.use(express.json())

// ═══════════════════════════════════════════════════════════════
// ML ENGINE
// ═══════════════════════════════════════════════════════════════

/* Linear Regression on last N prices */
function linearRegression(vals) {
  const n = vals.length
  if (n < 2) return { slope: 0, intercept: vals[0] || 0, r2: 0 }
  let sx=0, sy=0, sxy=0, sx2=0
  for (let i = 0; i < n; i++) { sx+=i; sy+=vals[i]; sxy+=i*vals[i]; sx2+=i*i }
  const slope     = (n*sxy - sx*sy) / (n*sx2 - sx*sx)
  const intercept = (sy - slope*sx) / n
  const yMean     = sy / n
  let ssTot = 0, ssRes = 0
  for (let i = 0; i < n; i++) {
    ssTot += Math.pow(vals[i] - yMean, 2)
    ssRes += Math.pow(vals[i] - (slope*i + intercept), 2)
  }
  return { slope, intercept, r2: 1 - ssRes/ssTot }
}

/* EMA */
function ema(vals, period) {
  const k = 2 / (period + 1)
  const res = [vals[0]]
  for (let i=1; i<vals.length; i++) res.push(vals[i]*k + res[i-1]*(1-k))
  return res
}

/* SMA */
function sma(vals, period) {
  const res = []
  for (let i = period-1; i < vals.length; i++)
    res.push(vals.slice(i-period+1, i+1).reduce((a,b)=>a+b,0)/period)
  return res
}

/* RSI */
function rsi(prices, period=14) {
  const ch = prices.slice(1).map((p,i) => p - prices[i])
  if (ch.length < period) return [50]
  let ag=0, al=0
  for (let i=0; i<period; i++) { if (ch[i]>0) ag+=ch[i]; else al-=ch[i] }
  ag/=period; al/=period
  const out = [100 - 100/(1+(al?ag/al:100))]
  for (let i=period; i<ch.length; i++) {
    ag=(ag*(period-1)+(ch[i]>0?ch[i]:0))/period
    al=(al*(period-1)+(ch[i]<0?-ch[i]:0))/period
    out.push(100 - 100/(1+(al?ag/al:100)))
  }
  return out
}

/* Bollinger Bands */
function bollingerBands(vals, period=20, mult=2) {
  const s = sma(vals, period)
  return s.map((mid, i) => {
    const slice = vals.slice(i, i+period)
    const mean  = slice.reduce((a,b)=>a+b,0)/period
    const sd    = Math.sqrt(slice.reduce((a,b)=>a+Math.pow(b-mean,2),0)/period)
    return { upper: mid+mult*sd, mid, lower: mid-mult*sd, width:(4*mult*sd/mid)*100 }
  })
}

/* MACD */
function macd(prices) {
  const ema12 = ema(prices, 12)
  const ema26 = ema(prices, 26)
  const macdLine  = ema12.map((v,i) => v - ema26[i])
  const signalLine = ema(macdLine.slice(26), 9)
  const last = macdLine[macdLine.length-1]
  const sig  = signalLine[signalLine.length-1]
  return { macd: last, signal: sig, histogram: last-sig }
}

/* Historical volatility (annualised) */
function annualisedVol(prices) {
  if (prices.length < 2) return 0.2
  const r = prices.slice(1).map((p,i) => Math.log(p/prices[i]))
  const m = r.reduce((a,b)=>a+b,0)/r.length
  const v = r.reduce((s,x) => s+Math.pow(x-m,2), 0)/r.length
  return Math.sqrt(v * 252)
}

/* Normal random (Box-Muller) */
function randNorm() {
  let u=0, v=0
  while (!u) u = Math.random()
  while (!v) v = Math.random()
  return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v)
}

/* Monte Carlo – full path array + percentiles */
function monteCarlo(startPrice, vol, days, n=500) {
  const dt = 1/252
  const paths = []
  const finalPrices = []
  for (let s=0; s<n; s++) {
    let p = startPrice
    const path = [p]
    for (let d=0; d<days; d++) {
      p *= Math.exp((0 - vol*vol/2)*dt + vol*Math.sqrt(dt)*randNorm())
      path.push(p)
    }
    paths.push(path)
    finalPrices.push(p)
  }
  finalPrices.sort((a,b)=>a-b)
  return {
    paths,
    p5:  finalPrices[Math.floor(n*0.05)],
    p25: finalPrices[Math.floor(n*0.25)],
    p50: finalPrices[Math.floor(n*0.50)],
    p75: finalPrices[Math.floor(n*0.75)],
    p95: finalPrices[Math.floor(n*0.95)],
  }
}

/* Main ML pipeline */
function buildPredictions(closePrices, days=30) {
  if (!closePrices || closePrices.length < 15) return null
  const prices = closePrices.filter(p => p > 0)
  const last   = prices[prices.length-1]
  const vol    = annualisedVol(prices)

  // Indicators
  const lr30   = linearRegression(prices.slice(-30))
  const lr60   = linearRegression(prices.slice(-60))
  const ema20v = ema(prices, 20)
  const sma20v = sma(prices, 20)
  const sma50v = sma(prices, 50)
  const rsiV   = rsi(prices)
  const bbV    = bollingerBands(prices)
  const macdV  = macd(prices)

  const curRSI  = rsiV[rsiV.length-1]
  const curEMA20= ema20v[ema20v.length-1]
  const curSMA20= sma20v[sma20v.length-1]
  const curSMA50= sma50v.length ? sma50v[sma50v.length-1] : null
  const curBB   = bbV[bbV.length-1]
  const hist60Mean = prices.slice(-60).reduce((a,b)=>a+b,0)/Math.min(60,prices.length)

  // Trend
  const trend  = lr30.slope > 0 ? 'Uptrend' : lr30.slope < 0 ? 'Downtrend' : 'Sideways'
  const trendStr = Math.abs(lr30.slope / last * 100).toFixed(3) + '% / day'

  // MC simulation
  const mc = monteCarlo(last, vol, days, 600)

  // Sentiment score
  let score = 50
  if (curRSI > 70)  score -= 15; else if (curRSI < 30)  score += 15
  else if (curRSI > 55) score += 8; else if (curRSI < 45) score -= 8
  if (lr30.slope > 0) score += 10; else if (lr30.slope < 0) score -= 10
  if (lr60.slope > 0) score += 5;  else if (lr60.slope < 0) score -= 5
  if (curSMA50 && last > curSMA50) score += 8; else if (curSMA50) score -= 8
  if (macdV.histogram > 0) score += 6; else score -= 6
  score = Math.max(0, Math.min(100, Math.round(score)))

  const sentLabel = score >= 70 ? 'Strongly Bullish'
    : score >= 55 ? 'Bullish'
    : score >= 45 ? 'Neutral'
    : score >= 30 ? 'Bearish'
    : 'Strongly Bearish'

  // Dynamic model weights
  const trendStrength = Math.abs(lr30.r2)
  const lrWeight  = 0.30 + (trendStrength > 0.6 ? 0.15 : 0)
  const mrWeight  = (curRSI > 68 || curRSI < 32) ? 0.32 : 0.20
  const mcWeight  = 1 - lrWeight - mrWeight

  // Build daily predictions
  const predictions = []
  for (let d=1; d<=days; d++) {
    const t   = d / days
    const lrP = last + lr30.slope * d
    const mrP = last + (hist60Mean - last) * t
    const mcP = last + (mc.p50 - last) * t
    const pred = lrP*lrWeight + mrP*mrWeight + mcP*mcWeight
    const ci   = pred * vol * Math.sqrt(d/252) * 1.96

    const date = new Date(); date.setDate(date.getDate() + d)
    predictions.push({
      date:           date.toISOString().split('T')[0],
      predictedPrice: parseFloat(pred.toFixed(2)),
      upperBound:     parseFloat((pred + ci).toFixed(2)),
      lowerBound:     parseFloat((pred - ci).toFixed(2)),
    })
  }

  return {
    predictions,
    monteCarlo:  { p5: +mc.p5.toFixed(2), p25: +mc.p25.toFixed(2), p50: +mc.p50.toFixed(2), p75: +mc.p75.toFixed(2), p95: +mc.p95.toFixed(2) },
    technicalIndicators: {
      rsi:          +curRSI.toFixed(2),
      volatility:   +(vol*100).toFixed(2),
      trend,
      trendStrength: trendStr,
      sma20:        +curSMA20.toFixed(2),
      ema20:        +curEMA20.toFixed(2),
      sma50:        curSMA50 ? +curSMA50.toFixed(2) : null,
      bbUpper:      curBB ? +curBB.upper.toFixed(2) : null,
      bbLower:      curBB ? +curBB.lower.toFixed(2) : null,
      bbWidth:      curBB ? +curBB.width.toFixed(2) : null,
      macdSignal:   macdV.histogram > 0 ? 'Bullish' : 'Bearish',
    },
    sentiment:  { score, label: sentLabel },
    modelWeights: [
      { name:'Linear Regression', weight: Math.round(lrWeight*100), desc:'Trend slope extrapolation (last 30 days)' },
      { name:'Monte Carlo',       weight: Math.round(mcWeight*100), desc:'600-path stochastic simulation with annualised volatility' },
      { name:'Mean Reversion',    weight: Math.round(mrWeight*100), desc:'60-day historical mean reversion (weighted higher when RSI extreme)' },
    ],
  }
}

// ═══════════════════════════════════════════════════════════════
// VALUATION ENGINE  (CAPM-DCF + Relative)
// ═══════════════════════════════════════════════════════════════
const SECTOR_PE = {
  'Technology':  25, 'Financial Services':15, 'Consumer Defensive':30,
  'Healthcare':  22, 'Consumer Cyclical':  20, 'Basic Materials':18,
  'Energy':      14, 'Communication Services':22, 'Industrials':20,
  'Real Estate': 18, 'Utilities':16
}

function computeValuation(quote, sector) {
  const rf  = 0.07   // Indian 10Y G-Sec
  const erp = 0.08   // Equity risk premium (India)
  const g   = 0.03   // Terminal growth rate
  const b   = quote.beta || 1
  const r   = rf + b * erp  // CAPM discount rate

  const fcf    = quote.freeCashflow || (quote.ebitda ? quote.ebitda * 0.55 : 0)
  const shares = quote.sharesOutstanding || 1
  const debt   = quote.totalDebt || 0

  // 5-year DCF
  let sumPV = 0, f = fcf
  const dcfFlows = []
  for (let i=1; i<=5; i++) {
    f *= 1.10
    const pv = f / Math.pow(1+r, i)
    sumPV += pv
    dcfFlows.push({ year: new Date().getFullYear()+i, fcf: Math.round(f), pv: Math.round(pv) })
  }
  const tv    = f * (1+g) / (r - g)
  const tvPV  = tv / Math.pow(1+r, 5)
  const dcfPS = (sumPV + tvPV - debt) / shares

  // Relative valuation
  const benchPE  = SECTOR_PE[sector] || 20
  const relByPE  = (quote.trailingEps  || 0) * benchPE
  const relByPB  = (quote.bookValue    || 0) * 2.5
  const relValue = (relByPE * 0.6 + relByPB * 0.4)

  const fairValue    = (dcfPS * 0.55 + relValue * 0.45)
  const curPrice     = quote.regularMarketPrice || 0
  const upsidePct    = curPrice ? (fairValue - curPrice) / curPrice * 100 : 0
  const bestBuyPrice = fairValue * 0.75
  const target1Y     = fairValue * 1.15
  const target2Y     = fairValue * 1.30
  const marginOfSafety = curPrice ? (fairValue - curPrice) / fairValue * 100 : 0

  let recommendation = 'HOLD'
  if      (curPrice < bestBuyPrice * 0.9)  recommendation = 'STRONG BUY'
  else if (curPrice < bestBuyPrice)        recommendation = 'BUY'
  else if (curPrice > target1Y * 1.20)     recommendation = 'AVOID'
  else if (curPrice > target1Y)            recommendation = 'HOLD'

  return {
    dcfValue:        +dcfPS.toFixed(2),
    relativeValue:   +relValue.toFixed(2),
    fairValue:       +fairValue.toFixed(2),
    bestBuyPrice:    +bestBuyPrice.toFixed(2),
    upsidePct:       +upsidePct.toFixed(2),
    marginOfSafety:  +marginOfSafety.toFixed(2),
    target1Y:        +target1Y.toFixed(2),
    target2Y:        +target2Y.toFixed(2),
    recommendation,
    discountRate:    +(r*100).toFixed(2),
    terminalGrowth:  +(g*100).toFixed(1),
    dcfFlows,
  }
}

// ═══════════════════════════════════════════════════════════════
// FUNDAMENTALS ENGINE
// ═══════════════════════════════════════════════════════════════
function computeFundamentals(q) {
  const roe  = q.returnOnEquity  != null ? q.returnOnEquity  * 100 : null
  const roa  = q.returnOnAssets  != null ? q.returnOnAssets  * 100 : null
  // Yahoo provides D/E as a ratio already × 100 for some tickers
  const de   = q.debtToEquity    != null ? Math.abs(q.debtToEquity) / 100 : null
  const ph   = q.heldPercentInsiders != null ? q.heldPercentInsiders * 100 : null
  const nm   = q.profitMargins   != null ? q.profitMargins  * 100 : null
  const om   = q.operatingMargins!= null ? q.operatingMargins * 100 : null

  let score = 0
  if (roe  != null) score += roe>20?20 : roe>15?15 : roe>10?10 : roe>5?5 : 0
  if (roa  != null) score += roa>15?10 : roa>10?8  : roa>5?5   : 2
  if (de   != null) score += de<0.3?15 : de<0.7?12 : de<1.2?8  : de<2?4 : 0
  if (ph   != null) score += ph>60?15  : ph>40?12  : ph>20?8   : 4
  if (om   != null) score += om>30?15  : om>20?12  : om>12?8   : 4
  if (nm   != null) score += nm>20?10  : nm>12?8   : nm>5?5    : 2
  // bonus: current ratio
  const cr = q.currentRatio
  if (cr   != null) score += cr>2?5    : cr>1.5?4  : cr>1?2    : 0

  const strength = score>=70?'STRONG' : score>=50?'AVERAGE' : 'WEAK'

  const risks = []
  if (de   != null && de   > 2)   risks.push({ type:'High Leverage',       severity:'HIGH',   message:`Debt/Equity of ${de.toFixed(2)} — significantly above safe threshold` })
  if (de   != null && de   > 1 && de<=2) risks.push({ type:'Moderate Debt',severity:'MEDIUM', message:`Debt/Equity of ${de.toFixed(2)} — monitor cash flow coverage` })
  if (roe  != null && roe  < 10)  risks.push({ type:'Low ROE',             severity:'MEDIUM', message:`ROE of ${roe.toFixed(1)}% — below the 10% benchmark` })
  if ((q.trailingPE||0) > 40)     risks.push({ type:'Overvaluation Risk',  severity:'HIGH',   message:`P/E of ${(q.trailingPE||0).toFixed(1)} — significantly above market average` })
  if (ph   != null && ph   < 25)  risks.push({ type:'Low Promoter Holding',severity:'MEDIUM', message:`Insider holding at ${ph.toFixed(1)}% — below the 25% threshold` })
  if (nm   != null && nm   < 5)   risks.push({ type:'Low Profit Margin',   severity:'MEDIUM', message:`Net margin of ${nm.toFixed(1)}% — thin cushion against revenue decline` })
  if (cr   != null && cr   < 1)   risks.push({ type:'Liquidity Risk',      severity:'HIGH',   message:`Current ratio of ${cr.toFixed(2)} — current liabilities exceed current assets` })

  return { score, strength, roe, roa, roce: null, debtToEquity: de, risks }
}

// ═══════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════
const STOCKS = [
  { symbol:'RELIANCE.NS',    name:'Reliance Industries',           sector:'Conglomerate' },
  { symbol:'TCS.NS',         name:'Tata Consultancy Services',     sector:'IT Services'  },
  { symbol:'HDFCBANK.NS',    name:'HDFC Bank',                     sector:'Private Bank' },
  { symbol:'INFY.NS',        name:'Infosys',                       sector:'IT Services'  },
  { symbol:'ICICIBANK.NS',   name:'ICICI Bank',                    sector:'Private Bank' },
  { symbol:'HINDUNILVR.NS',  name:'Hindustan Unilever',            sector:'FMCG'         },
  { symbol:'ITC.NS',         name:'ITC Ltd',                       sector:'FMCG'         },
  { symbol:'SBIN.NS',        name:'State Bank of India',           sector:'Public Bank'  },
  { symbol:'BHARTIARTL.NS',  name:'Bharti Airtel',                 sector:'Telecom'      },
  { symbol:'KOTAKBANK.NS',   name:'Kotak Mahindra Bank',           sector:'Private Bank' },
  { symbol:'LT.NS',          name:'Larsen & Toubro',               sector:'Construction' },
  { symbol:'AXISBANK.NS',    name:'Axis Bank',                     sector:'Private Bank' },
  { symbol:'ASIANPAINT.NS',  name:'Asian Paints',                  sector:'Paints'       },
  { symbol:'MARUTI.NS',      name:'Maruti Suzuki',                 sector:'Automobile'   },
  { symbol:'SUNPHARMA.NS',   name:'Sun Pharmaceutical',            sector:'Pharma'       },
  { symbol:'TATAMOTORS.NS',  name:'Tata Motors',                   sector:'Automobile'   },
  { symbol:'WIPRO.NS',       name:'Wipro',                         sector:'IT Services'  },
  { symbol:'ULTRACEMCO.NS',  name:'UltraTech Cement',              sector:'Cement'       },
  { symbol:'BAJFINANCE.NS',  name:'Bajaj Finance',                 sector:'NBFC'         },
  { symbol:'NESTLEIND.NS',   name:'Nestle India',                  sector:'FMCG'         },
  { symbol:'TITAN.NS',       name:'Titan Company',                 sector:'Jewelry'      },
  { symbol:'HCLTECH.NS',     name:'HCL Technologies',              sector:'IT Services'  },
  { symbol:'BAJAJFINSV.NS',  name:'Bajaj Finserv',                 sector:'NBFC'         },
  { symbol:'ADANIENT.NS',    name:'Adani Enterprises',             sector:'Conglomerate' },
  { symbol:'ADANIPORTS.NS',  name:'Adani Ports & SEZ',             sector:'Ports'        },
  { symbol:'NTPC.NS',        name:'NTPC Ltd',                      sector:'Power'        },
  { symbol:'POWERGRID.NS',   name:'Power Grid Corporation',        sector:'Power'        },
  { symbol:'ONGC.NS',        name:'Oil & Natural Gas Corp',        sector:'Oil & Gas'    },
  { symbol:'COALINDIA.NS',   name:'Coal India',                    sector:'Mining'       },
  { symbol:'JSWSTEEL.NS',    name:'JSW Steel',                     sector:'Steel'        },
  { symbol:'TATASTEEL.NS',   name:'Tata Steel',                    sector:'Steel'        },
  { symbol:'HINDALCO.NS',    name:'Hindalco Industries',           sector:'Metals'       },
  { symbol:'GRASIM.NS',      name:'Grasim Industries',             sector:'Diversified'  },
  { symbol:'TECHM.NS',       name:'Tech Mahindra',                 sector:'IT Services'  },
  { symbol:'INDUSINDBK.NS',  name:'IndusInd Bank',                 sector:'Private Bank' },
  { symbol:'DIVISLAB.NS',    name:"Divi's Laboratories",           sector:'Pharma'       },
  { symbol:'DRREDDY.NS',     name:"Dr Reddy's Laboratories",       sector:'Pharma'       },
  { symbol:'CIPLA.NS',       name:'Cipla',                         sector:'Pharma'       },
  { symbol:'APOLLOHOSP.NS',  name:'Apollo Hospitals',              sector:'Healthcare'   },
  { symbol:'EICHERMOT.NS',   name:'Eicher Motors',                 sector:'Automobile'   },
  { symbol:'BAJAJ-AUTO.NS',  name:'Bajaj Auto',                    sector:'Automobile'   },
  { symbol:'HEROMOTOCO.NS',  name:'Hero MotoCorp',                 sector:'Automobile'   },
  { symbol:'M&M.NS',         name:'Mahindra & Mahindra',           sector:'Automobile'   },
  { symbol:'BRITANNIA.NS',   name:'Britannia Industries',          sector:'FMCG'         },
  { symbol:'BPCL.NS',        name:'Bharat Petroleum Corp',         sector:'Oil & Gas'    },
  { symbol:'SBILIFE.NS',     name:'SBI Life Insurance',            sector:'Insurance'    },
  { symbol:'HDFCLIFE.NS',    name:'HDFC Life Insurance',           sector:'Insurance'    },
  { symbol:'ICICIPRULI.NS',  name:'ICICI Prudential Life',         sector:'Insurance'    },
  { symbol:'TATACONSUM.NS',  name:'Tata Consumer Products',        sector:'FMCG'         },
  { symbol:'BANKBARODA.NS',  name:'Bank of Baroda',                sector:'Public Bank'  },
  { symbol:'PNB.NS',         name:'Punjab National Bank',          sector:'Public Bank'  },
  { symbol:'CANBK.NS',       name:'Canara Bank',                   sector:'Public Bank'  },
  { symbol:'UNIONBANK.NS',   name:'Union Bank of India',           sector:'Public Bank'  },
  { symbol:'IDFCFIRSTB.NS',  name:'IDFC First Bank',               sector:'Private Bank' },
  { symbol:'BANDHANBNK.NS',  name:'Bandhan Bank',                  sector:'Private Bank' },
  { symbol:'FEDERALBNK.NS',  name:'Federal Bank',                  sector:'Private Bank' },
  { symbol:'RBLBANK.NS',     name:'RBL Bank',                      sector:'Private Bank' },
  { symbol:'YESBANK.NS',     name:'Yes Bank',                      sector:'Private Bank' },
  { symbol:'MUTHOOTFIN.NS',  name:'Muthoot Finance',               sector:'NBFC'         },
  { symbol:'CHOLAFIN.NS',    name:'Cholamandalam Finance',         sector:'NBFC'         },
  { symbol:'LICHSGFIN.NS',   name:'LIC Housing Finance',           sector:'NBFC'         },
  { symbol:'LICI.NS',        name:'Life Insurance Corporation',    sector:'Insurance'    },
  { symbol:'ICICIGI.NS',     name:'ICICI Lombard General Ins',     sector:'Insurance'    },
  { symbol:'NIACL.NS',       name:'New India Assurance',           sector:'Insurance'    },
  { symbol:'AMBUJACEM.NS',   name:'Ambuja Cements',                sector:'Cement'       },
  { symbol:'ACC.NS',         name:'ACC Ltd',                       sector:'Cement'       },
  { symbol:'SHREECEM.NS',    name:'Shree Cement',                  sector:'Cement'       },
  { symbol:'JKCEMENT.NS',    name:'JK Cement',                     sector:'Cement'       },
  { symbol:'LUPIN.NS',       name:'Lupin Ltd',                     sector:'Pharma'       },
  { symbol:'AUROPHARMA.NS',  name:'Aurobindo Pharma',              sector:'Pharma'       },
  { symbol:'ALKEM.NS',       name:'Alkem Laboratories',            sector:'Pharma'       },
  { symbol:'TORNTPHARM.NS',  name:'Torrent Pharmaceuticals',       sector:'Pharma'       },
  { symbol:'ABBOTINDIA.NS',  name:'Abbott India',                  sector:'Pharma'       },
  { symbol:'IPCALAB.NS',     name:'IPCA Laboratories',             sector:'Pharma'       },
  { symbol:'BIOCON.NS',      name:'Biocon Ltd',                    sector:'Pharma'       },
  { symbol:'COLPAL.NS',      name:'Colgate-Palmolive India',       sector:'FMCG'         },
  { symbol:'MARICO.NS',      name:'Marico Ltd',                    sector:'FMCG'         },
  { symbol:'DABUR.NS',       name:'Dabur India',                   sector:'FMCG'         },
  { symbol:'EMAMILTD.NS',    name:'Emami Ltd',                     sector:'FMCG'         },
  { symbol:'GODREJCP.NS',    name:'Godrej Consumer Products',      sector:'FMCG'         },
  { symbol:'PGHH.NS',        name:'P&G Hygiene & Health',          sector:'FMCG'         },
  { symbol:'VARUNBEV.NS',    name:'Varun Beverages',               sector:'Beverages'    },
  { symbol:'UBL.NS',         name:'United Breweries',              sector:'Beverages'    },
  { symbol:'RADICO.NS',      name:'Radico Khaitan',                sector:'Beverages'    },
  { symbol:'DLF.NS',         name:'DLF Ltd',                       sector:'Real Estate'  },
  { symbol:'GODREJPROP.NS',  name:'Godrej Properties',             sector:'Real Estate'  },
  { symbol:'OBEROIRLTY.NS',  name:'Oberoi Realty',                 sector:'Real Estate'  },
  { symbol:'PRESTIGE.NS',    name:'Prestige Estates',              sector:'Real Estate'  },
  { symbol:'PHOENIXLTD.NS',  name:'Phoenix Mills',                 sector:'Real Estate'  },
  { symbol:'LODHA.NS',       name:'Macrotech Developers (Lodha)',  sector:'Real Estate'  },
  { symbol:'BERGEPAINT.NS',  name:'Berger Paints',                 sector:'Paints'       },
  { symbol:'KANSAINER.NS',   name:'Kansai Nerolac Paints',         sector:'Paints'       },
  { symbol:'PIDILITIND.NS',  name:'Pidilite Industries',           sector:'Chemicals'    },
  { symbol:'SRF.NS',         name:'SRF Ltd',                       sector:'Chemicals'    },
  { symbol:'AARTIIND.NS',    name:'Aarti Industries',              sector:'Chemicals'    },
  { symbol:'DEEPAKNTR.NS',   name:'Deepak Nitrite',                sector:'Chemicals'    },
  { symbol:'NAVINFLUOR.NS',  name:'Navin Fluorine',                sector:'Chemicals'    },
  { symbol:'TATACHEM.NS',    name:'Tata Chemicals',                sector:'Chemicals'    },
  { symbol:'COROMANDEL.NS',  name:'Coromandel International',      sector:'Fertilisers'  },
  { symbol:'MPHASIS.NS',     name:'Mphasis Ltd',                   sector:'IT Services'  },
  { symbol:'LTIM.NS',        name:'LTIMindtree',                   sector:'IT Services'  },
  { symbol:'LTTS.NS',        name:'L&T Technology Services',       sector:'IT Services'  },
  { symbol:'PERSISTENT.NS',  name:'Persistent Systems',            sector:'IT Services'  },
  { symbol:'COFORGE.NS',     name:'Coforge Ltd',                   sector:'IT Services'  },
  { symbol:'TATAELXSI.NS',   name:'Tata Elxsi',                    sector:'IT Services'  },
  { symbol:'OFSS.NS',        name:'Oracle Financial Services',     sector:'IT Services'  },
  { symbol:'KPITTECH.NS',    name:'KPIT Technologies',             sector:'IT Services'  },
  { symbol:'TVSMOTOR.NS',    name:'TVS Motor Company',             sector:'Automobile'   },
  { symbol:'ASHOKLEY.NS',    name:'Ashok Leyland',                 sector:'Automobile'   },
  { symbol:'BOSCHLTD.NS',    name:'Bosch Ltd',                     sector:'Auto Ancillary'},
  { symbol:'MOTHERSON.NS',   name:'Samvardhana Motherson',         sector:'Auto Ancillary'},
  { symbol:'BHARATFORG.NS',  name:'Bharat Forge',                  sector:'Auto Ancillary'},
  { symbol:'MRF.NS',         name:'MRF Ltd',                       sector:'Auto Ancillary'},
  { symbol:'APOLLOTYRE.NS',  name:'Apollo Tyres',                  sector:'Auto Ancillary'},
  { symbol:'EXIDEIND.NS',    name:'Exide Industries',              sector:'Auto Ancillary'},
  { symbol:'VEDL.NS',        name:'Vedanta Ltd',                   sector:'Metals'       },
  { symbol:'SAIL.NS',        name:'Steel Authority of India',      sector:'Steel'        },
  { symbol:'NMDC.NS',        name:'NMDC Ltd',                      sector:'Mining'       },
  { symbol:'HINDZINC.NS',    name:'Hindustan Zinc',                sector:'Metals'       },
  { symbol:'NATIONALUM.NS',  name:'National Aluminium',            sector:'Metals'       },
  { symbol:'ADANIGREEN.NS',  name:'Adani Green Energy',            sector:'Renewable Energy'},
  { symbol:'TATAPOWER.NS',   name:'Tata Power Company',            sector:'Power'        },
  { symbol:'TORNTPOWER.NS',  name:'Torrent Power',                 sector:'Power'        },
  { symbol:'NHPC.NS',        name:'NHPC Ltd',                      sector:'Power'        },
  { symbol:'IOC.NS',         name:'Indian Oil Corporation',        sector:'Oil & Gas'    },
  { symbol:'HINDPETRO.NS',   name:'Hindustan Petroleum Corp',      sector:'Oil & Gas'    },
  { symbol:'GAIL.NS',        name:'GAIL India',                    sector:'Oil & Gas'    },
  { symbol:'IGL.NS',         name:'Indraprastha Gas',              sector:'Oil & Gas'    },
  { symbol:'MGL.NS',         name:'Mahanagar Gas',                 sector:'Oil & Gas'    },
  { symbol:'PETRONET.NS',    name:'Petronet LNG',                  sector:'Oil & Gas'    },
  { symbol:'ABB.NS',         name:'ABB India',                     sector:'Capital Goods'},
  { symbol:'SIEMENS.NS',     name:'Siemens India',                 sector:'Capital Goods'},
  { symbol:'HAVELLS.NS',     name:'Havells India',                 sector:'Capital Goods'},
  { symbol:'POLYCAB.NS',     name:'Polycab India',                 sector:'Capital Goods'},
  { symbol:'VOLTAS.NS',      name:'Voltas Ltd',                    sector:'Capital Goods'},
  { symbol:'BHEL.NS',        name:'Bharat Heavy Electricals',      sector:'Capital Goods'},
  { symbol:'CROMPTON.NS',    name:'Crompton Greaves Consumer',     sector:'Consumer Durables'},
  { symbol:'HAL.NS',         name:'Hindustan Aeronautics',         sector:'Defence'      },
  { symbol:'BEL.NS',         name:'Bharat Electronics',            sector:'Defence'      },
  { symbol:'MAZDOCK.NS',     name:'Mazagon Dock Shipbuilders',     sector:'Defence'      },
  { symbol:'COCHINSHIP.NS',  name:'Cochin Shipyard',               sector:'Defence'      },
  { symbol:'FORTIS.NS',      name:'Fortis Healthcare',             sector:'Healthcare'   },
  { symbol:'MAXHEALTH.NS',   name:'Max Healthcare',                sector:'Healthcare'   },
  { symbol:'METROPOLIS.NS',  name:'Metropolis Healthcare',         sector:'Healthcare'   },
  { symbol:'LALPATHLAB.NS',  name:'Dr Lal PathLabs',               sector:'Healthcare'   },
  { symbol:'DMART.NS',       name:'Avenue Supermarts (DMart)',     sector:'Retail'       },
  { symbol:'TRENT.NS',       name:'Trent Ltd',                     sector:'Retail'       },
  { symbol:'NYKAA.NS',       name:'FSN E-Commerce (Nykaa)',        sector:'Retail'       },
  { symbol:'BATA.NS',        name:'Bata India',                    sector:'Retail'       },
  { symbol:'JUBLFT.NS',      name:'Jubilant FoodWorks',            sector:'QSR'          },
  { symbol:'ZOMATO.NS',      name:'Zomato Ltd',                    sector:'Food Tech'    },
  { symbol:'IDEA.NS',        name:'Vodafone Idea',                 sector:'Telecom'      },
  { symbol:'INDUSTOWER.NS',  name:'Indus Towers',                  sector:'Telecom'      },
  { symbol:'TATACOMM.NS',    name:'Tata Communications',           sector:'Telecom'      },
  { symbol:'ZEEL.NS',        name:'Zee Entertainment',             sector:'Media'        },
  { symbol:'SUNTV.NS',       name:'Sun TV Network',                sector:'Media'        },
  { symbol:'PVRINOX.NS',     name:'PVR INOX',                      sector:'Media'        },
  { symbol:'NAUKRI.NS',      name:'Info Edge India',               sector:'Internet'     },
  { symbol:'PAYTM.NS',       name:'One97 Communications (Paytm)', sector:'Fintech'      },
  { symbol:'POLICYBZR.NS',   name:'PB Fintech (Policybazaar)',     sector:'Fintech'      },
  { symbol:'CONCOR.NS',      name:'Container Corp of India',       sector:'Logistics'    },
  { symbol:'BLUEDART.NS',    name:'Blue Dart Express',             sector:'Logistics'    },
  { symbol:'IRCTC.NS',       name:'IRCTC',                         sector:'Travel & Tourism'},
]
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.get('/api/stocks', (_req, res) => res.json(STOCKS))

app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase()
  if (!q) return res.json(STOCKS.slice(0,10))
  res.json(STOCKS.filter(s =>
    s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
  ))
})

/* Light quote — for polling */
app.get('/api/quote/:symbol', async (req, res) => {
  try {
    const q = await yf.quote(req.params.symbol)
    res.json({
      symbol:                        q.symbol,
      regularMarketPrice:            q.regularMarketPrice,
      regularMarketPreviousClose:    q.regularMarketPreviousClose,
      regularMarketOpen:             q.regularMarketOpen,
      regularMarketDayHigh:          q.regularMarketDayHigh,
      regularMarketDayLow:           q.regularMarketDayLow,
      regularMarketVolume:           q.regularMarketVolume,
      regularMarketChangePercent:    q.regularMarketChangePercent,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

/* Full stock data */
app.get('/api/stock/:symbol', async (req, res) => {
  const symbol = req.params.symbol
  console.log(`[REQ] ${symbol}`)
  try {
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [summary, histRaw] = await Promise.all([
      yf.quoteSummary(symbol, {
        modules: [
          'price','assetProfile','summaryDetail','financialData',
          'defaultKeyStatistics'
        ]
      }),
      yf.chart(symbol, {
        period1:  sixMonthsAgo,
        period2:  new Date(),
        interval: '1d',
      })
    ])

    // Flatten nested Yahoo response
    const p  = summary.price              || {}
    const ad = summary.summaryDetail      || {}
    const fd = summary.financialData      || {}
    const ks = summary.defaultKeyStatistics || {}
    const ap = summary.assetProfile       || {}

    const quote = {
      symbol,
      shortName:                   p.shortName,
      longName:                    p.longName,
      longBusinessSummary:         ap.longBusinessSummary,
      sector:                      ap.sector,
      industry:                    ap.industry,
      exchange:                    p.exchangeName,
      currency:                    p.currency,
      regularMarketPrice:          p.regularMarketPrice,
      regularMarketPreviousClose:  p.regularMarketPreviousClose,
      regularMarketOpen:           p.regularMarketOpen,
      regularMarketDayHigh:        p.regularMarketDayHigh,
      regularMarketDayLow:         p.regularMarketDayLow,
      regularMarketVolume:         p.regularMarketVolume,
      regularMarketChangePercent:  p.regularMarketChangePercent,
      fiftyTwoWeekHigh:            ad.fiftyTwoWeekHigh,
      fiftyTwoWeekLow:             ad.fiftyTwoWeekLow,
      fiftyDayAverage:             ad.fiftyDayAverage,
      twoHundredDayAverage:        ad.twoHundredDayAverage,
      marketCap:                   p.marketCap,
      trailingPE:                  ad.trailingPE,
      forwardPE:                   ad.forwardPE,
      priceToBook:                 ks.priceToBook,
      pegRatio:                    ks.pegRatio,
      enterpriseToEbitda:          ks.enterpriseToEbitda,
      enterpriseToRevenue:         ks.enterpriseToRevenue,
      beta:                        ad.beta,
      dividendYield:               ad.dividendYield,
      trailingEps:                 ks.trailingEps,
      forwardEps:                  ks.forwardEps,
      bookValue:                   ks.bookValue,
      totalRevenue:                fd.totalRevenue,
      grossProfits:                fd.grossProfits,
      ebitda:                      fd.ebitda,
      netIncomeToCommon:           ks.netIncomeToCommon,
      operatingCashflow:           fd.operatingCashflow,
      freeCashflow:                fd.freeCashflow,
      totalDebt:                   fd.totalDebt,
      totalCash:                   fd.totalCash,
      sharesOutstanding:           ks.sharesOutstanding,
      profitMargins:               fd.profitMargins,
      operatingMargins:            fd.operatingMargins,
      grossMargins:                fd.grossMargins,
      returnOnEquity:              fd.returnOnEquity,
      returnOnAssets:              fd.returnOnAssets,
      debtToEquity:                fd.debtToEquity,
      currentRatio:                fd.currentRatio,
      quickRatio:                  fd.quickRatio,
      revenuePerShare:             fd.revenuePerShare,
      heldPercentInsiders:         ks.heldPercentInsiders,
    }

    const history = (histRaw?.quotes || histRaw || []).map(d => ({
      date:   d.date.toISOString().split('T')[0],
      close:  parseFloat((d.close || 0).toFixed(2)),
      volume: d.volume || 0,
    }))

    const closePrices = history.map(h => h.close).filter(p => p > 0)

    // Financial history via fundamentalsTimeSeries (separate call, v3 compatible)
    let incomeHistory = []
    try {
      const fiveYrAgo = new Date(); fiveYrAgo.setFullYear(fiveYrAgo.getFullYear() - 5)
      const ftsData = await yf.fundamentalsTimeSeries(symbol, {
        type:    ['annualTotalRevenue','annualNetIncome','annualGrossProfit'],
        period1: fiveYrAgo,
        period2: new Date(),
      })
      const annRev   = (ftsData?.annualTotalRevenue   || []).map(x => ({ year: new Date(x.date).getFullYear(), val: x.annualTotalRevenue   || 0 }))
      const annNet   = (ftsData?.annualNetIncome      || []).map(x => ({ year: new Date(x.date).getFullYear(), val: x.annualNetIncome      || 0 }))
      const annGross = (ftsData?.annualGrossProfit    || []).map(x => ({ year: new Date(x.date).getFullYear(), val: x.annualGrossProfit    || 0 }))
      const yearSet  = [...new Set([...annRev,...annNet].map(x=>x.year))].sort()
      incomeHistory  = yearSet.map(yr => ({
        year:        yr,
        revenue:     annRev.find(x=>x.year===yr)?.val   || 0,
        netIncome:   annNet.find(x=>x.year===yr)?.val   || 0,
        grossProfit: annGross.find(x=>x.year===yr)?.val || 0,
      }))
    } catch(e) { console.warn(`[FTS] ${symbol}: ${e.message}`) }

    // ML predictions
    const mlPredictions = buildPredictions(closePrices, 30)

    // Valuation + Fundamentals
    const valuation    = computeValuation(quote, ap.sector)
    const fundamentals = computeFundamentals(quote)

    console.log(`[OK] ${symbol} — price:${quote.regularMarketPrice} rec:${valuation.recommendation}`)
    res.json({
      quote,
      history,
      mlPredictions,
      analysis: {
        valuation,
        fundamentals,
        financialHistory: incomeHistory,
      }
    })
  } catch (err) {
    console.error(`[ERR] ${symbol}:`, err.message)
    res.status(500).json({ error: err.message })
  }
})


// ═══════════════════════════════════════════════════════════════
// SWING TRADING ENGINE
// ═══════════════════════════════════════════════════════════════

/* ATR — Average True Range */
function atr(highs, lows, closes, period = 14) {
  const trs = []
  for (let i = 1; i < closes.length; i++) {
    const hl  = highs[i]  - lows[i]
    const hcp = Math.abs(highs[i]  - closes[i - 1])
    const lcp = Math.abs(lows[i]   - closes[i - 1])
    trs.push(Math.max(hl, hcp, lcp))
  }
  if (trs.length < period) return trs[trs.length - 1] || 0
  let atrVal = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < trs.length; i++) {
    atrVal = (atrVal * (period - 1) + trs[i]) / period
  }
  return atrVal
}

/* Swing low — lowest low in last N bars */
function swingLow(lows, bars = 10) {
  return Math.min(...lows.slice(-bars))
}

/* Swing high — highest high in last N bars */
function swingHigh(highs, bars = 10) {
  return Math.max(...highs.slice(-bars))
}

/* Volume spike — current vol vs 20-day avg */
function volumeRatio(volumes) {
  if (volumes.length < 21) return 1
  const avg20 = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20
  return avg20 ? volumes[volumes.length - 1] / avg20 : 1
}

/* Analyse a single stock for swing trade setup */
function analyseSwingSetup(symbol, name, sector, hist) {
  if (!hist || hist.length < 30) return null

  const closes  = hist.map(h => h.close)
  const highs   = hist.map(h => h.high  || h.close * 1.005)
  const lows    = hist.map(h => h.low   || h.close * 0.995)
  const volumes = hist.map(h => h.volume || 0)

  const last    = closes[closes.length - 1]
  const prev    = closes[closes.length - 2]

  // Indicators
  const rsiArr  = rsi(closes)
  const curRSI  = rsiArr[rsiArr.length - 1]
  const ema9v   = ema(closes, 9)
  const ema21v  = ema(closes, 21)
  const sma50v  = sma(closes, 50)
  const macdV   = macd(closes)
  const atrVal  = atr(highs, lows, closes)
  const volR    = volumeRatio(volumes)
  const swing_low  = swingLow(lows, 10)
  const swing_high = swingHigh(highs, 20)

  const curEMA9  = ema9v[ema9v.length - 1]
  const prevEMA9 = ema9v[ema9v.length - 2]
  const curEMA21 = ema21v[ema21v.length - 1]
  const prevEMA21= ema21v[ema21v.length - 2]
  const curSMA50 = sma50v.length ? sma50v[sma50v.length - 1] : null

  // ── Scoring: build a setup score 0–100 ──────────────────────
  let score = 0
  const signals = []
  const reasons = []

  // 1. RSI in sweet spot (40–60 = momentum, <40 = oversold bounce)
  if (curRSI >= 40 && curRSI <= 60) {
    score += 20
    signals.push('RSI momentum zone')
    reasons.push(`RSI at ${curRSI.toFixed(1)} — in momentum zone (40–60), ideal for swing entry`)
  } else if (curRSI < 40 && curRSI >= 28) {
    score += 25
    signals.push('RSI oversold bounce')
    reasons.push(`RSI at ${curRSI.toFixed(1)} — oversold territory, high probability bounce play`)
  }

  // 2. EMA 9 crossing above EMA 21 (bullish crossover)
  const emaCross = prevEMA9 <= prevEMA21 && curEMA9 > curEMA21
  const emaBull  = curEMA9 > curEMA21
  if (emaCross) {
    score += 30
    signals.push('EMA 9/21 bullish crossover')
    reasons.push('EMA 9 just crossed above EMA 21 — fresh bullish crossover signal')
  } else if (emaBull) {
    score += 15
    signals.push('EMA 9 > EMA 21')
    reasons.push('EMA 9 above EMA 21 — uptrend structure intact')
  }

  // 3. Price above SMA 50 (trend filter)
  if (curSMA50 && last > curSMA50) {
    score += 15
    signals.push('Above SMA 50')
    reasons.push(`Price ₹${last.toFixed(0)} above SMA50 ₹${curSMA50.toFixed(0)} — trading in bullish trend`)
  }

  // 4. MACD bullish (histogram positive)
  if (macdV.histogram > 0) {
    score += 15
    signals.push('MACD bullish')
    reasons.push('MACD histogram positive — bullish momentum building')
  }

  // 5. Volume confirmation
  if (volR >= 1.3) {
    score += 10
    signals.push(`Volume ${volR.toFixed(1)}x avg`)
    reasons.push(`Volume ${volR.toFixed(1)}x 20-day average — institutional interest confirmed`)
  }

  // 6. Price near support (within 3% of swing low)
  const distFromSwingLow = (last - swing_low) / last * 100
  if (distFromSwingLow < 3) {
    score += 15
    signals.push('Near swing support')
    reasons.push(`Price within 3% of recent swing low ₹${swing_low.toFixed(0)} — strong support nearby`)
  }

  // Skip if score too low (not a valid setup)
  if (score < 40) return null

  // ── Price targets ────────────────────────────────────────────
  // Buy price = current price or slightly above (breakout)
  const buyPrice = parseFloat((last * 1.002).toFixed(2))   // 0.2% above current (limit order zone)

  // Stop loss = swing low OR 1.5×ATR below buy, whichever is tighter
  const atrStop   = buyPrice - (atrVal * 1.5)
  const swingStop = swing_low * 0.99
  const stopLoss  = parseFloat(Math.max(atrStop, swingStop).toFixed(2))

  // Risk per share
  const risk = buyPrice - stopLoss
  if (risk <= 0) return null

  // Target 1 = 2× risk (1:2 R/R)
  const target1 = parseFloat((buyPrice + risk * 2).toFixed(2))

  // Target 2 = recent swing high or 3× risk
  const target2 = parseFloat(Math.min(swing_high * 1.01, buyPrice + risk * 3).toFixed(2))

  // Holding period estimate based on volatility
  const vol = annualisedVol(closes)
  const holdingDays = vol < 0.20 ? '5–10 days' : vol < 0.30 ? '3–7 days' : '2–5 days'

  // Risk/reward
  const rr = ((target1 - buyPrice) / risk).toFixed(1)

  // Signal strength label
  const strength = score >= 80 ? 'Strong' : score >= 60 ? 'Moderate' : 'Weak'
  const action   = score >= 60 ? 'BUY' : 'WATCH'

  return {
    symbol: symbol.replace('.NS', ''),
    fullSymbol: symbol,
    name,
    sector,
    score,
    strength,
    action,
    signals,
    reasons,
    livePrice:   parseFloat(last.toFixed(2)),
    buyPrice,
    stopLoss,
    target1,
    target2,
    riskReward:  parseFloat(rr),
    holdingTime: holdingDays,
    rsi:         parseFloat(curRSI.toFixed(1)),
    macd:        macdV.histogram > 0 ? 'Bullish' : 'Bearish',
    trend:       curEMA9 > curEMA21 ? 'Uptrend' : 'Downtrend',
    volumeRatio: parseFloat(volR.toFixed(2)),
    atr:         parseFloat(atrVal.toFixed(2)),
    stopLossPct: parseFloat(((buyPrice - stopLoss) / buyPrice * 100).toFixed(2)),
    target1Pct:  parseFloat(((target1 - buyPrice) / buyPrice * 100).toFixed(2)),
    target2Pct:  parseFloat(((target2 - buyPrice) / buyPrice * 100).toFixed(2)),
  }
}

// Swing trading scan — checks a batch of stocks
app.get('/api/swing', async (req, res) => {
  const limit = parseInt(req.query.limit) || 30   // scan top N stocks
  const scanList = STOCKS.slice(0, limit)

  console.log(`[SWING] Scanning ${scanList.length} stocks...`)

  const results = []
  const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 3)

  // Scan in parallel batches of 5 to avoid rate limiting
  for (let i = 0; i < scanList.length; i += 5) {
    const batch = scanList.slice(i, i + 5)
    const batchResults = await Promise.allSettled(
      batch.map(async (st) => {
        try {
          const hist = await yf.chart(st.symbol, {
            period1: sixMonthsAgo,
            period2: new Date(),
            interval: '1d',
          })
          const histFormatted = (hist?.quotes || hist || []).map(d => ({
            close:  d.close  || 0,
            high:   d.high   || d.close || 0,
            low:    d.low    || d.close || 0,
            volume: d.volume || 0,
          })).filter(h => h.close > 0)

          return analyseSwingSetup(st.symbol, st.name, st.sector, histFormatted)
        } catch (e) {
          return null
        }
      })
    )
    batchResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value) results.push(r.value)
    })
    // Small delay between batches
    if (i + 5 < scanList.length) await new Promise(r => setTimeout(r, 300))
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score)

  console.log(`[SWING] Found ${results.length} setups`)
  res.json({
    scanned:   scanList.length,
    found:     results.length,
    timestamp: new Date().toISOString(),
    setups:    results,
  })
})

// Single stock swing analysis
app.get('/api/swing/:symbol', async (req, res) => {
  const symbol = req.params.symbol
  try {
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 3)
    const hist = await yf.chart(symbol, {
      period1: sixMonthsAgo,
      period2: new Date(),
      interval: '1d',
    })
    const histFormatted = (hist?.quotes || hist || []).map(d => ({
      close: d.close || 0, high: d.high || d.close || 0,
      low: d.low || d.close || 0, volume: d.volume || 0,
    })).filter(h => h.close > 0)

    const stockInfo = STOCKS.find(s => s.symbol === symbol) || { name: symbol, sector: 'Unknown' }
    const setup = analyseSwingSetup(symbol, stockInfo.name, stockInfo.sector, histFormatted)
    res.json(setup || { error: 'No swing setup found for this stock currently' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})



// ═══════════════════════════════════════════════════════════════
// LONG-TERM INVESTING ENGINE
// ═══════════════════════════════════════════════════════════════

/* Grade a single metric — returns letter grade A/B/C/D/F */
function grade(val, thresholds) {
  // thresholds: [A_min, B_min, C_min, D_min]
  if (val == null) return { grade:'N/A', score:0 }
  if (val >= thresholds[0]) return { grade:'A', score:4 }
  if (val >= thresholds[1]) return { grade:'B', score:3 }
  if (val >= thresholds[2]) return { grade:'C', score:2 }
  if (val >= thresholds[3]) return { grade:'D', score:1 }
  return { grade:'F', score:0 }
}
function gradeLow(val, thresholds) {
  // lower is better: [A_max, B_max, C_max, D_max]
  if (val == null) return { grade:'N/A', score:0 }
  if (val <= thresholds[0]) return { grade:'A', score:4 }
  if (val <= thresholds[1]) return { grade:'B', score:3 }
  if (val <= thresholds[2]) return { grade:'C', score:2 }
  if (val <= thresholds[3]) return { grade:'D', score:1 }
  return { grade:'F', score:0 }
}

/* Sector-specific valuation benchmarks */
const SECTOR_BENCH = {
  'Technology':           { pe:28, pb:6,  debtEq:0.3, roe:18 },
  'Financial Services':   { pe:18, pb:2.5,debtEq:0.8, roe:14 },
  'Consumer Defensive':   { pe:32, pb:8,  debtEq:0.4, roe:20 },
  'Healthcare':           { pe:25, pb:4,  debtEq:0.4, roe:15 },
  'Consumer Cyclical':    { pe:22, pb:4,  debtEq:0.5, roe:14 },
  'Basic Materials':      { pe:16, pb:2,  debtEq:0.6, roe:12 },
  'Energy':               { pe:14, pb:1.5,debtEq:0.7, roe:10 },
  'Communication Services':{ pe:22, pb:3, debtEq:0.6, roe:14 },
  'Industrials':          { pe:20, pb:3,  debtEq:0.5, roe:14 },
  'Real Estate':          { pe:25, pb:2,  debtEq:1.0, roe:10 },
  'Utilities':            { pe:18, pb:2,  debtEq:1.2, roe:10 },
  'default':              { pe:22, pb:3,  debtEq:0.5, roe:14 },
}

/* Build SWOT analysis from financial data */
function buildSWOT(quote, sector, valuation) {
  const bench = SECTOR_BENCH[sector] || SECTOR_BENCH['default']
  const roe   = quote.returnOnEquity   != null ? quote.returnOnEquity   * 100 : null
  const roa   = quote.returnOnAssets   != null ? quote.returnOnAssets   * 100 : null
  const de    = quote.debtToEquity     != null ? Math.abs(quote.debtToEquity) / 100 : null
  const nm    = quote.profitMargins    != null ? quote.profitMargins    * 100 : null
  const om    = quote.operatingMargins != null ? quote.operatingMargins * 100 : null
  const cr    = quote.currentRatio
  const pe    = quote.trailingPE
  const pb    = quote.priceToBook
  const ph    = quote.heldPercentInsiders != null ? quote.heldPercentInsiders * 100 : null
  const rev   = quote.totalRevenue
  const fcf   = quote.freeCashflow
  const upsidePct = valuation?.upsidePct || 0

  const S = [] // Strengths
  const W = [] // Weaknesses
  const O = [] // Opportunities
  const T = [] // Threats

  // ── Strengths ──────────────────────────────────────────────
  if (roe != null && roe > bench.roe)
    S.push(`High ROE of ${roe.toFixed(1)}% — well above ${bench.roe}% sector benchmark, indicating efficient use of shareholder equity`)
  if (de != null && de < bench.debtEq * 0.6)
    S.push(`Low debt-to-equity of ${de.toFixed(2)} — strong balance sheet with minimal financial leverage risk`)
  if (nm != null && nm > 15)
    S.push(`Strong net profit margin of ${nm.toFixed(1)}% — pricing power and operational efficiency`)
  if (om != null && om > 20)
    S.push(`High operating margin of ${om.toFixed(1)}% — competitive moat and cost discipline`)
  if (cr != null && cr > 2)
    S.push(`Current ratio of ${cr.toFixed(2)} — excellent liquidity, company can easily meet short-term obligations`)
  if (ph != null && ph > 50)
    S.push(`High promoter holding of ${ph.toFixed(1)}% — strong alignment between management and shareholders`)
  if (fcf != null && fcf > 0)
    S.push(`Positive free cash flow — business generates cash after all capital expenditure`)
  if (roa != null && roa > 12)
    S.push(`Strong return on assets of ${roa.toFixed(1)}% — management is effectively deploying company assets`)

  // ── Weaknesses ─────────────────────────────────────────────
  if (roe != null && roe < 10)
    W.push(`Low ROE of ${roe.toFixed(1)}% — below 10% threshold, suggesting capital is not being used efficiently`)
  if (de != null && de > bench.debtEq * 1.5)
    W.push(`High debt-to-equity of ${de.toFixed(2)} — elevated leverage could strain finances in economic downturns`)
  if (nm != null && nm < 5)
    W.push(`Thin net margin of ${nm.toFixed(1)}% — limited buffer against revenue pressure or cost increases`)
  if (cr != null && cr < 1)
    W.push(`Current ratio below 1 (${cr.toFixed(2)}) — short-term liquidity concern, liabilities exceed current assets`)
  if (ph != null && ph < 25)
    W.push(`Low promoter holding of ${ph.toFixed(1)}% — limited insider ownership, possible lack of management conviction`)
  if (fcf != null && fcf < 0)
    W.push(`Negative free cash flow — company is consuming more cash than it generates, watch for future fundraising`)
  if (pe != null && pe > bench.pe * 1.8)
    W.push(`P/E ratio of ${pe.toFixed(1)} is significantly above sector average ${bench.pe} — premium valuation requires sustained high growth`)

  // ── Opportunities ──────────────────────────────────────────
  if (upsidePct > 15)
    O.push(`Stock is ${upsidePct.toFixed(1)}% below estimated fair value — meaningful upside for patient long-term investors`)
  if (pe != null && pe < bench.pe * 0.8)
    O.push(`P/E of ${pe.toFixed(1)} is below sector average ${bench.pe} — potential re-rating opportunity as earnings grow`)
  if (pb != null && pb < bench.pb * 0.75)
    O.push(`Price-to-book of ${pb.toFixed(2)} is below sector average — buying company assets at a discount to intrinsic value`)
  if (quote.sector === 'Technology' || quote.sector === 'Healthcare')
    O.push(`Operating in a structurally growing sector — India's ${quote.sector} industry is expected to double over the next decade`)
  if (ph != null && ph > 65)
    O.push(`High promoter ownership (${ph.toFixed(1)}%) signals promoters' long-term confidence in business growth`)
  O.push('India\'s growing middle class and digitalisation are long-term secular tailwinds for quality NSE-listed businesses')
  if (de != null && de < 0.2)
    O.push('Low debt gives room to borrow cheaply for future expansion, acquisitions, or dividend increases')

  // ── Threats ────────────────────────────────────────────────
  if (de != null && de > 1.0)
    T.push(`Debt level of ${de.toFixed(2)}x equity makes the business sensitive to interest rate hikes and credit tightening`)
  if (pe != null && pe > bench.pe * 1.5)
    T.push(`Premium valuation (P/E ${pe.toFixed(1)}) leaves little room for earnings disappointment — any miss could cause sharp correction`)
  T.push('Global macroeconomic uncertainty, currency risk (INR/USD), and commodity price volatility are ongoing headwinds')
  if (quote.sector === 'Consumer Cyclical' || quote.sector === 'Automobile')
    T.push('Consumer discretionary spending is sensitive to inflation and interest rate cycles — demand can slow quickly')
  if (quote.sector === 'Financial Services')
    T.push('Regulatory changes by RBI/SEBI and credit quality deterioration (NPAs) are sector-specific risks')
  T.push('Increasing competition from domestic and global peers could compress margins over the medium term')

  // Cap at 4 per quadrant for readability
  return {
    strengths:     S.slice(0, 5),
    weaknesses:    W.slice(0, 4),
    opportunities: O.slice(0, 4),
    threats:       T.slice(0, 4),
  }
}

/* Score a stock for long-term investing */
function longTermScore(quote, sector, valuation) {
  const bench = SECTOR_BENCH[sector] || SECTOR_BENCH['default']
  const roe   = quote.returnOnEquity   != null ? quote.returnOnEquity   * 100 : null
  const roa   = quote.returnOnAssets   != null ? quote.returnOnAssets   * 100 : null
  const de    = quote.debtToEquity     != null ? Math.abs(quote.debtToEquity) / 100 : null
  const nm    = quote.profitMargins    != null ? quote.profitMargins    * 100 : null
  const om    = quote.operatingMargins != null ? quote.operatingMargins * 100 : null
  const cr    = quote.currentRatio
  const pe    = quote.trailingPE
  const pb    = quote.priceToBook
  const ph    = quote.heldPercentInsiders != null ? quote.heldPercentInsiders * 100 : null
  const fcf   = quote.freeCashflow

  // === FUNDAMENTAL GRADES ===
  const grades = {
    roe:          grade(roe,   [20, 15, 10, 5]),
    roa:          grade(roa,   [15, 10,  6, 3]),
    debtEq:       gradeLow(de, [0.3, 0.7, 1.2, 2.0]),
    netMargin:    grade(nm,    [20, 12,  6, 2]),
    opMargin:     grade(om,    [25, 18, 12, 6]),
    liquidity:    grade(cr,    [2.5, 1.8, 1.2, 0.8]),
    promoterHold: grade(ph,    [60, 45, 30, 15]),
    fcf:          { grade: fcf != null ? (fcf > 0 ? 'A' : 'F') : 'N/A', score: fcf != null ? (fcf > 0 ? 4 : 0) : 0 },
  }

  // === VALUATION GRADES ===
  const upsidePct = valuation?.upsidePct || 0
  const peRatio   = pe != null ? pe / bench.pe : null  // ratio vs sector benchmark
  const pbRatio   = pb != null ? pb / bench.pb : null

  const valGrades = {
    upside:    grade(upsidePct,           [25, 10, 0, -10]),
    peVsBench: peRatio != null ? gradeLow(peRatio, [0.7, 0.9, 1.1, 1.4]) : { grade:'N/A', score:0 },
    pbVsBench: pbRatio != null ? gradeLow(pbRatio, [0.6, 0.8, 1.0, 1.3]) : { grade:'N/A', score:0 },
  }

  // === TOTAL SCORE (weighted) ===
  const fundScore = (
    grades.roe.score * 3 +
    grades.roa.score * 2 +
    grades.debtEq.score * 3 +
    grades.netMargin.score * 2 +
    grades.opMargin.score * 2 +
    grades.liquidity.score * 1 +
    grades.promoterHold.score * 2 +
    grades.fcf.score * 2
  )
  const maxFund = (3+2+3+2+2+1+2+2) * 4  // 68

  const valScore = (
    valGrades.upside.score * 3 +
    valGrades.peVsBench.score * 2 +
    valGrades.pbVsBench.score * 2
  )
  const maxVal = (3+2+2) * 4  // 28

  const totalPct  = Math.round(((fundScore + valScore) / (maxFund + maxVal)) * 100)
  const fundPct   = Math.round((fundScore / maxFund) * 100)
  const valPct    = Math.round((valScore  / maxVal)  * 100)

  // Conviction label
  const conviction =
    totalPct >= 75 ? 'Strong Buy'  :
    totalPct >= 60 ? 'Buy'         :
    totalPct >= 45 ? 'Accumulate'  :
    totalPct >= 30 ? 'Watch'       : 'Avoid'

  // Entry zone
  const entryType =
    upsidePct >= 20  ? 'Undervalued — Excellent Entry' :
    upsidePct >= 5   ? 'Fair Value — Good Entry'       :
    upsidePct >= -10 ? 'Slightly Overvalued — Wait'    : 'Overvalued — Avoid'

  // Time horizon
  const horizon =
    totalPct >= 70 && fundPct >= 70 ? '3–5 years'   :
    totalPct >= 55                  ? '2–3 years'   : '1–2 years'

  return {
    totalScore: totalPct,
    fundScore:  fundPct,
    valScore:   valPct,
    conviction,
    entryType,
    horizon,
    grades,
    valGrades,
  }
}

/* Build array of long-term buy reasons */
function buildLTReasons(quote, sector, lt, valuation) {
  const bench  = SECTOR_BENCH[sector] || SECTOR_BENCH['default']
  const roe    = quote.returnOnEquity  != null ? quote.returnOnEquity  * 100 : null
  const de     = quote.debtToEquity    != null ? Math.abs(quote.debtToEquity) / 100 : null
  const nm     = quote.profitMargins   != null ? quote.profitMargins   * 100 : null
  const pe     = quote.trailingPE
  const upsidePct = valuation?.upsidePct || 0
  const reasons = []

  if (roe   != null && roe > 15)
    reasons.push({ category:'Quality', text:`ROE of ${roe.toFixed(1)}% — management consistently earns ${roe.toFixed(0)} paise on every ₹1 of equity, compounding wealth over time` })
  if (de    != null && de < 0.5)
    reasons.push({ category:'Safety',  text:`Clean balance sheet (D/E ${de.toFixed(2)}) — minimal debt means resilience during economic cycles and capacity to self-fund growth` })
  if (nm    != null && nm > 10)
    reasons.push({ category:'Quality', text:`Net margin of ${nm.toFixed(1)}% — company retains good profit on each rupee of sales, protecting long-term returns` })
  if (upsidePct > 10)
    reasons.push({ category:'Valuation', text:`${upsidePct.toFixed(1)}% upside to fair value — buying at a discount to intrinsic value provides a margin of safety and amplifies returns` })
  if (pe != null && pe < bench.pe)
    reasons.push({ category:'Valuation', text:`P/E of ${pe.toFixed(1)} vs sector average ${bench.pe} — you are paying below-average price for above-average business quality` })
  if (quote.freeCashflow != null && quote.freeCashflow > 0)
    reasons.push({ category:'Quality', text:`Positive free cash flow — company generates real cash surplus after funding operations and capital expenditure` })
  if ((quote.heldPercentInsiders||0) * 100 > 50)
    reasons.push({ category:'Management', text:`Promoter holding above 50% — owners have skin-in-the-game, aligning management decisions with long-term shareholder value` })
  if (lt.horizon === '3–5 years')
    reasons.push({ category:'Compounding', text:`At historical growth rates, a 3–5 year holding period allows multiple business cycles to compound returns significantly` })
  reasons.push({ category:'India Macro', text:`India is projected to become the world\'s 3rd largest economy by 2030 — quality NSE businesses are direct beneficiaries of this structural growth` })

  return reasons.slice(0, 6)
}

/* Long-term stock scan endpoint */
app.get('/api/longterm', async (req, res) => {
  const limit = parseInt(req.query.limit) || 40
  const scanList = STOCKS.slice(0, limit)
  console.log(`[LT] Scanning ${scanList.length} stocks for long-term value...`)

  const results = []

  for (let i = 0; i < scanList.length; i += 5) {
    const batch = scanList.slice(i, i + 5)
    const batchResults = await Promise.allSettled(
      batch.map(async (st) => {
        try {
          const summary = await yf.quoteSummary(st.symbol, {
            modules: ['price','summaryDetail','financialData','defaultKeyStatistics','assetProfile']
          })
          const p  = summary.price              || {}
          const ad = summary.summaryDetail      || {}
          const fd = summary.financialData      || {}
          const ks = summary.defaultKeyStatistics || {}
          const ap = summary.assetProfile       || {}

          const quote = {
            symbol:             st.symbol,
            shortName:          p.shortName || st.name,
            sector:             ap.sector || st.sector,
            regularMarketPrice: p.regularMarketPrice,
            trailingPE:         ad.trailingPE,
            forwardPE:          ad.forwardPE,
            priceToBook:        ks.priceToBook,
            trailingEps:        ks.trailingEps,
            bookValue:          ks.bookValue,
            beta:               ad.beta,
            dividendYield:      (ad.dividendYield||0) * 100,
            totalRevenue:       fd.totalRevenue,
            freeCashflow:       fd.freeCashflow,
            totalDebt:          fd.totalDebt,
            sharesOutstanding:  ks.sharesOutstanding,
            profitMargins:      fd.profitMargins,
            operatingMargins:   fd.operatingMargins,
            returnOnEquity:     fd.returnOnEquity,
            returnOnAssets:     fd.returnOnAssets,
            debtToEquity:       fd.debtToEquity,
            currentRatio:       fd.currentRatio,
            ebitda:             fd.ebitda,
            heldPercentInsiders:ks.heldPercentInsiders,
          }

          const valuation   = computeValuation(quote, ap.sector)
          const lt          = longTermScore(quote, ap.sector, valuation)
          const swot        = buildSWOT(quote, ap.sector, valuation)
          const reasons     = buildLTReasons(quote, ap.sector, lt, valuation)
          const fundamentals= computeFundamentals(quote)

          // Only include stocks with score >= 35
          if (lt.totalScore < 35) return null

          return {
            symbol:       st.symbol.replace('.NS',''),
            fullSymbol:   st.symbol,
            name:         quote.shortName || st.name,
            sector:       ap.sector || st.sector,
            price:        quote.regularMarketPrice,
            lt,
            valuation,
            fundamentals,
            swot,
            reasons,
            metrics: {
              pe:         quote.trailingPE,
              pb:         quote.priceToBook,
              roe:        quote.returnOnEquity ? +(quote.returnOnEquity*100).toFixed(1) : null,
              de:         quote.debtToEquity   ? +(Math.abs(quote.debtToEquity)/100).toFixed(2) : null,
              nm:         quote.profitMargins  ? +(quote.profitMargins*100).toFixed(1) : null,
              divYield:   quote.dividendYield  ? +quote.dividendYield.toFixed(2)   : null,
              beta:       quote.beta           ? +quote.beta.toFixed(2)             : null,
            }
          }
        } catch (e) {
          return null
        }
      })
    )
    batchResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value) results.push(r.value)
    })
    if (i + 5 < scanList.length) await new Promise(r => setTimeout(r, 400))
  }

  results.sort((a, b) => b.lt.totalScore - a.lt.totalScore)
  console.log(`[LT] Found ${results.length} long-term candidates`)
  res.json({ scanned: scanList.length, found: results.length, timestamp: new Date().toISOString(), stocks: results })
})

/* Single stock long-term analysis */
app.get('/api/longterm/:symbol', async (req, res) => {
  const symbol = req.params.symbol
  try {
    const summary = await yf.quoteSummary(symbol, {
      modules: ['price','summaryDetail','financialData','defaultKeyStatistics','assetProfile']
    })
    const p  = summary.price              || {}
    const ad = summary.summaryDetail      || {}
    const fd = summary.financialData      || {}
    const ks = summary.defaultKeyStatistics || {}
    const ap = summary.assetProfile       || {}

    const quote = {
      symbol, shortName: p.shortName,
      sector: ap.sector,
      regularMarketPrice: p.regularMarketPrice,
      trailingPE: ad.trailingPE, forwardPE: ad.forwardPE,
      priceToBook: ks.priceToBook, trailingEps: ks.trailingEps,
      bookValue: ks.bookValue, beta: ad.beta,
      dividendYield: (ad.dividendYield||0)*100,
      totalRevenue: fd.totalRevenue, freeCashflow: fd.freeCashflow,
      totalDebt: fd.totalDebt, sharesOutstanding: ks.sharesOutstanding,
      profitMargins: fd.profitMargins, operatingMargins: fd.operatingMargins,
      returnOnEquity: fd.returnOnEquity, returnOnAssets: fd.returnOnAssets,
      debtToEquity: fd.debtToEquity, currentRatio: fd.currentRatio,
      ebitda: fd.ebitda, heldPercentInsiders: ks.heldPercentInsiders,
    }
    const valuation = computeValuation(quote, ap.sector)
    const lt        = longTermScore(quote, ap.sector, valuation)
    const swot      = buildSWOT(quote, ap.sector, valuation)
    const reasons   = buildLTReasons(quote, ap.sector, lt, valuation)

    res.json({ quote, valuation, lt, swot, reasons })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})



// ═══════════════════════════════════════════════════════════════
// MULTIBAGGER ENGINE  — 2x–10x potential stock finder
// ═══════════════════════════════════════════════════════════════

/* Score rationale categories */
const MB_CATEGORIES = {
  GROWTH:      'Growth Engine',
  QUALITY:     'Business Quality',
  MANAGEMENT:  'Management Excellence',
  MOAT:        'Competitive Moat',
  FINANCIALS:  'Financial Strength',
  VALUATION:   'Valuation Edge',
  TAILWIND:    'Sector Tailwind',
  RUNWAY:      'Growth Runway',
}

/* Sector growth tailwinds — India specific */
const SECTOR_TAILWINDS = {
  'Technology':             { score:9, reason:'India IT export market growing at 12–15% CAGR; AI adoption creating new revenue streams' },
  'Healthcare':             { score:9, reason:'India healthcare spending to reach $650B by 2030; underpenetrated insurance market expanding fast' },
  'Financial Services':     { score:8, reason:'India\'s credit-to-GDP at 56% vs 150%+ in developed markets — massive credit penetration ahead' },
  'Consumer Cyclical':      { score:8, reason:'India\'s median age is 28; rising disposable incomes driving premiumisation across consumer categories' },
  'Consumer Defensive':     { score:7, reason:'FMCG penetration in rural India still low; distribution expansion fuelling volume growth' },
  'Communication Services': { score:8, reason:'Data consumption growing 40%+ YoY; 5G rollout creating massive ARPU upgrade cycle' },
  'Industrials':            { score:9, reason:'PLI schemes + China+1 strategy driving manufacturing FDI; capital expenditure cycle upswing' },
  'Basic Materials':        { score:6, reason:'Commodity cycle in metals; India infrastructure buildout supporting sustained demand' },
  'Energy':                 { score:7, reason:'India targeting 500GW renewable capacity by 2030; green energy capex supercycle underway' },
  'Real Estate':            { score:8, reason:'Post-RERA consolidation; tier-2 city housing demand structural growth story' },
  'Utilities':              { score:6, reason:'Power demand growing 6–8% annually; grid modernisation investments accelerating' },
  'default':                { score:6, reason:'India\'s GDP projected to reach $7T by 2030 — broad-based economic growth benefits diversified businesses' },
}

/* Revenue growth CAGR proxy from income history */
function revenueCAGR(financialHistory) {
  if (!financialHistory || financialHistory.length < 2) return null
  const sorted = [...financialHistory].sort((a,b)=>a.year-b.year)
  const first  = sorted[0].revenue
  const last   = sorted[sorted.length-1].revenue
  const years  = sorted[sorted.length-1].year - sorted[0].year
  if (!first || first <= 0 || years <= 0) return null
  return ((Math.pow(last / first, 1/years) - 1) * 100)
}

function profitCAGR(financialHistory) {
  if (!financialHistory || financialHistory.length < 2) return null
  const sorted = [...financialHistory].sort((a,b)=>a.year-b.year)
  const first  = sorted[0].netIncome
  const last   = sorted[sorted.length-1].netIncome
  const years  = sorted[sorted.length-1].year - sorted[0].year
  if (!first || first <= 0 || years <= 0) return null
  return ((Math.pow(last / first, 1/years) - 1) * 100)
}

/* Build comprehensive multibagger analysis */
function analyseMB(symbol, name, sector, quote, financialHistory, valuation) {
  const bench   = SECTOR_BENCH[sector] || SECTOR_BENCH['default']
  const tailwind= SECTOR_TAILWINDS[sector] || SECTOR_TAILWINDS['default']

  const roe  = quote.returnOnEquity  != null ? quote.returnOnEquity  * 100 : null
  const roa  = quote.returnOnAssets  != null ? quote.returnOnAssets  * 100 : null
  const de   = quote.debtToEquity    != null ? Math.abs(quote.debtToEquity)/100 : null
  const nm   = quote.profitMargins   != null ? quote.profitMargins   * 100 : null
  const om   = quote.operatingMargins!= null ? quote.operatingMargins* 100 : null
  const cr   = quote.currentRatio
  const pe   = quote.trailingPE
  const fpe  = quote.forwardPE
  const pb   = quote.priceToBook
  const ph   = quote.heldPercentInsiders != null ? quote.heldPercentInsiders * 100 : null
  const fcf  = quote.freeCashflow
  const beta = quote.beta || 1
  const revCAGR  = revenueCAGR(financialHistory)
  const profCAGR = profitCAGR(financialHistory)
  const upsidePct= valuation?.upsidePct || 0
  const divYield = (quote.dividendYield || 0) * 100

  // ── SCORING ENGINE ─────────────────────────────────────────
  const factors = []
  let totalScore = 0

  // 1. REVENUE GROWTH ENGINE
  if (revCAGR != null) {
    if (revCAGR >= 20) {
      factors.push({ category:MB_CATEGORIES.GROWTH, score:18, weight:'Critical',
        title:'Exceptional Revenue Growth',
        reason:`Revenue compounding at ${revCAGR.toFixed(1)}% CAGR — businesses growing this fast typically see their stock price multiply 3–5x as earnings scale faster than revenue` })
      totalScore += 18
    } else if (revCAGR >= 12) {
      factors.push({ category:MB_CATEGORIES.GROWTH, score:13, weight:'High',
        title:'Strong Revenue Growth',
        reason:`Revenue growing at ${revCAGR.toFixed(1)}% CAGR — double-digit growth sustained over multiple years is a hallmark of quality multibaggers` })
      totalScore += 13
    } else if (revCAGR >= 7) {
      factors.push({ category:MB_CATEGORIES.GROWTH, score:8, weight:'Moderate',
        title:'Steady Revenue Expansion',
        reason:`Revenue CAGR of ${revCAGR.toFixed(1)}% — stable growth showing business durability, though acceleration needed for multibagger returns` })
      totalScore += 8
    }
  }

  // 2. PROFIT GROWTH ACCELERATION
  if (profCAGR != null && revCAGR != null && profCAGR > revCAGR) {
    factors.push({ category:MB_CATEGORIES.QUALITY, score:15, weight:'Critical',
      title:'Operating Leverage Kicking In',
      reason:`Profit growing at ${profCAGR.toFixed(1)}% vs revenue at ${revCAGR.toFixed(1)}% — expanding margins signal operating leverage, a classic multibagger pattern where earnings outpace revenue growth` })
    totalScore += 15
  } else if (profCAGR != null && profCAGR >= 20) {
    factors.push({ category:MB_CATEGORIES.GROWTH, score:15, weight:'Critical',
      title:'Explosive Profit Growth',
      reason:`Net profit compounding at ${profCAGR.toFixed(1)}% CAGR — at this rate profits double every ${(70/profCAGR).toFixed(1)} years, directly driving stock price multiplication` })
    totalScore += 15
  }

  // 3. RETURN ON EQUITY — capital efficiency
  if (roe != null) {
    if (roe >= 25) {
      factors.push({ category:MB_CATEGORIES.QUALITY, score:16, weight:'Critical',
        title:'Exceptional Capital Efficiency',
        reason:`ROE of ${roe.toFixed(1)}% means company earns ₹${roe.toFixed(0)} on every ₹100 of equity. Buffett's rule: businesses sustaining 25%+ ROE over a decade create extraordinary wealth. This is a defining quality of 10x stocks` })
      totalScore += 16
    } else if (roe >= 18) {
      factors.push({ category:MB_CATEGORIES.QUALITY, score:12, weight:'High',
        title:'High Return on Equity',
        reason:`ROE of ${roe.toFixed(1)}% — significantly above the 15% threshold that separates exceptional businesses from average ones. Sustained high ROE + reinvestment = compounding machine` })
      totalScore += 12
    } else if (roe >= 12) {
      factors.push({ category:MB_CATEGORIES.QUALITY, score:7, weight:'Moderate',
        title:'Decent Capital Returns',
        reason:`ROE of ${roe.toFixed(1)}% is reasonable but improvement toward 20%+ would significantly enhance multibagger potential` })
      totalScore += 7
    }
  }

  // 4. MANAGEMENT QUALITY — promoter holding + FCF generation
  if (ph != null && ph >= 55) {
    factors.push({ category:MB_CATEGORIES.MANAGEMENT, score:14, weight:'High',
      title:'Founder-Led / High Promoter Ownership',
      reason:`Promoters hold ${ph.toFixed(1)}% — when founders own large stakes, their wealth is tied to the stock. This alignment means every major decision is made in shareholders\' interest. Promoter-run businesses historically generate 2–3x more wealth than MNC-run peers` })
    totalScore += 14
  } else if (ph != null && ph >= 40) {
    factors.push({ category:MB_CATEGORIES.MANAGEMENT, score:9, weight:'Moderate',
      title:'Strong Management Ownership',
      reason:`Promoter holding of ${ph.toFixed(1)}% shows meaningful skin-in-the-game. Management decisions tend to be long-term oriented when insiders own significant equity` })
    totalScore += 9
  }

  // 5. FCF GENERATION — king of all quality signals
  if (fcf != null && fcf > 0) {
    const fcfYield = quote.marketCap ? (fcf / quote.marketCap) * 100 : null
    if (fcfYield != null && fcfYield >= 3) {
      factors.push({ category:MB_CATEGORIES.FINANCIALS, score:14, weight:'High',
        title:'High Free Cash Flow Yield',
        reason:`FCF yield of ${fcfYield.toFixed(1)}% — company generates real cash surplus that can fund expansion, acquisitions, buybacks, or dividends WITHOUT needing external capital. Self-funded growth is the safest path to multibagger returns` })
      totalScore += 14
    } else {
      factors.push({ category:MB_CATEGORIES.FINANCIALS, score:8, weight:'Moderate',
        title:'Positive Free Cash Flow',
        reason:'Business generates cash after all operating expenses and capital expenditure — a prerequisite for sustainable growth without diluting shareholders' })
      totalScore += 8
    }
  }

  // 6. DEBT-FREE / LOW DEBT — safety + flexibility
  if (de != null) {
    if (de < 0.2) {
      factors.push({ category:MB_CATEGORIES.FINANCIALS, score:12, weight:'High',
        title:'Virtually Debt-Free Balance Sheet',
        reason:`D/E ratio of ${de.toFixed(2)} — a clean balance sheet means zero interest burden, full flexibility to invest in growth opportunities, and no risk of financial distress during downturns. Debt-free companies are the foundation of 10x wealth creators` })
      totalScore += 12
    } else if (de < 0.5) {
      factors.push({ category:MB_CATEGORIES.FINANCIALS, score:8, weight:'Moderate',
        title:'Conservative Leverage',
        reason:`D/E of ${de.toFixed(2)} — manageable debt with strong capacity to borrow for strategic growth without stress on cash flows` })
      totalScore += 8
    }
  }

  // 7. OPERATING MARGIN EXPANSION — moat signal
  if (om != null) {
    if (om >= 25) {
      factors.push({ category:MB_CATEGORIES.MOAT, score:14, weight:'Critical',
        title:'Wide Competitive Moat (High Margins)',
        reason:`Operating margin of ${om.toFixed(1)}% signals strong pricing power and competitive moat. Companies with 25%+ operating margins can increase prices without losing customers — the hallmark of a durable franchise. Moats protect multibagger returns from competitive erosion` })
      totalScore += 14
    } else if (om >= 18) {
      factors.push({ category:MB_CATEGORIES.MOAT, score:9, weight:'High',
        title:'Above-Average Pricing Power',
        reason:`Operating margin of ${om.toFixed(1)}% is above industry average. Pricing power means the business can pass on cost inflation, protecting profitability` })
      totalScore += 9
    }
  }

  // 8. VALUATION DISCOUNT — margin of safety
  if (upsidePct >= 30) {
    factors.push({ category:MB_CATEGORIES.VALUATION, score:16, weight:'Critical',
      title:'Deeply Undervalued — Maximum Margin of Safety',
      reason:`Trading ${upsidePct.toFixed(1)}% below fair value. When you buy a quality business at a 30%+ discount, you combine the safety of buying cheap with the upside of business growth. This is the multibagger formula: quality + discount = asymmetric returns` })
    totalScore += 16
  } else if (upsidePct >= 15) {
    factors.push({ category:MB_CATEGORIES.VALUATION, score:10, weight:'High',
      title:'Attractive Valuation Discount',
      reason:`${upsidePct.toFixed(1)}% upside to fair value — buying below intrinsic value provides a margin of safety and amplifies long-term compounding returns` })
    totalScore += 10
  } else if (pe != null && pe < bench.pe * 0.75) {
    factors.push({ category:MB_CATEGORIES.VALUATION, score:8, weight:'Moderate',
      title:'Sector Discount',
      reason:`P/E of ${pe.toFixed(1)} is ${(100 - pe/bench.pe*100).toFixed(0)}% below sector average of ${bench.pe} — quality below sector valuation offers re-rating potential` })
    totalScore += 8
  }

  // 9. SECTOR TAILWIND — macro growth driver
  factors.push({ category:MB_CATEGORIES.TAILWIND, score:tailwind.score, weight:tailwind.score>=8?'High':'Moderate',
    title:`${sector || 'India'} Structural Growth Tailwind`,
    reason:tailwind.reason })
  totalScore += tailwind.score

  // 10. FORWARD PE < TRAILING (earnings acceleration)
  if (fpe != null && pe != null && fpe < pe * 0.85) {
    factors.push({ category:MB_CATEGORIES.GROWTH, score:10, weight:'High',
      title:'Earnings Acceleration Ahead',
      reason:`Forward P/E of ${fpe.toFixed(1)} vs trailing P/E of ${pe.toFixed(1)} — analysts expect meaningful earnings growth ahead. When earnings grow faster than expected, P/E re-rating creates additional price appreciation beyond fundamental growth` })
    totalScore += 10
  }

  // 11. LOW BETA — sleep-well multibagger
  if (beta < 0.8 && roe != null && roe >= 15) {
    factors.push({ category:MB_CATEGORIES.QUALITY, score:6, weight:'Moderate',
      title:'Low-Volatility Quality Compounder',
      reason:`Beta of ${beta.toFixed(2)} with strong ROE — low-volatility quality stocks tend to compound wealth more reliably than high-beta stocks because they don\'t force holders to sell at bottoms. Patience is rewarded` })
    totalScore += 6
  }

  // 12. DIVIDEND — capital discipline signal
  if (divYield >= 1 && fcf != null && fcf > 0) {
    factors.push({ category:MB_CATEGORIES.MANAGEMENT, score:5, weight:'Supporting',
      title:'Dividend + Positive FCF = Capital Discipline',
      reason:`Dividend yield of ${divYield.toFixed(1)}% backed by positive free cash flow signals management returns surplus cash to shareholders rather than empire-building with wasteful acquisitions` })
    totalScore += 5
  }

  // 13. GROWTH RUNWAY — PEG proxy
  if (pe != null && revCAGR != null && pe/revCAGR < 1.5) {
    factors.push({ category:MB_CATEGORIES.RUNWAY, score:12, weight:'High',
      title:'PEG Ratio Attractive — Growth at Reasonable Price',
      reason:`P/E-to-growth ratio of ${(pe/revCAGR).toFixed(2)} — paying for growth at a reasonable price. Peter Lynch\'s rule: PEG < 1 is where multibaggers are born. The runway ahead justifies the current price` })
    totalScore += 12
  }

  // ── MULTIBAGGER POTENTIAL LABEL ────────────────────────────
  const potential =
    totalScore >= 110 ? '10x Potential'  :
    totalScore >= 85  ? '5x Potential'   :
    totalScore >= 65  ? '3x Potential'   :
    totalScore >= 45  ? '2x Potential'   : 'Watchlist'

  const conviction =
    totalScore >= 100 ? 'Exceptional'  :
    totalScore >= 80  ? 'Strong'        :
    totalScore >= 60  ? 'Good'          :
    totalScore >= 40  ? 'Moderate'      : 'Weak'

  const timeframe =
    totalScore >= 100 ? '3–7 years'  :
    totalScore >= 75  ? '3–5 years'  :
    totalScore >= 55  ? '2–4 years'  : '2–3 years'

  // Top catalysts
  const catalysts = factors
    .sort((a,b) => b.score - a.score)
    .slice(0, 5)

  // Risk factors
  const risks = []
  if (de != null && de > 1.5)    risks.push({ text:`High debt (D/E ${de.toFixed(2)}) could slow growth if rates rise`, severity:'HIGH' })
  if (pe != null && pe > bench.pe*2) risks.push({ text:`Premium valuation (P/E ${pe.toFixed(1)}) requires sustained earnings beats`, severity:'HIGH' })
  if (revCAGR != null && revCAGR < 5)  risks.push({ text:'Slow revenue growth limits upside magnitude', severity:'MEDIUM' })
  if (ph != null && ph < 30)     risks.push({ text:`Low promoter stake (${ph.toFixed(0)}%) — weaker management alignment`, severity:'MEDIUM' })
  if (fcf != null && fcf < 0)    risks.push({ text:'Negative free cash flow — dependent on external funding for growth', severity:'HIGH' })
  if (beta > 1.5)                risks.push({ text:`High beta (${beta.toFixed(2)}) — volatile ride, requires strong conviction`, severity:'MEDIUM' })

  return {
    symbol: symbol.replace('.NS',''),
    fullSymbol: symbol,
    name,
    sector,
    price:    quote.regularMarketPrice,
    totalScore,
    potential,
    conviction,
    timeframe,
    factors,
    catalysts,
    risks,
    upside:   upsidePct,
    metrics: {
      roe, de, nm, om, pe, fpe, pb, revCAGR, profCAGR,
      fcf: fcf != null ? (fcf > 0 ? 'Positive' : 'Negative') : null,
      beta, ph, divYield,
    },
    valuation,
    targets: {
      fair:   valuation?.fairValue,
      target2x: quote.regularMarketPrice ? +(quote.regularMarketPrice * 2).toFixed(2) : null,
      target3x: quote.regularMarketPrice ? +(quote.regularMarketPrice * 3).toFixed(2) : null,
      target5x: quote.regularMarketPrice ? +(quote.regularMarketPrice * 5).toFixed(2) : null,
    }
  }
}

/* Multibagger scan endpoint */
app.get('/api/multibagger', async (req, res) => {
  const limit    = parseInt(req.query.limit) || 40
  const minScore = parseInt(req.query.min)   || 40
  const scanList = STOCKS.slice(0, limit)
  console.log(`[MB] Scanning ${scanList.length} stocks for multibaggers...`)

  const results   = []
  const sixMonAgo = new Date(); sixMonAgo.setMonth(sixMonAgo.getMonth() - 6)

  for (let i = 0; i < scanList.length; i += 5) {
    const batch = scanList.slice(i, i + 5)
    const batchR = await Promise.allSettled(
      batch.map(async (st) => {
        try {
          const [summary, histRaw] = await Promise.all([
            yf.quoteSummary(st.symbol, {
              modules:['price','summaryDetail','financialData','defaultKeyStatistics','assetProfile']
            }),
            yf.chart(st.symbol, { period1:sixMonAgo, period2:new Date(), interval: "1d" })
          ])

          const p  = summary.price              || {}
          const ad = summary.summaryDetail      || {}
          const fd = summary.financialData      || {}
          const ks = summary.defaultKeyStatistics || {}
          const ap = summary.assetProfile       || {}

          const quote = {
            symbol:              st.symbol,
            shortName:           p.shortName || st.name,
            regularMarketPrice:  p.regularMarketPrice,
            trailingPE:          ad.trailingPE,
            forwardPE:           ad.forwardPE,
            priceToBook:         ks.priceToBook,
            trailingEps:         ks.trailingEps,
            bookValue:           ks.bookValue,
            beta:                ad.beta,
            dividendYield:       ad.dividendYield,
            totalRevenue:        fd.totalRevenue,
            freeCashflow:        fd.freeCashflow,
            totalDebt:           fd.totalDebt,
            sharesOutstanding:   ks.sharesOutstanding,
            profitMargins:       fd.profitMargins,
            operatingMargins:    fd.operatingMargins,
            returnOnEquity:      fd.returnOnEquity,
            returnOnAssets:      fd.returnOnAssets,
            debtToEquity:        fd.debtToEquity,
            currentRatio:        fd.currentRatio,
            ebitda:              fd.ebitda,
            marketCap:           p.marketCap,
            heldPercentInsiders: ks.heldPercentInsiders,
          }

          // Use financialData growth rates as proxy (fts too slow for bulk scan)
          const incHist = []

          const valuation = computeValuation(quote, ap.sector)
          const mbResult  = analyseMB(st.symbol, st.name, ap.sector || st.sector, quote, incHist, valuation)

          return mbResult.totalScore >= minScore ? mbResult : null
        } catch (e) { return null }
      })
    )
    batchR.forEach(r => { if (r.status==='fulfilled' && r.value) results.push(r.value) })
    if (i + 5 < scanList.length) await new Promise(r => setTimeout(r, 400))
  }

  results.sort((a,b) => b.totalScore - a.totalScore)
  console.log(`[MB] Found ${results.length} multibagger candidates`)
  res.json({ scanned:scanList.length, found:results.length, timestamp:new Date().toISOString(), stocks:results })
})



// ═══════════════════════════════════════════════════════════════
// MULTIBAGGER ENGINE
// ═══════════════════════════════════════════════════════════════

/* Estimate revenue growth rate from income history */
function growthRate(history) {
  if (!history || history.length < 2) return null
  const sorted = [...history].sort((a,b) => a.year - b.year)
  const first  = sorted[0].revenue, last = sorted[sorted.length-1].revenue
  if (!first || !last || first <= 0) return null
  const years  = sorted[sorted.length-1].year - sorted[0].year
  if (years <= 0) return null
  return (Math.pow(last/first, 1/years) - 1) * 100   // CAGR %
}

/* Estimate earnings growth CAGR */
function earningsGrowthRate(history) {
  if (!history || history.length < 2) return null
  const sorted = [...history].sort((a,b) => a.year - b.year)
  const first  = sorted[0].netIncome, last = sorted[sorted.length-1].netIncome
  if (!first || !last || first <= 0) return null
  const years  = sorted[sorted.length-1].year - sorted[0].year
  if (years <= 0) return null
  return (Math.pow(last/first, 1/years) - 1) * 100
}

/* Market opportunity score based on sector */
const SECTOR_GROWTH_MULT = {
  'Technology':16, 'Healthcare':14, 'Consumer Cyclical':13, 'Consumer Defensive':11,
  'Financial Services':13, 'Communication Services':12, 'Industrials':11,
  'Basic Materials':9, 'Energy':8, 'Real Estate':10, 'Utilities':7,
  'default':10
}

/* Classify multibagger potential (conservative: 2–3x, moderate: 3–5x, aggressive: 5–10x) */
function multibaggerClass(totalScore, revenueCAGR, earningsCAGR) {
  const rc = revenueCAGR  || 0
  const ec = earningsCAGR || 0
  const avgG = (rc + ec) / 2
  if (totalScore >= 78 && avgG >= 18) return { label:'10x Potential', color:'#f04f5a', years:'5–7 yrs', multiplier:'8–12x' }
  if (totalScore >= 68 && avgG >= 14) return { label:'5x Potential',  color:'#f5a623', years:'4–6 yrs', multiplier:'4–7x'  }
  if (totalScore >= 55 && avgG >= 10) return { label:'3x Potential',  color:'#9b6dff', years:'3–5 yrs', multiplier:'2.5–4x' }
  if (totalScore >= 42 && avgG >=  7) return { label:'2x Potential',  color:'#3d8ef0', years:'3–4 yrs', multiplier:'1.5–2.5x' }
  return null
}

/* Score multibagger on 10 pillars (0-10 each = 100 max) */
function scoreMB(quote, sector, incomeHistory, valuation) {
  const roe     = quote.returnOnEquity  != null ? quote.returnOnEquity  * 100 : null
  const roa     = quote.returnOnAssets  != null ? quote.returnOnAssets  * 100 : null
  const de      = quote.debtToEquity    != null ? Math.abs(quote.debtToEquity) / 100 : null
  const nm      = quote.profitMargins   != null ? quote.profitMargins   * 100 : null
  const om      = quote.operatingMargins!= null ? quote.operatingMargins * 100 : null
  const cr      = quote.currentRatio
  const pe      = quote.trailingPE
  const pb      = quote.priceToBook
  const ph      = quote.heldPercentInsiders != null ? quote.heldPercentInsiders * 100 : null
  const fcf     = quote.freeCashflow
  const mktCap  = quote.marketCap
  const revCAGR = growthRate(incomeHistory)
  const eCAGR   = earningsGrowthRate(incomeHistory)
  const upside  = valuation?.upsidePct || 0
  const secMult = SECTOR_GROWTH_MULT[sector] || SECTOR_GROWTH_MULT['default']

  const pillars = []

  // ── 1. EARNINGS GROWTH QUALITY ───────────────────────────────
  const eScore = eCAGR != null
    ? eCAGR >= 25 ? 10 : eCAGR >= 18 ? 8 : eCAGR >= 12 ? 6 : eCAGR >= 7 ? 4 : 2
    : 3
  pillars.push({
    name:'Earnings Growth',
    score: eScore,
    grade: eScore>=8?'A':eScore>=6?'B':eScore>=4?'C':'D',
    detail: eCAGR != null
      ? `Earnings CAGR of ${eCAGR.toFixed(1)}% — ${eCAGR>=18?'exceptional compounding engine':'solid growth trajectory'}`
      : 'Insufficient earnings history — assess manually',
    icon:'📈'
  })

  // ── 2. REVENUE GROWTH ────────────────────────────────────────
  const rScore = revCAGR != null
    ? revCAGR >= 20 ? 10 : revCAGR >= 15 ? 8 : revCAGR >= 10 ? 6 : revCAGR >= 5 ? 4 : 2
    : 3
  pillars.push({
    name:'Revenue Growth',
    score: rScore,
    grade: rScore>=8?'A':rScore>=6?'B':rScore>=4?'C':'D',
    detail: revCAGR != null
      ? `Revenue CAGR of ${revCAGR.toFixed(1)}% — ${revCAGR>=15?'top-line momentum is strong':'steady revenue building'}`
      : 'Revenue history insufficient',
    icon:'💰'
  })

  // ── 3. RETURN ON EQUITY (Capital Efficiency) ─────────────────
  const roeScore = roe != null
    ? roe >= 25 ? 10 : roe >= 20 ? 8 : roe >= 15 ? 6 : roe >= 10 ? 4 : 2
    : 3
  pillars.push({
    name:'Capital Efficiency (ROE)',
    score: roeScore,
    grade: roeScore>=8?'A':roeScore>=6?'B':roeScore>=4?'C':'D',
    detail: roe != null
      ? `ROE of ${roe.toFixed(1)}% — ${roe>=20?'management is creating exceptional returns on every rupee invested':'capital is being deployed reasonably'}`
      : 'ROE data unavailable',
    icon:'⚡'
  })

  // ── 4. PROMOTER CONVICTION (Management Quality) ──────────────
  const phScore = ph != null
    ? ph >= 65 ? 10 : ph >= 50 ? 8 : ph >= 40 ? 6 : ph >= 25 ? 4 : 2
    : 4
  pillars.push({
    name:'Management Conviction',
    score: phScore,
    grade: phScore>=8?'A':phScore>=6?'B':phScore>=4?'C':'D',
    detail: ph != null
      ? `Promoter holding at ${ph.toFixed(1)}% — ${ph>=55?'founders have maximum skin-in-the-game, decisions aligned with shareholders':'management has meaningful stake in the business'}`
      : 'Promoter holding data unavailable',
    icon:'👔'
  })

  // ── 5. FINANCIAL HEALTH (Balance Sheet Quality) ──────────────
  const deScore  = de  != null ? de  < 0.2 ? 10 : de  < 0.5 ? 8 : de  < 1.0 ? 5 : de  < 1.5 ? 3 : 1 : 5
  const crScore  = cr  != null ? cr  > 2.5 ? 10 : cr  > 1.8 ? 8 : cr  > 1.2 ? 5 : cr  > 0.8 ? 3 : 1 : 5
  const fcfScore = fcf != null ? (fcf > 0 ? 9 : 2) : 5
  const bsScore  = Math.round((deScore + crScore + fcfScore) / 3)
  pillars.push({
    name:'Balance Sheet Health',
    score: bsScore,
    grade: bsScore>=8?'A':bsScore>=6?'B':bsScore>=4?'C':'D',
    detail: `D/E: ${de!=null?de.toFixed(2):'N/A'} · Current Ratio: ${cr!=null?cr.toFixed(2):'N/A'} · FCF: ${fcf!=null?(fcf>0?'Positive ✓':'Negative ✗'):'N/A'} — ${bsScore>=7?'fortress balance sheet enabling aggressive future investments':'adequate financial health'}`,
    icon:'🏛️'
  })

  // ── 6. PROFIT MARGINS (Moat Indicator) ───────────────────────
  const nmScore = nm != null
    ? nm >= 20 ? 10 : nm >= 15 ? 8 : nm >= 10 ? 6 : nm >= 5 ? 4 : 2
    : 3
  const omScore = om != null
    ? om >= 25 ? 10 : om >= 20 ? 8 : om >= 15 ? 6 : om >= 10 ? 4 : 2
    : 3
  const marginScore = Math.round((nmScore + omScore) / 2)
  pillars.push({
    name:'Profit Margins (Moat)',
    score: marginScore,
    grade: marginScore>=8?'A':marginScore>=6?'B':marginScore>=4?'C':'D',
    detail: `Net margin: ${nm!=null?nm.toFixed(1)+'%':'N/A'} · Op. margin: ${om!=null?om.toFixed(1)+'%':'N/A'} — ${marginScore>=7?'high margins signal pricing power and competitive moat':'margins indicate moderate competitive position'}`,
    icon:'🏆'
  })

  // ── 7. VALUATION OPPORTUNITY ─────────────────────────────────
  const valScore2 = upside >= 30 ? 10 : upside >= 20 ? 8 : upside >= 10 ? 6 : upside >= 0 ? 4 : 2
  const peScore2  = pe != null
    ? pe < 15 ? 10 : pe < 22 ? 8 : pe < 30 ? 5 : pe < 40 ? 3 : 1
    : 5
  const entryScore = Math.round((valScore2 + peScore2) / 2)
  pillars.push({
    name:'Valuation Entry',
    score: entryScore,
    grade: entryScore>=8?'A':entryScore>=6?'B':entryScore>=4?'C':'D',
    detail: `${upside.toFixed(1)}% upside to fair value · P/E: ${pe!=null?pe.toFixed(1):'N/A'} — ${entryScore>=7?'compelling entry point with margin of safety':'fair entry, monitor for better price'}`,
    icon:'🎯'
  })

  // ── 8. MARKET OPPORTUNITY (TAM & Sector Tailwind) ────────────
  const tamScore  = Math.min(10, Math.round(secMult * 0.65))
  pillars.push({
    name:'Market Opportunity',
    score: tamScore,
    grade: tamScore>=8?'A':tamScore>=6?'B':tamScore>=4?'C':'D',
    detail: `${sector} — ${tamScore>=8?'massive total addressable market with secular growth drivers':'sizeable and growing addressable market'} · India macro tailwinds add structural momentum`,
    icon:'🌏'
  })

  // ── 9. SMALL/MID CAP ADVANTAGE ───────────────────────────────
  const capScore = mktCap != null
    ? mktCap < 5e11   ? 10   // <500 Cr — small cap
    : mktCap < 2e12   ? 8    // <2000 Cr — mid cap
    : mktCap < 1e13   ? 5    // <10000 Cr — large mid
    : mktCap < 5e13   ? 3    // large cap
    : 1                       // mega cap (harder to 10x)
    : 5
  const capLabel = mktCap != null
    ? mktCap < 5e11 ? 'Small Cap' : mktCap < 2e12 ? 'Mid Cap' : mktCap < 1e13 ? 'Large Mid Cap' : 'Large Cap'
    : 'Unknown'
  pillars.push({
    name:'Size Advantage',
    score: capScore,
    grade: capScore>=8?'A':capScore>=6?'B':capScore>=4?'C':'D',
    detail: `${capLabel} — ${capScore>=7?'smaller market cap means more room to grow — institutional discovery can rapidly re-rate the stock':'large cap provides stability but limits explosive upside'}`,
    icon:'📊'
  })

  // ── 10. GROWTH REINVESTMENT (ROCE vs WACC) ───────────────────
  const roaScore2 = roa != null
    ? roa >= 18 ? 10 : roa >= 12 ? 8 : roa >= 8 ? 6 : roa >= 4 ? 4 : 2
    : 4
  pillars.push({
    name:'Reinvestment Quality (ROA)',
    score: roaScore2,
    grade: roaScore2>=8?'A':roaScore2>=6?'B':roaScore2>=4?'C':'D',
    detail: roa != null
      ? `ROA of ${roa.toFixed(1)}% — ${roa>=12?'every rupee of company assets is generating exceptional returns — growth is capital-efficient':'assets are being deployed with moderate efficiency'}`
      : 'ROA data unavailable',
    icon:'🔄'
  })

  const totalScore = Math.round(pillars.reduce((s,p)=>s+p.score,0) / pillars.length * 10)
  const mbClass    = multibaggerClass(totalScore, revCAGR, eCAGR)

  return { pillars, totalScore, revCAGR, eCAGR, mbClass }
}

/* Build rich multibagger narrative reasons */
function buildMBReasons(quote, sector, mb, valuation, incomeHistory) {
  const roe  = quote.returnOnEquity   != null ? quote.returnOnEquity   * 100 : null
  const de   = quote.debtToEquity     != null ? Math.abs(quote.debtToEquity) / 100 : null
  const nm   = quote.profitMargins    != null ? quote.profitMargins    * 100 : null
  const ph   = quote.heldPercentInsiders != null ? quote.heldPercentInsiders * 100 : null
  const mktCap = quote.marketCap
  const reasons = []

  // Growth story
  if (mb.eCAGR != null && mb.eCAGR >= 12)
    reasons.push({ category:'Growth Engine', priority:1,
      text:`Earnings compounding at ${mb.eCAGR.toFixed(1)}% CAGR — at this rate, earnings double every ${(72/mb.eCAGR).toFixed(1)} years. Sustained high earnings growth is the single most powerful driver of long-term stock returns.` })

  // Management quality
  if (ph != null && ph > 50)
    reasons.push({ category:'Management Quality', priority:2,
      text:`Promoters hold ${ph.toFixed(1)}% of the company — founders who own majority stakes make decisions like owners, not employees. They avoid dilution, avoid reckless debt, and focus on building long-term shareholder value.` })

  // Capital efficiency
  if (roe != null && roe > 18)
    reasons.push({ category:'Capital Efficiency', priority:3,
      text:`ROE of ${roe.toFixed(1)}% means the company earns ₹${(roe/100).toFixed(2)} on every ₹1 of shareholder equity annually. Compounded over 5 years with reinvestment, this creates exponential wealth for patient investors.` })

  // Debt safety
  if (de != null && de < 0.4)
    reasons.push({ category:'Financial Safety', priority:4,
      text:`Debt-to-equity of only ${de.toFixed(2)} — the company can fund its own growth without borrowing. Zero-debt businesses don't face financial distress during economic downturns and can invest aggressively when competitors are retreating.` })

  // Market opportunity
  reasons.push({ category:'India Tailwind', priority:5,
    text:`${sector} businesses in India are riding demographic and economic megatrends — 1.4 billion growing consumers, rising incomes, and increasing formalisation of the economy. These are decade-long tailwinds, not quarterly cycles.` })

  // Valuation
  if ((valuation?.upsidePct || 0) > 10)
    reasons.push({ category:'Valuation Opportunity', priority:6,
      text:`Stock trades ${(valuation.upsidePct).toFixed(0)}% below estimated fair value — buying quality businesses at a discount amplifies returns significantly. A 20% discount to fair value means you start with a built-in margin of safety.` })

  // Small cap potential
  if (mktCap != null && mktCap < 2e12)
    reasons.push({ category:'Discovery Potential', priority:7,
      text:`Market cap of ${mktCap<5e11?'under ₹500 Cr':'under ₹2,000 Cr'} means institutional investors (mutual funds, FIIs) have largely not yet discovered this stock. When they do, the re-rating can be explosive — small caps regularly deliver 5–10x returns during discovery cycles.` })

  // FCF
  if (quote.freeCashflow != null && quote.freeCashflow > 0)
    reasons.push({ category:'Cash Generation', priority:8,
      text:`Business generates positive free cash flow — real cash, not just accounting profits. FCF-rich companies can self-fund expansion, pay dividends, and buy back shares without diluting existing investors.` })

  // Moat
  if (nm != null && nm > 15)
    reasons.push({ category:'Economic Moat', priority:9,
      text:`Net margin of ${nm.toFixed(1)}% signals a durable competitive advantage — pricing power, brand strength, or cost leadership that competitors cannot easily replicate. Moats protect future earnings and enable premium valuations.` })

  reasons.push({ category:'Long-term Compounding', priority:10,
    text:`The biggest wealth creator in stock markets is time. If this business maintains its current growth trajectory, the power of compounding over 5–7 years can generate returns that short-term traders never access.` })

  return reasons.sort((a,b)=>a.priority-b.priority).slice(0,7)
}


// ─── FVG Helper Functions ────────────────────────────────────────────────────
function detectFVGs(candles) {
  const gaps = []
  for (let i = 0; i < candles.length - 2; i++) {
    const c0 = candles[i], c1 = candles[i+1], c2 = candles[i+2]
    if (!c0.high || !c2.low) continue
    // Bullish FVG
    if (c0.high < c2.low) {
      const gapHigh = c2.low, gapLow = c0.high
      const gapPct  = ((gapHigh - gapLow) / gapLow) * 100
      if (gapPct < 0.1) continue
      const filled = candles.slice(i+3).some(c => c.low <= gapHigh && c.high >= gapLow)
      gaps.push({ type:'bullish', date:c1.date, gapHigh:+gapHigh.toFixed(2), gapLow:+gapLow.toFixed(2),
        gapMid:+((gapHigh+gapLow)/2).toFixed(2), gapPct:+gapPct.toFixed(2), filled,
        recency: candles.length - 1 - (i+2) })
    }
    // Bearish FVG
    if (c0.low > c2.high) {
      const gapHigh = c0.low, gapLow = c2.high
      const gapPct  = ((gapHigh - gapLow) / gapLow) * 100
      if (gapPct < 0.1) continue
      const filled = candles.slice(i+3).some(c => c.low <= gapHigh && c.high >= gapLow)
      gaps.push({ type:'bearish', date:c1.date, gapHigh:+gapHigh.toFixed(2), gapLow:+gapLow.toFixed(2),
        gapMid:+((gapHigh+gapLow)/2).toFixed(2), gapPct:+gapPct.toFixed(2), filled,
        recency: candles.length - 1 - (i+2) })
    }
  }
  return gaps
}

function bestFVG(gaps, currentPrice) {
  const unfilled = gaps.filter(g => !g.filled)
  if (!unfilled.length) return null
  return unfilled.map(g => {
    const distPct = Math.abs(currentPrice - g.gapMid) / currentPrice * 100
    return { ...g, distPct:+distPct.toFixed(2), score:(1/(g.recency+1))*50 + (1/(distPct+1))*50 }
  }).sort((a,b) => b.score - a.score)[0]
}

/* FVG scan endpoint */
app.get('/api/fvg', async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 40, 163)
  const type   = req.query.type   || 'all'   // 'bullish' | 'bearish' | 'all'
  const minGap = parseFloat(req.query.min)   || 0.2   // min gap %

  const scanList = STOCKS.slice(0, limit)
  console.log(`[FVG] Scanning ${scanList.length} stocks on Daily timeframe…`)

  const results  = []
  const threeMonAgo = new Date()
  threeMonAgo.setMonth(threeMonAgo.getMonth() - 4)

  for (let i = 0; i < scanList.length; i += 6) {
    const batch = scanList.slice(i, i+6)
    const batchR = await Promise.allSettled(
      batch.map(async (st) => {
        try {
          const chartData = await yf.chart(st.symbol, {
            period1:  threeMonAgo,
            period2:  new Date(),
            interval: '1d',
          })

          const quotes = chartData?.quotes || []
          if (quotes.length < 10) return null

          const candles = quotes
            .filter(q => q.open && q.high && q.low && q.close)
            .map(q => ({
              date:   new Date(q.date).toISOString().split('T')[0],
              open:   parseFloat(q.open.toFixed(2)),
              high:   parseFloat(q.high.toFixed(2)),
              low:    parseFloat(q.low.toFixed(2)),
              close:  parseFloat(q.close.toFixed(2)),
              volume: q.volume || 0,
            }))

          if (candles.length < 5) return null

          const currentPrice = candles[candles.length-1].close
          const allGaps      = detectFVGs(candles)
          const best         = bestFVG(allGaps, currentPrice)

          if (!best)                 return null
          if (best.gapPct < minGap)  return null
          if (type !== 'all' && best.type !== type) return null

          // All unfilled gaps for display
          const unfilledGaps = allGaps.filter(g => !g.filled)

          // Price relative to gap
          const priceVsGap =
            currentPrice > best.gapHigh ? 'above_gap' :
            currentPrice < best.gapLow  ? 'below_gap' : 'inside_gap'

          // Signal
          const signal =
            best.type === 'bullish' && priceVsGap === 'below_gap' ? 'BUY — Price below bullish FVG, gap likely to be filled upward' :
            best.type === 'bullish' && priceVsGap === 'above_gap' ? 'WATCH — Bullish FVG below current price, acts as support' :
            best.type === 'bearish' && priceVsGap === 'above_gap' ? 'SELL — Price above bearish FVG, gap likely to be filled downward' :
            best.type === 'bearish' && priceVsGap === 'below_gap' ? 'WATCH — Bearish FVG above current price, acts as resistance' :
            'INSIDE GAP — Price trading inside the FVG zone'

          return {
            symbol:       st.symbol.replace('.NS',''),
            fullSymbol:   st.symbol,
            name:         st.name,
            sector:       st.sector,
            currentPrice,
            fvg:          best,
            allUnfilledFVGs: unfilledGaps.length,
            priceVsGap,
            signal,
            candles:      candles.slice(-60),   // last 60 daily candles for chart
          }
        } catch (e) { return null }
      })
    )
    batchR.forEach(r => { if (r.status==='fulfilled' && r.value) results.push(r.value) })
    if (i+6 < scanList.length) await new Promise(r => setTimeout(r, 300))
  }

  // Sort: unfilled + most recent first
  results.sort((a,b) => a.fvg.recency - b.fvg.recency)
  console.log(`[FVG] Found ${results.length} stocks with active FVGs`)
  res.json({ scanned:scanList.length, found:results.length, timestamp:new Date().toISOString(), stocks:results })
})

/* Single stock FVG detail */
app.get('/api/fvg/:symbol', async (req, res) => {
  const symbol = req.params.symbol.includes('.') ? req.params.symbol : `${req.params.symbol}.NS`
  try {
    const threeMonAgo = new Date(); threeMonAgo.setMonth(threeMonAgo.getMonth()-4)
    const chartData = await yf.chart(symbol, { period1:threeMonAgo, period2:new Date(), interval:'1d' })
    const quotes    = chartData?.quotes || []
    const candles   = quotes.filter(q=>q.open&&q.high&&q.low&&q.close).map(q=>({
      date: new Date(q.date).toISOString().split('T')[0],
      open: parseFloat(q.open.toFixed(2)), high: parseFloat(q.high.toFixed(2)),
      low:  parseFloat(q.low.toFixed(2)),  close:parseFloat(q.close.toFixed(2)),
      volume: q.volume||0,
    }))
    const allGaps   = detectFVGs(candles)
    const currentPrice = candles[candles.length-1]?.close || 0
    const best      = bestFVG(allGaps, currentPrice)
    res.json({ symbol, candles, allGaps, bestFVG: best, currentPrice })
  } catch(e) { res.status(500).json({ error: e.message }) }
})


// ── Global error handler — always return JSON, never HTML ──────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path })
})

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════╗
  ║   StockPredict AI — Backend Server        ║
  ║   http://localhost:${PORT}                    ║
  ║   Real-time NSE data via Yahoo Finance    ║
  ╚═══════════════════════════════════════════╝
  `)
})

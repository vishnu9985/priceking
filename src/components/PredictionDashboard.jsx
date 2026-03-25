import React, { useState, useMemo } from 'react'
import {
  ComposedChart, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend
} from 'recharts'
import {
  ArrowLeft, RefreshCw, TrendingUp, TrendingDown,
  Brain, DollarSign, Target, BarChart2, Shield,
  ArrowUpRight, ArrowDownRight, Clock, Zap
} from 'lucide-react'
import { fmtPrice, fmtINR, fmtPct, fmtNum, fmtVol, colorForChange, recColor } from '../utils/format.js'
import s from './PredictionDashboard.module.css'

const TABS = [
  { id:'predict',  label:'Predictions',  Icon: Brain      },
  { id:'valuation',label:'Valuation',    Icon: DollarSign },
  { id:'price',    label:'Price History',Icon: BarChart2  },
  { id:'financials',label:'Financials',  Icon: Target     },
  { id:'risk',     label:'Risk & Health',Icon: Shield     },
]

const CT = {
  backgroundColor:'#111626',
  border:'1px solid rgba(255,255,255,0.10)',
  borderRadius:'10px',
  color:'#f0f2ff',
  fontSize:12,
  fontFamily:'JetBrains Mono, monospace'
}

function KpiCard({ label, value, color, sub, accent }) {
  return (
    <div className={`${s.kpi} ${accent ? s.kpiAccent : ''}`}>
      <span className={s.kpiL}>{label}</span>
      <span className={s.kpiV} style={color?{color}:{}}>{value}</span>
      {sub && <span className={s.kpiS}>{sub}</span>}
    </div>
  )
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className={s.secTitle}>{Icon && <Icon size={13}/>}{children}</div>
  )
}

export default function PredictionDashboard({ stockData, livePrice, prevPrice, direction, onBack, onRefresh, loading, lastTs }) {
  const [tab, setTab] = useState('predict')
  const { quote, history, analysis, mlPredictions } = stockData

  const change    = useMemo(() => (livePrice??0) - (prevPrice??0), [livePrice, prevPrice])
  const changePct = useMemo(() => prevPrice ? change/prevPrice*100 : 0, [change, prevPrice])
  const isUp      = change >= 0

  const sym = quote.symbol?.replace('.NS','') || '—'
  const rec = analysis?.valuation?.recommendation
  const valData = analysis?.valuation
  const fundData = analysis?.fundamentals
  const mlData   = mlPredictions

  // Chart data: merge history tail + predictions
  const combinedChart = useMemo(() => {
    if (!mlData?.predictions?.length) return []
    const histTail = (history || []).slice(-20).map(h => ({ ...h, type:'history' }))
    const preds    = mlData.predictions.map(p => ({ date: p.date, close: null, ...p, type:'pred' }))
    return [...histTail, ...preds]
  }, [history, mlData])

  return (
    <div className={s.wrap}>

      {/* ─── TOP BAR ─── */}
      <div className={s.topBar}>
        <button className={s.back} onClick={onBack}><ArrowLeft size={13}/> Back</button>

        <div className={s.stockId}>
          <span className={s.symBig}>{sym}</span>
          <div>
            <p className={s.coName}>{quote.shortName || quote.longName || '—'}</p>
            <p className={s.coMeta}>{quote.sector || '—'} · {quote.exchange || 'NSE'}</p>
          </div>
        </div>

        <div className={s.priceCluster}>
          <span className={`${s.bigPrice} ${direction==='up'?s.tickUp:direction==='down'?s.tickDown:''}`}>
            {fmtPrice(livePrice)}
          </span>
          <span className={s.chgBadge} style={{background:isUp?'var(--green-bg)':'var(--red-bg)', border:`1px solid ${isUp?'var(--green-bd)':'var(--red-bd)'}`}}>
            {isUp ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
            <span style={{color:isUp?'var(--green)':'var(--red)'}}>
              {isUp?'+':''}{fmtNum(change)} ({isUp?'+':''}{fmtNum(changePct)}%)
            </span>
          </span>
        </div>

        <div className={s.topRight}>
          {lastTs && (
            <span className={s.tsLabel}><Clock size={10}/> {lastTs.toLocaleTimeString()}</span>
          )}
          <button className={s.refreshBtn} onClick={onRefresh} disabled={loading} title="Refresh">
            <RefreshCw size={13} className={loading ? s.spin : ''}/>
          </button>
        </div>
      </div>

      {/* ─── QUICK STATS ─── */}
      <div className={s.quickRow}>
        <div className={s.quickStat}>
          <span className={s.qs_l}>Open</span>
          <span className={s.qs_v}>{fmtPrice(quote.regularMarketOpen)}</span>
        </div>
        <div className={s.quickStat}>
          <span className={s.qs_l}>High</span>
          <span className={s.qs_v} style={{color:'var(--green)'}}>{fmtPrice(quote.regularMarketDayHigh)}</span>
        </div>
        <div className={s.quickStat}>
          <span className={s.qs_l}>Low</span>
          <span className={s.qs_v} style={{color:'var(--red)'}}>{fmtPrice(quote.regularMarketDayLow)}</span>
        </div>
        <div className={s.quickStat}>
          <span className={s.qs_l}>52W High</span>
          <span className={s.qs_v}>{fmtPrice(quote.fiftyTwoWeekHigh)}</span>
        </div>
        <div className={s.quickStat}>
          <span className={s.qs_l}>52W Low</span>
          <span className={s.qs_v}>{fmtPrice(quote.fiftyTwoWeekLow)}</span>
        </div>
        <div className={s.quickStat}>
          <span className={s.qs_l}>Volume</span>
          <span className={s.qs_v}>{fmtVol(quote.regularMarketVolume)}</span>
        </div>
        <div className={s.quickStat}>
          <span className={s.qs_l}>Mkt Cap</span>
          <span className={s.qs_v}>{fmtINR(quote.marketCap)}</span>
        </div>
        <div className={s.quickStat}>
          <span className={s.qs_l}>P/E</span>
          <span className={s.qs_v}>{fmtNum(quote.trailingPE)}</span>
        </div>
      </div>

      {/* ─── TABS ─── */}
      <div className={s.tabs}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id}
            className={`${s.tab} ${tab===id?s.tabOn:''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={12}/>{label}
          </button>
        ))}
      </div>

      {/* ─── CONTENT ─── */}
      <div className={s.content}>

        {/* ══ PREDICTIONS ══ */}
        {tab === 'predict' && (
          <div className={s.animIn}>
            {mlData ? (
              <>
                {/* Ensemble forecast */}
                <div className={s.chartCard}>
                  <div className={s.chartCardHead}>
                    <SectionTitle icon={Brain}>30-Day Ensemble Price Forecast</SectionTitle>
                    <div className={s.legend}>
                      <span className={s.lgItem} style={{color:'var(--blue2)'}}>── History</span>
                      <span className={s.lgItem} style={{color:'var(--purple2)'}}>── Predicted</span>
                      <span className={s.lgItem} style={{color:'var(--green)'}}>-- Upper 95%</span>
                      <span className={s.lgItem} style={{color:'var(--red)'}}>-- Lower 5%</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={combinedChart}>
                      <defs>
                        <linearGradient id="histG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3d8ef0" stopOpacity={.2}/>
                          <stop offset="95%" stopColor="#3d8ef0" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="predG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#9b6dff" stopOpacity={.18}/>
                          <stop offset="95%" stopColor="#9b6dff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="date" tick={{fill:'#4a5070',fontSize:10}} tickLine={false} axisLine={false} interval={6}/>
                      <YAxis tick={{fill:'#4a5070',fontSize:10}} tickLine={false} axisLine={false}
                        tickFormatter={v=>'₹'+Number(v).toLocaleString('en-IN')} width={72}/>
                      <Tooltip contentStyle={CT} formatter={(v,name)=>[v?'₹'+Number(v).toLocaleString('en-IN'):'—', name]}/>
                      <Area  type="monotone" dataKey="close"          name="History"    stroke="#3d8ef0" strokeWidth={1.5} fill="url(#histG)" dot={false} connectNulls={false}/>
                      <Area  type="monotone" dataKey="predictedPrice" name="Predicted"  stroke="#9b6dff" strokeWidth={2}   fill="url(#predG)" dot={false} connectNulls={false}/>
                      <Line  type="monotone" dataKey="upperBound"     name="Upper 95%"  stroke="#2ecc8a" strokeWidth={1}   dot={false} strokeDasharray="4 3" connectNulls={false}/>
                      <Line  type="monotone" dataKey="lowerBound"     name="Lower 5%"   stroke="#f04f5a" strokeWidth={1}   dot={false} strokeDasharray="4 3" connectNulls={false}/>
                      <ReferenceLine x={history?.slice(-1)[0]?.date} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" label={{value:'Today',fill:'#8891b0',fontSize:10}}/>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Target prices */}
                <div className={s.targetRow}>
                  {[
                    { label:'7-Day Target',  value: mlData.predictions?.[6]?.predictedPrice,  color:'var(--blue2)'   },
                    { label:'15-Day Target', value: mlData.predictions?.[14]?.predictedPrice, color:'var(--purple2)' },
                    { label:'30-Day Target', value: mlData.predictions?.[29]?.predictedPrice, color:'var(--teal)'    },
                    { label:'MC Median 30d', value: mlData.monteCarlo?.p50,                   color:'var(--amber)'   },
                    { label:'Bear Case 5%',  value: mlData.monteCarlo?.p5,                    color:'var(--red)'     },
                    { label:'Bull Case 95%', value: mlData.monteCarlo?.p95,                   color:'var(--green)'   },
                  ].map(t => {
                    const pct = livePrice && t.value ? (t.value/livePrice-1)*100 : null
                    return (
                      <div key={t.label} className={s.targetCard}>
                        <span className={s.targetL}>{t.label}</span>
                        <span className={s.targetV} style={{color:t.color}}>{fmtPrice(t.value)}</span>
                        {pct!=null && (
                          <span className={s.targetPct} style={{color:pct>=0?'var(--green)':'var(--red)'}}>
                            {pct>=0?'+':''}{pct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Technical indicators */}
                <div className={s.techGrid}>
                  <SectionTitle icon={Zap}>Technical Indicators</SectionTitle>
                  <div className={s.techCards}>
                    {[
                      { label:'RSI (14)',      value: fmtNum(mlData.technicalIndicators?.rsi),
                        hint: mlData.technicalIndicators?.rsi > 70 ? '⚠ Overbought' : mlData.technicalIndicators?.rsi < 30 ? '⚠ Oversold' : 'Neutral',
                        color: mlData.technicalIndicators?.rsi > 70 ? 'var(--red)' : mlData.technicalIndicators?.rsi < 30 ? 'var(--green)' : 'var(--t2)' },
                      { label:'Volatility',   value: mlData.technicalIndicators?.volatility+'%', hint:'Annualised' },
                      { label:'Trend',        value: mlData.technicalIndicators?.trend,           hint: mlData.technicalIndicators?.trendStrength,
                        color: mlData.technicalIndicators?.trend==='Uptrend' ? 'var(--green)' : mlData.technicalIndicators?.trend==='Downtrend'?'var(--red)':'var(--t2)' },
                      { label:'Sentiment',    value: mlData.sentiment?.label,                     hint:'Score: '+mlData.sentiment?.score+'/100',
                        color: mlData.sentiment?.score>=65?'var(--green)':mlData.sentiment?.score>=45?'var(--amber)':'var(--red)' },
                      { label:'SMA (20)',     value: fmtPrice(mlData.technicalIndicators?.sma20)  },
                      { label:'EMA (20)',     value: fmtPrice(mlData.technicalIndicators?.ema20)  },
                      { label:'MACD Signal',  value: mlData.technicalIndicators?.macdSignal || '—' },
                      { label:'BB Width',     value: mlData.technicalIndicators?.bbWidth ? fmtNum(mlData.technicalIndicators.bbWidth,1)+'%' : '—',
                        hint:'Bollinger Band Width' },
                    ].map(ti => (
                      <div key={ti.label} className={s.techCard}>
                        <span className={s.techL}>{ti.label}</span>
                        <span className={s.techV} style={ti.color?{color:ti.color}:{}}>{ti.value || '—'}</span>
                        {ti.hint && <span className={s.techH}>{ti.hint}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Model weights info */}
                <div className={s.modelInfo}>
                  <SectionTitle icon={Brain}>Ensemble Model Composition</SectionTitle>
                  <div className={s.modelCards}>
                    {(mlData.modelWeights || [{name:'Linear Regression',weight:40,desc:'30-day trend extrapolation'},{name:'Monte Carlo',weight:35,desc:'500-path stochastic simulation'},{name:'Mean Reversion',weight:25,desc:'60-day historical average pull'}]).map(m => (
                      <div key={m.name} className={s.modelCard}>
                        <div className={s.mHead}>
                          <span className={s.mName}>{m.name}</span>
                          <span className={s.mWt}>{m.weight}%</span>
                        </div>
                        <div className={s.mBar}><div className={s.mBarFill} style={{width:m.weight+'%'}}/></div>
                        <p className={s.mDesc}>{m.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : <p className={s.empty}>ML predictions unavailable — check backend connection</p>}
          </div>
        )}

        {/* ══ VALUATION ══ */}
        {tab === 'valuation' && (
          <div className={s.animIn}>
            {valData ? (
              <>
                {/* Recommendation banner */}
                <div className={s.recBanner} data-rec={rec}>
                  <div>
                    <p className={s.recTitle}>Investment Signal</p>
                    <p className={s.recSub}>CAPM-DCF + Relative Valuation · Discount rate: {fmtNum(valData.discountRate)}%</p>
                  </div>
                  <div className={s.recRight}>
                    <span className={s.recBadge} data-rec={rec}>{rec}</span>
                    <span className={s.upsideBig} style={{color:colorForChange(valData.upsidePct)}}>
                      {fmtPct(valData.upsidePct)} upside
                    </span>
                  </div>
                </div>

                {/* Valuation matrix */}
                <div className={s.valMatrix}>
                  {[
                    { label:'Current Price',      value:fmtPrice(livePrice),                  accent:true                                    },
                    { label:'DCF Intrinsic Value', value:fmtPrice(valData.dcfValue)                                                          },
                    { label:'Relative Fair Value', value:fmtPrice(valData.relativeValue)                                                     },
                    { label:'Blended Fair Value',  value:fmtPrice(valData.fairValue),          color:'var(--blue2)'                           },
                    { label:'Best Buy Price',      value:fmtPrice(valData.bestBuyPrice),       color:'var(--green)',  sub:'(75% of fair value)'},
                    { label:'Upside Potential',    value:fmtPct(valData.upsidePct),            color:colorForChange(valData.upsidePct)         },
                    { label:'1-Year Target',       value:fmtPrice(valData.target1Y),           color:'var(--purple2)'                         },
                    { label:'2-Year Target',       value:fmtPrice(valData.target2Y),           color:'var(--teal)'                            },
                    { label:'Margin of Safety',    value:fmtPct(valData.marginOfSafety),       color:colorForChange(valData.marginOfSafety)    },
                    { label:'Terminal Growth',     value:fmtNum(valData.terminalGrowth)+'%',   sub:'Assumed'                                  },
                    { label:'CAPM Rate (r)',        value:fmtNum(valData.discountRate)+'%',     sub:'Rf + β × ERP'                             },
                    { label:'Beta (β)',             value:fmtNum(quote.beta),                  sub:'Market sensitivity'                       },
                  ].map(k => <KpiCard key={k.label} {...k}/>)}
                </div>

                {/* Price vs fair-value gauge */}
                {valData.fairValue && livePrice && (
                  <div className={s.gaugeCard}>
                    <SectionTitle icon={Target}>Price vs Fair Value</SectionTitle>
                    <div className={s.gauge}>
                      <span className={s.gaugeL}>Bear {fmtPrice(valData.bestBuyPrice)}</span>
                      <div className={s.gaugTrack}>
                        {/* fair value marker */}
                        <div className={s.gaugeMarker} style={{
                          left: Math.min(98, Math.max(2, ((valData.fairValue - valData.bestBuyPrice) / (valData.target2Y - valData.bestBuyPrice))*100)) + '%',
                          background: 'var(--blue2)'
                        }}/>
                        {/* current price marker */}
                        <div className={s.gaugeCurrent} style={{
                          left: Math.min(98, Math.max(2, ((livePrice - valData.bestBuyPrice) / (valData.target2Y - valData.bestBuyPrice))*100)) + '%'
                        }}/>
                        <div className={s.gaugeFill} style={{
                          width: Math.min(100, Math.max(0, ((livePrice - valData.bestBuyPrice) / (valData.target2Y - valData.bestBuyPrice))*100)) + '%',
                          background: colorForChange(valData.upsidePct)
                        }}/>
                      </div>
                      <span className={s.gaugeR}>Bull {fmtPrice(valData.target2Y)}</span>
                    </div>
                    <div className={s.gaugeLegend}>
                      <span style={{color:'var(--blue2)'}}>▲ Fair value {fmtPrice(valData.fairValue)}</span>
                      <span style={{color:'var(--amber)'}}>● Current {fmtPrice(livePrice)}</span>
                    </div>
                  </div>
                )}

                {/* Peer comparison KPIs */}
                <div className={s.kpiGrid}>
                  {[
                    { label:'P/E (TTM)',    value:fmtNum(quote.trailingPE) },
                    { label:'P/E (Fwd)',   value:fmtNum(quote.forwardPE)  },
                    { label:'P/B Ratio',   value:fmtNum(quote.priceToBook) },
                    { label:'EV/EBITDA',   value:fmtNum(quote.enterpriseToEbitda) },
                    { label:'EV/Revenue',  value:fmtNum(quote.enterpriseToRevenue) },
                    { label:'PEG Ratio',   value:fmtNum(quote.pegRatio) },
                  ].map(k => <KpiCard key={k.label} {...k}/>)}
                </div>
              </>
            ) : <p className={s.empty}>Valuation data unavailable</p>}
          </div>
        )}

        {/* ══ PRICE HISTORY ══ */}
        {tab === 'price' && (
          <div className={s.animIn}>
            {history?.length > 0 ? (
              <>
                <div className={s.chartCard}>
                  <SectionTitle icon={BarChart2}>6-Month Price History (NSE)</SectionTitle>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3d8ef0" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3d8ef0" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="date" tick={{fill:'#4a5070',fontSize:10}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                      <YAxis tick={{fill:'#4a5070',fontSize:10}} tickLine={false} axisLine={false}
                        tickFormatter={v=>'₹'+Number(v).toLocaleString('en-IN')} width={72} domain={['auto','auto']}/>
                      <Tooltip contentStyle={CT} formatter={v=>['₹'+Number(v).toLocaleString('en-IN'),'Close']}/>
                      <Area type="monotone" dataKey="close" stroke="#3d8ef0" strokeWidth={1.5} fill="url(#aG)" dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className={s.chartCard} style={{marginTop:12}}>
                  <SectionTitle icon={BarChart2}>Daily Volume</SectionTitle>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={history.slice(-40)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                      <XAxis dataKey="date" tick={{fill:'#4a5070',fontSize:10}} tickLine={false} axisLine={false} interval={6}/>
                      <YAxis tick={{fill:'#4a5070',fontSize:10}} tickLine={false} axisLine={false}
                        tickFormatter={v=>fmtVol(v)} width={52}/>
                      <Tooltip contentStyle={CT} formatter={v=>[fmtVol(v),'Volume']}/>
                      <Bar dataKey="volume" fill="#3d8ef0" opacity={0.7} radius={[2,2,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : <p className={s.empty}>No historical price data</p>}
          </div>
        )}

        {/* ══ FINANCIALS ══ */}
        {tab === 'financials' && (
          <div className={s.animIn}>
            <div className={s.kpiGrid}>
              {[
                { label:'Total Revenue',   value:fmtINR(quote.totalRevenue) },
                { label:'Net Income',      value:fmtINR(quote.netIncomeToCommon) },
                { label:'Gross Profit',    value:fmtINR(quote.grossProfits) },
                { label:'EBITDA',          value:fmtINR(quote.ebitda) },
                { label:'Free Cash Flow',  value:fmtINR(quote.freeCashflow) },
                { label:'Operating CF',   value:fmtINR(quote.operatingCashflow) },
                { label:'Total Debt',      value:fmtINR(quote.totalDebt) },
                { label:'Cash',            value:fmtINR(quote.totalCash) },
                { label:'EPS (TTM)',       value:'₹'+fmtNum(quote.trailingEps) },
                { label:'Revenue/Share',   value:'₹'+fmtNum(quote.revenuePerShare) },
                { label:'Profit Margin',   value:fmtPct((quote.profitMargins||0)*100, false) },
                { label:'Operating Margin',value:fmtPct((quote.operatingMargins||0)*100, false) },
              ].map(k => <KpiCard key={k.label} {...k}/>)}
            </div>
            {analysis?.financialHistory?.length > 0 && (
              <div className={s.chartCard} style={{marginTop:12}}>
                <SectionTitle icon={BarChart2}>Annual Revenue vs Net Income (₹ Cr)</SectionTitle>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={analysis.financialHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                    <XAxis dataKey="year" tick={{fill:'#4a5070',fontSize:11}} tickLine={false} axisLine={false}/>
                    <YAxis tick={{fill:'#4a5070',fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>fmtINR(v)} width={68}/>
                    <Tooltip contentStyle={CT} formatter={v=>[fmtINR(v)]}/>
                    <Legend wrapperStyle={{fontSize:11,color:'#8891b0'}}/>
                    <Bar dataKey="revenue"   name="Revenue"    fill="#3d8ef0" radius={[3,3,0,0]}/>
                    <Bar dataKey="netIncome" name="Net Income" fill="#2ecc8a" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ══ RISK & HEALTH ══ */}
        {tab === 'risk' && (
          <div className={s.animIn}>
            {fundData ? (
              <>
                <div className={s.healthBanner}>
                  <div className={s.scoreRing} data-strength={fundData.strength}>
                    <span className={s.scoreN}>{fundData.score}</span>
                    <span className={s.scoreD}>/100</span>
                  </div>
                  <div>
                    <p className={s.strengthLbl} data-strength={fundData.strength}>{fundData.strength}</p>
                    <p className={s.strengthSub}>Fundamental health score</p>
                    <div className={s.scoreBar}>
                      <div className={s.scoreFill}
                        style={{width:`${fundData.score}%`,
                          background: fundData.score>=70?'var(--green)':fundData.score>=50?'var(--amber)':'var(--red)'}}/>
                    </div>
                  </div>
                </div>

                <div className={s.kpiGrid}>
                  {[
                    { label:'ROE',           value:fmtNum(fundData.roe)+'%',            color:fundData.roe>15?'var(--green)':fundData.roe>10?'var(--amber)':'var(--red)' },
                    { label:'ROCE',          value:fmtNum(fundData.roce)+'%'            },
                    { label:'Debt / Equity', value:fmtNum(fundData.debtToEquity),       color:fundData.debtToEquity<0.5?'var(--green)':fundData.debtToEquity<1.5?'var(--amber)':'var(--red)' },
                    { label:'Current Ratio', value:fmtNum(quote.currentRatio),         color:quote.currentRatio>1.5?'var(--green)':quote.currentRatio>1?'var(--amber)':'var(--red)' },
                    { label:'Net Margin',    value:fmtPct((quote.profitMargins||0)*100, false) },
                    { label:'Op. Margin',    value:fmtPct((quote.operatingMargins||0)*100, false) },
                  ].map(k => <KpiCard key={k.label} {...k}/>)}
                </div>

                {fundData.risks?.length > 0 ? (
                  <div className={s.riskList}>
                    <SectionTitle icon={Shield}>Risk Flags</SectionTitle>
                    {fundData.risks.map((r,i) => (
                      <div key={i} className={s.riskItem} data-sev={r.severity}>
                        <span className={s.rDot} data-sev={r.severity}/>
                        <div className={s.rBody}>
                          <p className={s.rType}>{r.type}</p>
                          <p className={s.rMsg}>{r.message}</p>
                        </div>
                        <span className={s.rSev} data-sev={r.severity}>{r.severity}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={s.noRisk}>
                    <Shield size={18}/> No significant risk flags identified
                  </div>
                )}
              </>
            ) : <p className={s.empty}>Fundamental data unavailable</p>}
          </div>
        )}

      </div>
    </div>
  )
}

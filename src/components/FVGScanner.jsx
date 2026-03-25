import React, { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Activity } from 'lucide-react'
import { fmtPrice, fmtPct } from '../utils/format.js'
import s from './FVGScanner.module.css'

const SCAN_SIZES = [
  { label:'Top 30', value:30 },
  { label:'Top 50', value:50 },
  { label:'Top 80', value:80 },
  { label:'All 163',value:163 },
]

// ─── Candlestick Chart ───────────────────────────────────────────────────────
function CandleChart({ candles, fvg }) {
  const W = 700, H = 300
  const PAD = { top:18, right:16, bottom:28, left:58 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top  - PAD.bottom

  if (!candles || candles.length < 3) return null

  const display = candles.slice(-55)
  const prices  = display.flatMap(c => [c.high, c.low])
  // Include FVG zone in range
  if (fvg) { prices.push(fvg.gapHigh * 1.005, fvg.gapLow * 0.995) }

  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  const xScale = (i) => PAD.left + (i / (display.length - 1)) * chartW
  const yScale = (p) => PAD.top  + (1 - (p - minP) / range) * chartH

  const candleW = Math.max(2, Math.floor(chartW / display.length * 0.7))

  // Y-axis ticks
  const ticks = 5
  const yTicks = Array.from({ length: ticks }, (_, i) => minP + (range * i) / (ticks - 1))

  // X-axis: show ~6 date labels
  const xStep = Math.floor(display.length / 6)
  const xLabels = display
    .map((c, i) => ({ i, date: c.date }))
    .filter((_, i) => i % xStep === 0 || i === display.length - 1)

  // FVG zone in pixel coords
  const fvgY1  = fvg ? yScale(fvg.gapHigh) : 0
  const fvgY2  = fvg ? yScale(fvg.gapLow)  : 0
  const fvgH   = Math.abs(fvgY2 - fvgY1)

  const bullColor = '#2ecc8a'
  const bearColor = '#ef4444'
  const fvgColor  = fvg?.type === 'bullish' ? bullColor : bearColor

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.chart} preserveAspectRatio="xMidYMid meet">
      {/* Background */}
      <rect x="0" y="0" width={W} height={H} fill="var(--bg1)" rx="8"/>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <line key={i}
          x1={PAD.left} y1={yScale(t)} x2={W - PAD.right} y2={yScale(t)}
          stroke="var(--b1)" strokeWidth="0.5" strokeDasharray="3,4"/>
      ))}

      {/* FVG zone */}
      {fvg && (
        <>
          <rect
            x={PAD.left} y={Math.min(fvgY1,fvgY2)}
            width={chartW} height={Math.max(fvgH, 2)}
            fill={fvgColor} fillOpacity="0.12"
          />
          <line x1={PAD.left} y1={fvgY1} x2={W-PAD.right} y2={fvgY1}
            stroke={fvgColor} strokeWidth="1.2" strokeDasharray="5,3" opacity="0.7"/>
          <line x1={PAD.left} y1={fvgY2} x2={W-PAD.right} y2={fvgY2}
            stroke={fvgColor} strokeWidth="1.2" strokeDasharray="5,3" opacity="0.7"/>
          {/* FVG label */}
          <rect x={W-PAD.right-70} y={Math.min(fvgY1,fvgY2)-1} width={68} height={14} rx="3"
            fill={fvgColor} fillOpacity="0.2"/>
          <text x={W-PAD.right-36} y={Math.min(fvgY1,fvgY2)+9}
            fill={fvgColor} fontSize="9" textAnchor="middle" fontFamily="var(--f-mono)">
            FVG {fvg.type === 'bullish' ? '▲' : '▼'} {fvg.gapPct.toFixed(2)}%
          </text>
        </>
      )}

      {/* Candles */}
      {display.map((c, i) => {
        const x      = xScale(i)
        const isBull = c.close >= c.open
        const color  = isBull ? bullColor : bearColor
        const bodyTop    = yScale(Math.max(c.open, c.close))
        const bodyBottom = yScale(Math.min(c.open, c.close))
        const bodyH      = Math.max(1, bodyBottom - bodyTop)

        return (
          <g key={i}>
            {/* Wick */}
            <line x1={x} y1={yScale(c.high)} x2={x} y2={yScale(c.low)}
              stroke={color} strokeWidth="1" opacity="0.8"/>
            {/* Body */}
            <rect
              x={x - candleW/2} y={bodyTop}
              width={candleW} height={bodyH}
              fill={isBull ? color : color}
              fillOpacity={isBull ? 0.85 : 0.85}
              stroke={color} strokeWidth="0.5"
            />
          </g>
        )
      })}

      {/* Current price line */}
      {(() => {
        const last = display[display.length-1]
        const y = yScale(last.close)
        const isBull = last.close >= last.open
        const col = isBull ? bullColor : bearColor
        return (
          <>
            <line x1={PAD.left} y1={y} x2={W-PAD.right} y2={y}
              stroke={col} strokeWidth="0.8" strokeDasharray="2,3" opacity="0.5"/>
            <rect x={W-PAD.right+2} y={y-8} width={52} height={16} rx="3" fill={col} fillOpacity="0.2"/>
            <text x={W-PAD.right+28} y={y+4}
              fill={col} fontSize="9.5" textAnchor="middle" fontFamily="var(--f-mono)" fontWeight="600">
              {fmtPrice(last.close)}
            </text>
          </>
        )
      })()}

      {/* Y axis labels */}
      {yTicks.map((t, i) => (
        <text key={i}
          x={PAD.left-6} y={yScale(t)+4}
          fill="var(--t3)" fontSize="9" textAnchor="end" fontFamily="var(--f-mono)">
          {t >= 1000 ? (t/1000).toFixed(1)+'k' : t.toFixed(0)}
        </text>
      ))}

      {/* X axis labels */}
      {xLabels.map(({ i, date }) => (
        <text key={i}
          x={xScale(i)} y={H - PAD.bottom + 14}
          fill="var(--t3)" fontSize="9" textAnchor="middle" fontFamily="var(--f-mono)">
          {date?.slice(5)}
        </text>
      ))}

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H-PAD.bottom}
        stroke="var(--b2)" strokeWidth="1"/>
      <line x1={PAD.left} y1={H-PAD.bottom} x2={W-PAD.right} y2={H-PAD.bottom}
        stroke="var(--b2)" strokeWidth="1"/>
    </svg>
  )
}

// ─── FVG Card ────────────────────────────────────────────────────────────────
function FVGCard({ stock }) {
  const [expanded, setExpanded] = useState(false)
  const { fvg } = stock

  const isBull   = fvg.type === 'bullish'
  const color    = isBull ? 'var(--green)' : 'var(--red)'
  const bgColor  = isBull ? 'var(--green-bg)' : 'var(--red-bg)'
  const bdColor  = isBull ? 'var(--green-bd)' : 'var(--red-bd)'

  const signalType =
    stock.signal.startsWith('BUY')   ? 'buy'   :
    stock.signal.startsWith('SELL')  ? 'sell'  : 'watch'

  return (
    <div className={s.card} style={{ '--accent': color, '--accent-bg': bgColor }}>
      <div className={s.topStripe} style={{ background: color }}/>

      {/* Header */}
      <div className={s.head}>
        <div className={s.headLeft}>
          <div className={s.symRow}>
            <span className={s.sym}>{stock.symbol}</span>
            <span className={s.fvgBadge} style={{ background: bgColor, border:`1px solid ${bdColor}`, color }}>
              {isBull ? '▲ Bullish FVG' : '▼ Bearish FVG'}
            </span>
            {stock.allUnfilledFVGs > 1 && (
              <span className={s.moreGaps}>+{stock.allUnfilledFVGs - 1} more gaps</span>
            )}
          </div>
          <p className={s.name}>{stock.name}</p>
          <span className={s.sector}>{stock.sector}</span>
        </div>
        <div className={s.headRight}>
          <span className={s.price}>{fmtPrice(stock.currentPrice)}</span>
          <span className={s.recency}>{fvg.recency === 0 ? 'Today' : `${fvg.recency}d ago`}</span>
          <span className={s.gapPct} style={{ color }}>Gap: {fvg.gapPct}%</span>
        </div>
      </div>

      {/* Signal */}
      <div className={s.signal} data-type={signalType}>
        <span className={s.signalDot} data-type={signalType}/>
        <span className={s.signalText}>{stock.signal}</span>
      </div>

      {/* Gap levels */}
      <div className={s.levels}>
        <div className={s.levelCard} style={{ borderColor: color }}>
          <span className={s.levelLabel}>Gap High</span>
          <span className={s.levelVal} style={{ color }}>{fmtPrice(fvg.gapHigh)}</span>
        </div>
        <div className={s.levelCard}>
          <span className={s.levelLabel}>Gap Mid (50%)</span>
          <span className={s.levelVal}>{fmtPrice(fvg.gapMid)}</span>
        </div>
        <div className={s.levelCard} style={{ borderColor: color }}>
          <span className={s.levelLabel}>Gap Low</span>
          <span className={s.levelVal} style={{ color }}>{fmtPrice(fvg.gapLow)}</span>
        </div>
        <div className={s.levelCard}>
          <span className={s.levelLabel}>Gap Size</span>
          <span className={s.levelVal}>{fvg.gapPct}%</span>
        </div>
        <div className={s.levelCard}>
          <span className={s.levelLabel}>Gap Date</span>
          <span className={s.levelVal}>{fvg.date}</span>
        </div>
        <div className={s.levelCard}>
          <span className={s.levelLabel}>Price vs Gap</span>
          <span className={s.levelVal} style={{ color }}>
            {stock.priceVsGap === 'above_gap' ? '↑ Above' : stock.priceVsGap === 'below_gap' ? '↓ Below' : '↔ Inside'}
          </span>
        </div>
      </div>

      {/* Chart toggle */}
      <button className={s.chartToggle} style={{ color }} onClick={() => setExpanded(e => !e)}>
        <Activity size={12}/>
        {expanded ? 'Hide Daily Chart' : 'Show Daily Chart with FVG Zone'}
        {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
      </button>

      {/* Daily Chart */}
      {expanded && (
        <div className={s.chartWrap}>
          <div className={s.chartHeader}>
            <span className={s.chartTitle}>{stock.symbol} — Daily Chart</span>
            <span className={s.chartSub}>
              <span style={{ color }}>{isBull ? '▲' : '▼'} FVG zone: {fmtPrice(fvg.gapLow)} – {fmtPrice(fvg.gapHigh)}</span>
              &nbsp;·&nbsp;{fvg.gapPct}% gap&nbsp;·&nbsp;
              {fvg.recency === 0 ? 'Formed today' : `Formed ${fvg.recency} trading day${fvg.recency > 1 ? 's' : ''} ago`}
            </span>
          </div>
          <CandleChart candles={stock.candles} fvg={fvg}/>
          <div className={s.chartLegend}>
            <span className={s.legItem} style={{ color: 'var(--green)' }}>▲ Bullish candle</span>
            <span className={s.legItem} style={{ color: 'var(--red)'   }}>▼ Bearish candle</span>
            <span className={s.legItem} style={{ color }}>
              <span style={{ display:'inline-block', width:16, height:8, background:`${color}30`, border:`1px dashed ${color}`, borderRadius:2, verticalAlign:'middle', marginRight:4 }}/>
              {isBull ? 'Bullish' : 'Bearish'} FVG zone
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function FVGScanner() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [scanSize,  setScanSize]  = useState(40)
  const [typeFilter,setTypeFilter]= useState('all')
  const [sort,      setSort]      = useState('recency')
  const [sector,    setSector]    = useState('All')

  const scan = useCallback(async (size, type) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/fvg?limit=${size}&type=${type}&min=0.15`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch(e) { setError(e.message) }
    finally    { setLoading(false)  }
  }, [])

  useEffect(() => { scan(scanSize, typeFilter) }, [scanSize, typeFilter])

  const sectors = data
    ? ['All', ...Array.from(new Set(data.stocks.map(s => s.sector))).sort()]
    : ['All']

  const filtered = (data?.stocks || [])
    .filter(s => sector === 'All' || s.sector === sector)
    .sort((a, b) => {
      if (sort === 'recency') return a.fvg.recency - b.fvg.recency
      if (sort === 'gap')     return b.fvg.gapPct - a.fvg.gapPct
      if (sort === 'alpha')   return a.symbol.localeCompare(b.symbol)
      return 0
    })

  const bulls = data?.stocks.filter(s => s.fvg.type === 'bullish').length || 0
  const bears = data?.stocks.filter(s => s.fvg.type === 'bearish').length || 0
  const buy   = data?.stocks.filter(s => s.signal.startsWith('BUY')).length  || 0
  const sell  = data?.stocks.filter(s => s.signal.startsWith('SELL')).length || 0

  return (
    <div className={s.wrap}>

      {/* Header */}
      <div className={s.header}>
        <div className={s.hLeft}>
          <div className={s.hIcon}><Activity size={20}/></div>
          <div>
            <h2 className={s.hTitle}>Fair Value Gap Scanner</h2>
            <p className={s.hSub}>Daily timeframe · 3-candle FVG detection · Unfilled gaps · Bullish & bearish zones</p>
          </div>
        </div>
        <div className={s.hRight}>
          {data && <span className={s.meta}>Scanned {data.scanned} · Found {data.found} stocks</span>}
          <div className={s.scanSizes}>
            {SCAN_SIZES.map(sz => (
              <button key={sz.value}
                className={`${s.sizeBtn} ${scanSize===sz.value ? s.sizeBtnOn : ''}`}
                onClick={() => setScanSize(sz.value)} disabled={loading}>
                {sz.label}
              </button>
            ))}
          </div>
          <button className={s.refreshBtn} onClick={() => scan(scanSize, typeFilter)} disabled={loading}>
            <RefreshCw size={13} className={loading ? s.spin : ''}/>
            {loading ? 'Scanning…' : 'Rescan'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className={s.loadWrap}>
          <div className={s.loadBar}><div className={s.loadFill}/></div>
          <p className={s.loadTxt}>Fetching daily candles · Detecting 3-candle FVG patterns · Checking fills…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className={s.errBox}>
          <AlertTriangle size={14}/>
          <span>Scan failed: {error}</span>
          <button onClick={() => scan(scanSize, typeFilter)} className={s.retryBtn}>Retry</button>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary */}
          <div className={s.summaryRow}>
            <div className={s.sumCard} style={{'--c':'var(--green)'}}>
              <span className={s.sumV}>{bulls}</span>
              <span className={s.sumL}>▲ Bullish FVGs</span>
            </div>
            <div className={s.sumCard} style={{'--c':'var(--red)'}}>
              <span className={s.sumV}>{bears}</span>
              <span className={s.sumL}>▼ Bearish FVGs</span>
            </div>
            <div className={s.sumCard} style={{'--c':'#3d8ef0'}}>
              <span className={s.sumV}>{buy}</span>
              <span className={s.sumL}>BUY Signals</span>
            </div>
            <div className={s.sumCard} style={{'--c':'#f5a623'}}>
              <span className={s.sumV}>{sell}</span>
              <span className={s.sumL}>SELL Signals</span>
            </div>
            <div className={s.sumCard} style={{'--c':'var(--t2)'}}>
              <span className={s.sumV}>{data.stocks.filter(s=>s.fvg.recency<=3).length}</span>
              <span className={s.sumL}>Fresh (≤3d old)</span>
            </div>
          </div>

          {/* What is FVG */}
          <div className={s.infoBox}>
            <strong>What is a Fair Value Gap?</strong> A FVG forms when 3 consecutive candles create a price void — the high of candle 1 is lower than the low of candle 3 (bullish), or the low of candle 1 is higher than the high of candle 3 (bearish). Price tends to <em>return to fill</em> these gaps. The chart shows the exact gap zone highlighted on the daily timeframe.
          </div>

          {/* Filters */}
          <div className={s.filters}>
            <div className={s.filterRow}>
              <span className={s.flbl}>Type:</span>
              {[['all','All FVGs'],['bullish','▲ Bullish'],['bearish','▼ Bearish']].map(([v,l]) => (
                <button key={v}
                  className={`${s.fBtn} ${typeFilter===v ? s.fBtnOn : ''}`}
                  style={typeFilter===v ? {
                    color: v==='bullish'?'var(--green)':v==='bearish'?'var(--red)':'var(--blue2)',
                    background: v==='bullish'?'var(--green-bg)':v==='bearish'?'var(--red-bg)':'var(--blue-bg)',
                    borderColor: v==='bullish'?'var(--green-bd)':v==='bearish'?'var(--red-bd)':'var(--blue-bd)',
                  } : {}}
                  onClick={() => setTypeFilter(v)}>{l}</button>
              ))}
            </div>
            <div className={s.filterRow}>
              <span className={s.flbl}>Sector:</span>
              <div className={s.sectScroll}>
                {sectors.map(sec => (
                  <button key={sec}
                    className={`${s.fBtn} ${sector===sec ? s.fBtnOn : ''}`}
                    onClick={() => setSector(sec)}>{sec}</button>
                ))}
              </div>
            </div>
            <div className={s.filterRow}>
              <span className={s.flbl}>Sort:</span>
              {[['recency','Most Recent'],['gap','Gap Size'],['alpha','A–Z']].map(([v,l]) => (
                <button key={v}
                  className={`${s.fBtn} ${sort===v ? s.fBtnOn : ''}`}
                  onClick={() => setSort(v)}>{l}</button>
              ))}
            </div>
          </div>

          <p className={s.countLine}>Showing {filtered.length} stock{filtered.length!==1?'s':''} with active unfilled FVGs</p>

          {/* Cards */}
          {filtered.length === 0
            ? (
              <div className={s.empty}>
                <Activity size={24}/>
                <p>No active FVGs found with current filters.</p>
                <p style={{fontSize:12,marginTop:6,color:'var(--t3)'}}>Try scanning more stocks or changing filters.</p>
              </div>
            ) : (
              <div className={s.grid}>
                {filtered.map(st => <FVGCard key={st.fullSymbol} stock={st}/>)}
              </div>
            )
          }

          <div className={s.disclaimer}>
            <AlertTriangle size={12} style={{flexShrink:0}}/>
            <p>FVG signals are based on price structure patterns. Not all gaps fill — gaps may act as support/resistance instead. Use with proper risk management. Not investment advice.</p>
          </div>
        </>
      )}
    </div>
  )
}

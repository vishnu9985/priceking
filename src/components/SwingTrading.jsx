import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, RefreshCw, Target, Shield,
  Clock, BarChart2, Zap, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, Activity
} from 'lucide-react'
import { fmtPrice, fmtPct, fmtNum } from '../utils/format.js'
import s from './SwingTrading.module.css'

const SCAN_SIZES = [
  { label:'Top 30', value:30 },
  { label:'Top 50', value:50 },
  { label:'Top 80', value:80 },
  { label:'All 163', value:163 },
]

function ScoreBadge({ score, strength }) {
  const color = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--blue2)' : 'var(--amber)'
  return (
    <span className={s.scoreBadge} style={{ background:`${color}18`, border:`1px solid ${color}30`, color }}>
      {score} · {strength}
    </span>
  )
}

function ActionBadge({ action }) {
  const color = action === 'BUY' ? 'var(--green)' : 'var(--amber)'
  const bg    = action === 'BUY' ? 'var(--green-bg)' : 'var(--amber-bg)'
  const bd    = action === 'BUY' ? 'var(--green-bd)' : 'var(--amber-bd)'
  return (
    <span className={s.actionBadge} style={{ background:bg, border:`1px solid ${bd}`, color }}>
      {action}
    </span>
  )
}

function SetupCard({ setup }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={s.card}>
      {/* Card Header */}
      <div className={s.cardTop}>
        <div className={s.cardLeft}>
          <div className={s.symRow}>
            <span className={s.sym}>{setup.symbol}</span>
            <ActionBadge action={setup.action}/>
            <ScoreBadge score={setup.score} strength={setup.strength}/>
          </div>
          <p className={s.cName}>{setup.name}</p>
          <span className={s.sect}>{setup.sector}</span>
        </div>
        <div className={s.cardRight}>
          <span className={s.liveP}>{fmtPrice(setup.livePrice)}</span>
          <div className={s.rrBadge}>
            <Target size={11}/> R/R {setup.riskReward}:1
          </div>
        </div>
      </div>

      {/* Key Trade Levels */}
      <div className={s.levels}>
        <div className={s.level}>
          <span className={s.lvlLabel}>Buy At</span>
          <span className={s.lvlVal} style={{color:'var(--blue2)'}}>{fmtPrice(setup.buyPrice)}</span>
        </div>
        <div className={s.level}>
          <span className={s.lvlLabel}>Stop Loss</span>
          <span className={s.lvlVal} style={{color:'var(--red)'}}>
            {fmtPrice(setup.stopLoss)}
            <small style={{color:'var(--red)',fontSize:'10px'}}> -{setup.stopLossPct}%</small>
          </span>
        </div>
        <div className={s.level}>
          <span className={s.lvlLabel}>Target 1</span>
          <span className={s.lvlVal} style={{color:'var(--green)'}}>
            {fmtPrice(setup.target1)}
            <small style={{color:'var(--green)',fontSize:'10px'}}> +{setup.target1Pct}%</small>
          </span>
        </div>
        <div className={s.level}>
          <span className={s.lvlLabel}>Target 2</span>
          <span className={s.lvlVal} style={{color:'var(--teal)'}}>
            {fmtPrice(setup.target2)}
            <small style={{color:'var(--teal)',fontSize:'10px'}}> +{setup.target2Pct}%</small>
          </span>
        </div>
        <div className={s.level}>
          <span className={s.lvlLabel}><Clock size={10}/> Hold Time</span>
          <span className={s.lvlVal} style={{color:'var(--amber)'}}>{setup.holdingTime}</span>
        </div>
      </div>

      {/* Signals row */}
      <div className={s.signals}>
        {setup.signals.map((sig, i) => (
          <span key={i} className={s.sigPill}><CheckCircle size={9}/>{sig}</span>
        ))}
      </div>

      {/* Expand button */}
      <button className={s.expandBtn} onClick={() => setExpanded(e => !e)}>
        {expanded ? 'Hide details' : 'Why to buy?'}
        {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className={s.expanded}>
          <div className={s.reasons}>
            <p className={s.reasonsTitle}><Zap size={12}/> Reasons to Enter</p>
            {setup.reasons.map((r, i) => (
              <div key={i} className={s.reason}>
                <span className={s.reasonNum}>{i + 1}</span>
                <p className={s.reasonText}>{r}</p>
              </div>
            ))}
          </div>

          <div className={s.techRow}>
            {[
              { label:'RSI',         value: setup.rsi,         color: setup.rsi < 40 ? 'var(--green)' : setup.rsi > 70 ? 'var(--red)' : 'var(--t1)' },
              { label:'MACD',        value: setup.macd,        color: setup.macd === 'Bullish' ? 'var(--green)' : 'var(--red)' },
              { label:'Trend',       value: setup.trend,       color: setup.trend === 'Uptrend' ? 'var(--green)' : 'var(--red)' },
              { label:'Vol Ratio',   value: setup.volumeRatio+'x', color: setup.volumeRatio >= 1.3 ? 'var(--green)' : 'var(--t2)' },
              { label:'ATR',         value: fmtPrice(setup.atr) },
            ].map(t => (
              <div key={t.label} className={s.techItem}>
                <span className={s.techL}>{t.label}</span>
                <span className={s.techV} style={t.color?{color:t.color}:{}}>{t.value}</span>
              </div>
            ))}
          </div>

          <div className={s.riskBox}>
            <AlertTriangle size={12} style={{color:'var(--amber)',flexShrink:0}}/>
            <p className={s.riskText}>
              Risk per share: <strong style={{color:'var(--red)'}}>{fmtPrice(setup.buyPrice - setup.stopLoss)}</strong> ·
              Stop loss is {setup.stopLossPct}% below buy price ·
              Always use a limit order near <strong>{fmtPrice(setup.buyPrice)}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SwingTrading() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [scanSize, setScanSize] = useState(30)
  const [filter,   setFilter]   = useState('All')
  const [sort,     setSort]     = useState('score')

  const scan = useCallback(async (size) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/swing?limit=${size}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { scan(scanSize) }, [scanSize])

  const allSectors = data
    ? ['All', ...Array.from(new Set(data.setups.map(s => s.sector))).sort()]
    : ['All']

  const filtered = data?.setups
    ? data.setups
        .filter(s => filter === 'All' || s.sector === filter)
        .sort((a, b) => {
          if (sort === 'score')  return b.score - a.score
          if (sort === 'rr')     return b.riskReward - a.riskReward
          if (sort === 'target') return b.target1Pct - a.target1Pct
          return 0
        })
    : []

  return (
    <div className={s.wrap}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.hLeft}>
          <div className={s.hIcon}><Activity size={18}/></div>
          <div>
            <h2 className={s.hTitle}>Swing Trade Scanner</h2>
            <p className={s.hSub}>Technical setups · Entry · Stop loss · Target · Holding time</p>
          </div>
        </div>
        <div className={s.hRight}>
          {data && (
            <span className={s.scanMeta}>
              Scanned {data.scanned} stocks · Found {data.found} setups
            </span>
          )}
          <div className={s.scanSizes}>
            {SCAN_SIZES.map(sz => (
              <button
                key={sz.value}
                className={`${s.sizeBtn} ${scanSize === sz.value ? s.sizeBtnOn : ''}`}
                onClick={() => setScanSize(sz.value)}
                disabled={loading}
              >
                {sz.label}
              </button>
            ))}
          </div>
          <button className={s.refreshBtn} onClick={() => scan(scanSize)} disabled={loading}>
            <RefreshCw size={13} className={loading ? s.spin : ''}/>
            {loading ? 'Scanning…' : 'Rescan'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className={s.loadingWrap}>
          <div className={s.loadingBar}>
            <div className={s.loadingFill}/>
          </div>
          <p className={s.loadingText}>
            Analysing {scanSize} stocks — RSI · MACD · EMA · Volume · ATR…
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className={s.errorBox}>
          <AlertTriangle size={16} style={{color:'var(--amber)'}}/>
          <p>Scan failed: {error}</p>
          <button onClick={() => scan(scanSize)} className={s.retryBtn}>Retry</button>
        </div>
      )}

      {/* Results */}
      {!loading && data && (
        <>
          {/* Summary stats */}
          <div className={s.summaryRow}>
            <div className={s.sumCard}>
              <span className={s.sumV} style={{color:'var(--green)'}}>{data.setups.filter(s=>s.action==='BUY').length}</span>
              <span className={s.sumL}>BUY Setups</span>
            </div>
            <div className={s.sumCard}>
              <span className={s.sumV} style={{color:'var(--amber)'}}>{data.setups.filter(s=>s.action==='WATCH').length}</span>
              <span className={s.sumL}>WATCH List</span>
            </div>
            <div className={s.sumCard}>
              <span className={s.sumV} style={{color:'var(--blue2)'}}>
                {data.setups.length ? (data.setups.reduce((a,b)=>a+b.riskReward,0)/data.setups.length).toFixed(1) : '—'}x
              </span>
              <span className={s.sumL}>Avg R/R</span>
            </div>
            <div className={s.sumCard}>
              <span className={s.sumV} style={{color:'var(--teal)'}}>
                {data.setups.length ? (data.setups.reduce((a,b)=>a+b.target1Pct,0)/data.setups.length).toFixed(1) : '—'}%
              </span>
              <span className={s.sumL}>Avg Target</span>
            </div>
            <div className={s.sumCard}>
              <span className={s.sumV} style={{color:'var(--red)'}}>
                {data.setups.length ? (data.setups.reduce((a,b)=>a+b.stopLossPct,0)/data.setups.length).toFixed(1) : '—'}%
              </span>
              <span className={s.sumL}>Avg Stop</span>
            </div>
          </div>

          {/* Filters & Sort */}
          <div className={s.filtersRow}>
            <div className={s.sectorFilter}>
              {allSectors.map(sec => (
                <button
                  key={sec}
                  className={`${s.secBtn} ${sec === filter ? s.secBtnOn : ''}`}
                  onClick={() => setFilter(sec)}
                >
                  {sec}
                  {sec !== 'All' && (
                    <span className={s.secCount}>
                      {data.setups.filter(st => st.sector === sec).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className={s.sortRow}>
              <span className={s.sortLabel}>Sort:</span>
              {[['score','Setup Score'],['rr','Risk/Reward'],['target','Target %']].map(([v,l])=>(
                <button
                  key={v}
                  className={`${s.sortBtn} ${sort===v?s.sortBtnOn:''}`}
                  onClick={() => setSort(v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <p className={s.countLine}>
            Showing {filtered.length} setup{filtered.length !== 1 ? 's' : ''}
            {filter !== 'All' ? ` in ${filter}` : ''}
          </p>

          {/* Cards */}
          {filtered.length === 0 ? (
            <div className={s.noSetups}>
              <BarChart2 size={24}/>
              <p>No swing setups found in {filter} right now.</p>
              <p>Try a broader scan or different sector.</p>
            </div>
          ) : (
            <div className={s.grid}>
              {filtered.map(setup => (
                <SetupCard key={setup.fullSymbol} setup={setup}/>
              ))}
            </div>
          )}

          {/* Disclaimer */}
          <div className={s.disclaimer}>
            <AlertTriangle size={12}/>
            <p>
              Swing trade setups are generated using technical indicators (RSI, MACD, EMA crossover, ATR).
              These are for educational purposes only — not financial advice.
              Always verify with your own research and use proper position sizing.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

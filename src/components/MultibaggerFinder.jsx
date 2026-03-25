import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertTriangle, ChevronDown, ChevronUp,
         Zap, Star, Shield, Target, BarChart2, Rocket,
         Award, Users, DollarSign, Globe, Clock } from 'lucide-react'
import { fmtPrice, fmtNum } from '../utils/format.js'
import s from './MultibaggerFinder.module.css'

const SCAN_SIZES = [
  { label:'Top 30',  value:30  },
  { label:'Top 50',  value:50  },
  { label:'Top 80',  value:80  },
  { label:'All 163', value:163 },
]

const POT_CFG = {
  '10x Potential': { color:'#ff6b35', glow:'rgba(255,107,53,.15)', emoji:'🔥' },
  '5x Potential':  { color:'#a78bfa', glow:'rgba(167,139,250,.15)', emoji:'⚡' },
  '3x Potential':  { color:'#3d8ef0', glow:'rgba(61,142,240,.15)',  emoji:'🚀' },
  '2x Potential':  { color:'#2ecc8a', glow:'rgba(46,204,138,.15)',  emoji:'📈' },
  'Watchlist':     { color:'#8891b0', glow:'rgba(136,145,176,.10)', emoji:'👁'  },
}

const CONV_CLR = {
  'Exceptional':'#ff6b35','Strong':'#a78bfa','Good':'#3d8ef0','Moderate':'#2ecc8a','Weak':'#8891b0'
}

const CAT_COLOR = {
  'Growth Engine':        '#2ecc8a',
  'Business Quality':     '#3d8ef0',
  'Management Excellence':'#f5a623',
  'Competitive Moat':     '#a78bfa',
  'Financial Strength':   '#20c9c9',
  'Valuation Edge':       '#ff6b35',
  'Sector Tailwind':      '#4ade80',
  'Growth Runway':        '#f0a030',
}

const CAT_ICON = {
  'Growth Engine':        '📈',
  'Business Quality':     '🏆',
  'Management Excellence':'👔',
  'Competitive Moat':     '🛡️',
  'Financial Strength':   '💵',
  'Valuation Edge':       '🎯',
  'Sector Tailwind':      '🌏',
  'Growth Runway':        '🚀',
}

function ScoreBar({ score }) {
  const pct   = Math.min(100, (score / 150) * 100)
  const color = pct >= 75 ? '#ff6b35' : pct >= 55 ? '#a78bfa' : pct >= 38 ? '#3d8ef0' : '#2ecc8a'
  return (
    <div className={s.sBarWrap}>
      <div className={s.sBarTrack}>
        <div className={s.sBarFill} style={{ width:pct+'%', background:color }}/>
      </div>
      <span className={s.sBarNum} style={{ color }}>{score}</span>
    </div>
  )
}

function MBCard({ stock }) {
  const [open, setOpen] = useState(false)
  const cfg      = POT_CFG[stock.potential] || POT_CFG['Watchlist']
  const convClr  = CONV_CLR[stock.conviction] || '#8891b0'
  const catalysts= (stock.catalysts || stock.factors || []).slice(0, 3)
  const allFacs  = (stock.factors || []).sort((a,b) => b.score - a.score)

  return (
    <div className={s.card} style={{ '--glow':cfg.glow, '--acc':cfg.color }}>
      <div className={s.topBar} style={{ background:`linear-gradient(90deg,${cfg.color},transparent)` }}/>

      <div className={s.inner}>
        {/* Header */}
        <div className={s.head}>
          <div className={s.hl}>
            <div className={s.symRow}>
              <span className={s.sym}>{stock.symbol}</span>
              <span className={s.potBadge} style={{
                background:cfg.glow, border:`1px solid ${cfg.color}40`, color:cfg.color
              }}>
                {cfg.emoji} {stock.potential}
              </span>
            </div>
            <p className={s.cname}>{stock.name}</p>
            <span className={s.sect}>{stock.sector}</span>
          </div>
          <div className={s.hr}>
            <span className={s.price}>{fmtPrice(stock.price)}</span>
            <span className={s.conv} style={{ color:convClr }}>{stock.conviction} Conviction</span>
            <ScoreBar score={stock.totalScore}/>
          </div>
        </div>

        {/* Multiplier targets */}
        <div className={s.targets}>
          {[
            { l:'Current',   v:stock.price,              c:'var(--t2)',    tag:null   },
            { l:'Fair Value',v:stock.targets?.fair,      c:'var(--blue2)', tag:'DCF'  },
            { l:'2× Target', v:stock.targets?.target2x,  c:'var(--green)', tag:'2×'   },
            { l:'3× Target', v:stock.targets?.target3x,  c:'var(--purple)',tag:'3×'   },
            { l:'5× Target', v:stock.targets?.target5x,  c:'#ff6b35',      tag:'5×'   },
          ].map(t => (
            <div key={t.l} className={s.tCard}>
              {t.tag && (
                <span className={s.tTag} style={{ color:t.c, background:`${t.c}18`, border:`1px solid ${t.c}30` }}>
                  {t.tag}
                </span>
              )}
              <span className={s.tPrice} style={{ color:t.c }}>{fmtPrice(t.v)}</span>
              <span className={s.tLabel}>{t.l}</span>
            </div>
          ))}
          <div className={s.tCard}>
            <Clock size={13} style={{ color:'var(--amber)', marginBottom:2 }}/>
            <span className={s.tPrice} style={{ color:'var(--amber)', fontSize:11 }}>{stock.timeframe}</span>
            <span className={s.tLabel}>Timeframe</span>
          </div>
        </div>

        {/* Top catalysts */}
        <div className={s.cats}>
          <p className={s.catsHdr}><Zap size={11}/> Top Reasons</p>
          {catalysts.map((f, i) => (
            <div key={i} className={s.cat}>
              <div className={s.catDot} style={{ background:CAT_COLOR[f.category]||'#888' }}/>
              <div className={s.catBody}>
                <div className={s.catRow}>
                  <span className={s.catIcon}>{CAT_ICON[f.category]||'•'}</span>
                  <span className={s.catTitle}>{f.title}</span>
                  <span className={s.catScore} style={{ color:CAT_COLOR[f.category]||'var(--t2)' }}>+{f.score}</span>
                  <span className={s.catW} data-w={f.weight}>{f.weight}</span>
                </div>
                <p className={s.catReason}>{f.reason}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Expand */}
        <button className={s.expBtn} style={{ color:cfg.color }} onClick={() => setOpen(o => !o)}>
          {open ? 'Hide full analysis' : `All ${allFacs.length} factors + metrics + risks`}
          {open ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
        </button>

        {/* Expanded content */}
        {open && (
          <div className={s.exp}>

            {/* All factors */}
            <div className={s.secBox}>
              <p className={s.secHdr}><Star size={11}/> All {allFacs.length} Multibagger Factors</p>
              {allFacs.map((f, i) => (
                <div key={i} className={s.fac}>
                  <div className={s.facHead}>
                    <span className={s.facCat} style={{
                      color: CAT_COLOR[f.category]||'var(--t2)',
                      background:`${CAT_COLOR[f.category]||'#888'}18`,
                      border:`1px solid ${CAT_COLOR[f.category]||'#888'}28`
                    }}>
                      {CAT_ICON[f.category]||'•'} {f.category}
                    </span>
                    <span className={s.facTitle}>{f.title}</span>
                    <span className={s.facScore} style={{ color:CAT_COLOR[f.category]||'var(--t2)' }}>+{f.score}</span>
                    <span className={s.catW} data-w={f.weight}>{f.weight}</span>
                  </div>
                  <p className={s.facReason}>{f.reason}</p>
                </div>
              ))}
            </div>

            {/* Metrics */}
            <div className={s.secBox}>
              <p className={s.secHdr}><BarChart2 size={11}/> Key Metrics</p>
              <div className={s.metGrid}>
                {[
                  { l:'ROE',        v: stock.metrics?.roe    != null ? fmtNum(stock.metrics.roe,1)+'%'    : '—', hi: stock.metrics?.roe>15      },
                  { l:'Rev CAGR',   v: stock.metrics?.revCAGR!= null ? fmtNum(stock.metrics.revCAGR,1)+'%': '—', hi: stock.metrics?.revCAGR>12   },
                  { l:'Profit CAGR',v: stock.metrics?.profCAGR!=null ? fmtNum(stock.metrics.profCAGR,1)+'%':'—', hi: stock.metrics?.profCAGR>15  },
                  { l:'Net Margin', v: stock.metrics?.nm     != null ? fmtNum(stock.metrics.nm,1)+'%'     : '—', hi: stock.metrics?.nm>12        },
                  { l:'Op Margin',  v: stock.metrics?.om     != null ? fmtNum(stock.metrics.om,1)+'%'     : '—', hi: stock.metrics?.om>18        },
                  { l:'D/E Ratio',  v: stock.metrics?.de     != null ? fmtNum(stock.metrics.de,2)         : '—', hi: stock.metrics?.de<0.5       },
                  { l:'P/E',        v: stock.metrics?.pe     != null ? fmtNum(stock.metrics.pe,1)         : '—', hi: false },
                  { l:'Fwd P/E',    v: stock.metrics?.fpe    != null ? fmtNum(stock.metrics.fpe,1)        : '—', hi: false },
                  { l:'P/B',        v: stock.metrics?.pb     != null ? fmtNum(stock.metrics.pb,2)         : '—', hi: false },
                  { l:'FCF',        v: stock.metrics?.fcf    || '—',                                               hi: stock.metrics?.fcf==='Positive' },
                  { l:'Promoter',   v: stock.metrics?.ph     != null ? fmtNum(stock.metrics.ph,1)+'%'     : '—', hi: stock.metrics?.ph>50        },
                  { l:'Beta',       v: stock.metrics?.beta   != null ? fmtNum(stock.metrics.beta,2)       : '—', hi: false },
                ].map(m => (
                  <div key={m.l} className={s.metCard}>
                    <span className={s.metL}>{m.l}</span>
                    <span className={s.metV} style={m.hi ? { color:'var(--green)' } : {}}>{m.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risks */}
            {(stock.risks||[]).length > 0 && (
              <div className={s.secBox}>
                <p className={s.secHdr}><AlertTriangle size={11}/> Risks to Monitor</p>
                {stock.risks.map((r, i) => (
                  <div key={i} className={s.risk} data-sev={r.severity}>
                    <span className={s.riskDot} data-sev={r.severity}/>
                    <p className={s.riskTxt}>{r.text}</p>
                    <span className={s.riskBadge} data-sev={r.severity}>{r.severity}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Price journey */}
            <div className={s.secBox}>
              <p className={s.secHdr}><Target size={11}/> Price Journey</p>
              <div className={s.journey}>
                {[
                  { l:'Current',    p:stock.price,              pct:0,   c:'var(--t2)'  },
                  { l:'Fair Value', p:stock.targets?.fair,      pct:+(stock.upside||0).toFixed(0), c:'var(--blue2)' },
                  { l:'2× Target',  p:stock.targets?.target2x,  pct:100, c:'var(--green)' },
                  { l:'3× Target',  p:stock.targets?.target3x,  pct:200, c:'var(--purple)'},
                  { l:'5× Target',  p:stock.targets?.target5x,  pct:400, c:'#ff6b35'    },
                ].map(t => (
                  <div key={t.l} className={s.jItem}>
                    <span className={s.jL}>{t.l}</span>
                    <span className={s.jP} style={{ color:t.c }}>{fmtPrice(t.p)}</span>
                    <span className={s.jPct} style={{ color:t.c }}>{t.pct > 0 ? '+'+t.pct+'%' : 'Entry'}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}

export default function MultibaggerFinder() {
  const [data,   setData]   = useState(null)
  const [loading,setLoading]= useState(false)
  const [error,  setError]  = useState(null)
  const [sz,     setSz]     = useState(40)
  const [pot,    setPot]    = useState('All')
  const [sector, setSector] = useState('All')
  const [sort,   setSort]   = useState('score')

  const scan = useCallback(async (size) => {
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/multibagger?limit=${size}&min=30`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setData(await r.json())
    } catch(e) { setError(e.message) }
    finally    { setLoading(false)   }
  }, [])

  useEffect(() => { scan(sz) }, [sz])

  const sectors  = data ? ['All', ...Array.from(new Set(data.stocks.map(s=>s.sector))).sort()] : ['All']
  const potOpts  = ['All','10x Potential','5x Potential','3x Potential','2x Potential','Watchlist']

  const filtered = (data?.stocks || [])
    .filter(s => sector === 'All' || s.sector === sector)
    .filter(s => pot    === 'All' || s.potential === pot)
    .sort((a, b) => {
      if (sort==='score')  return b.totalScore - a.totalScore
      if (sort==='upside') return (b.upside||0) - (a.upside||0)
      if (sort==='roe')    return (b.metrics?.roe||0) - (a.metrics?.roe||0)
      if (sort==='pe')     return (a.metrics?.pe||999) - (b.metrics?.pe||999)
      return 0
    })

  const count10x = (data?.stocks||[]).filter(s=>s.potential==='10x Potential').length
  const count5x  = (data?.stocks||[]).filter(s=>s.potential==='5x Potential').length
  const count3x  = (data?.stocks||[]).filter(s=>s.potential==='3x Potential').length
  const count2x  = (data?.stocks||[]).filter(s=>s.potential==='2x Potential').length
  const avgScore = data?.stocks?.length
    ? Math.round(data.stocks.reduce((a,b)=>a+b.totalScore,0)/data.stocks.length) : 0

  return (
    <div className={s.wrap}>

      {/* Header */}
      <div className={s.header}>
        <div className={s.hL}>
          <div className={s.hIcon}><Rocket size={20}/></div>
          <div>
            <h2 className={s.hTitle}>Multibagger Finder</h2>
            <p className={s.hSub}>2×–10× potential · Fundamentals · Management · Moat · Sector tailwinds · Growth runway</p>
          </div>
        </div>
        <div className={s.hR}>
          {data && <span className={s.meta}>Scanned {data.scanned} · Found {data.found}</span>}
          <div className={s.szRow}>
            {SCAN_SIZES.map(b => (
              <button key={b.value}
                className={`${s.szBtn} ${sz===b.value?s.szOn:''}`}
                onClick={() => setSz(b.value)} disabled={loading}>
                {b.label}
              </button>
            ))}
          </div>
          <button className={s.refreshBtn} onClick={() => scan(sz)} disabled={loading}>
            <RefreshCw size={13} className={loading?s.spin:''}/>
            {loading ? 'Scanning…' : 'Rescan'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className={s.loadWrap}>
          <div className={s.loadBar}><div className={s.loadFill}/></div>
          <p className={s.loadTxt}>Scanning ROE · FCF · Promoter stake · Moat · Valuation · Sector tailwind…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className={s.errBox}>
          <AlertTriangle size={14}/>
          <span>{error}</span>
          <button onClick={() => scan(sz)} className={s.retryBtn}>Retry</button>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary tiles */}
          <div className={s.sumRow}>
            {[
              { v:count10x, l:'🔥 10x Potential', c:'#ff6b35' },
              { v:count5x,  l:'⚡ 5x Potential',  c:'#a78bfa' },
              { v:count3x,  l:'🚀 3x Potential',  c:'#3d8ef0' },
              { v:count2x,  l:'📈 2x Potential',  c:'#2ecc8a' },
              { v:avgScore, l:'💯 Avg Score',      c:'var(--teal)' },
            ].map(t => (
              <div key={t.l} className={s.sumTile} style={{'--tc':t.c}}>
                <span className={s.sumV}>{t.v}</span>
                <span className={s.sumL}>{t.l}</span>
              </div>
            ))}
          </div>

          {/* Score guide */}
          <div className={s.guide}>
            <span className={s.guideL}>Score:</span>
            {[{r:'110+',l:'10×',c:'#ff6b35'},{r:'85–109',l:'5×',c:'#a78bfa'},{r:'65–84',l:'3×',c:'#3d8ef0'},{r:'45–64',l:'2×',c:'#2ecc8a'}].map(g=>(
              <span key={g.r} className={s.guideItem} style={{color:g.c}}><strong>{g.r}</strong> = {g.l}</span>
            ))}
          </div>

          {/* Filters */}
          <div className={s.filters}>
            <div className={s.fRow}>
              <span className={s.fL}>Potential:</span>
              {potOpts.map(p => {
                const cfg = POT_CFG[p]
                return (
                  <button key={p}
                    className={`${s.fBtn} ${pot===p?s.fOn:''}`}
                    style={pot===p&&p!=='All'?{color:cfg?.color,background:cfg?.glow,borderColor:`${cfg?.color}40`}:{}}
                    onClick={() => setPot(p)}>
                    {cfg?.emoji} {p}
                    {p!=='All' && <span className={s.fCnt}>{(data.stocks||[]).filter(st=>st.potential===p).length}</span>}
                  </button>
                )
              })}
            </div>
            <div className={s.fRow}>
              <span className={s.fL}>Sector:</span>
              <div className={s.fScroll}>
                {sectors.map(sec => (
                  <button key={sec}
                    className={`${s.fBtn} ${sector===sec?s.fOn:''}`}
                    onClick={() => setSector(sec)}>{sec}</button>
                ))}
              </div>
            </div>
            <div className={s.fRow}>
              <span className={s.fL}>Sort:</span>
              {[['score','Score'],['upside','Upside%'],['roe','ROE'],['pe','P/E (low)']].map(([v,l]) => (
                <button key={v} className={`${s.fBtn} ${sort===v?s.fOn:''}`} onClick={() => setSort(v)}>{l}</button>
              ))}
            </div>
          </div>

          <p className={s.cnt}>Showing {filtered.length} candidate{filtered.length!==1?'s':''}</p>

          {filtered.length === 0
            ? <div className={s.empty}><Rocket size={24}/><p>No stocks match filters.</p></div>
            : <div className={s.grid}>{filtered.map(st => <MBCard key={st.fullSymbol||st.symbol} stock={st}/>)}</div>
          }

          <div className={s.disc}>
            <AlertTriangle size={11} style={{flexShrink:0}}/>
            <p>Multibagger scores are quantitative estimates. Past performance does not guarantee future returns. Stocks may take 3–7 years to realise potential. Not investment advice — consult a SEBI-registered advisor.</p>
          </div>
        </>
      )}
    </div>
  )
}

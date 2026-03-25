import React, { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, RefreshCw, Shield, Target, Zap,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle,
  Clock, BarChart2, Star, BookOpen, Activity, DollarSign
} from 'lucide-react'
import { fmtPrice, fmtINR, fmtNum, fmtPct } from '../utils/format.js'
import s from './LongTermInvesting.module.css'

const SCAN_SIZES = [
  { label:'Top 30', value:30 },
  { label:'Top 50', value:50 },
  { label:'Top 80', value:80 },
  { label:'All 163',value:163 },
]

const GRADE_COLOR = {
  A:'var(--green)', B:'var(--blue2)', C:'var(--amber)', D:'var(--red)', F:'var(--red)', 'N/A':'var(--t3)'
}

const CONVICTION_COLOR = {
  'Strong Buy':'var(--green)', 'Buy':'var(--blue2)',
  'Accumulate':'var(--teal)', 'Watch':'var(--amber)', 'Avoid':'var(--red)'
}

const ENTRY_COLOR = (t) =>
  t.includes('Undervalued') ? 'var(--green)' :
  t.includes('Fair')        ? 'var(--blue2)' :
  t.includes('Slightly')    ? 'var(--amber)' : 'var(--red)'

const REASON_CAT_COLOR = {
  'Quality':'var(--blue2)', 'Safety':'var(--green)', 'Valuation':'var(--purple)',
  'Management':'var(--amber)', 'Compounding':'var(--teal)', 'India Macro':'var(--t2)'
}

function GradeChip({ g }) {
  return (
    <span className={s.gradeChip} style={{ color: GRADE_COLOR[g], background:`${GRADE_COLOR[g]}18`, border:`1px solid ${GRADE_COLOR[g]}30` }}>
      {g}
    </span>
  )
}

function ScoreRing({ score, label, size = 56 }) {
  const r   = (size / 2) - 5
  const circ= 2 * Math.PI * r
  const dash= (score / 100) * circ
  const color = score >= 70 ? 'var(--green)' : score >= 50 ? 'var(--blue2)' : score >= 35 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className={s.ring} style={{ width:size, height:size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg3)" strokeWidth="4"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}/>
      </svg>
      <div className={s.ringInner}>
        <span className={s.ringScore} style={{ color }}>{score}</span>
        <span className={s.ringLabel}>{label}</span>
      </div>
    </div>
  )
}

function SWOTQuadrant({ title, items, color, bg, Icon }) {
  return (
    <div className={s.swotQ} style={{ borderColor: color, background: bg }}>
      <div className={s.swotQHead} style={{ color }}>
        <Icon size={12}/>{title}
      </div>
      {items.length === 0
        ? <p className={s.swotEmpty}>No significant items identified</p>
        : items.map((item, i) => (
          <div key={i} className={s.swotItem}>
            <span className={s.swotDot} style={{ background: color }}/>
            <p className={s.swotText}>{item}</p>
          </div>
        ))
      }
    </div>
  )
}

function LTCard({ stock }) {
  const [expanded, setExpanded] = useState(false)
  const { lt, valuation, metrics, swot, reasons } = stock

  return (
    <div className={s.card}>
      {/* Top strip */}
      <div className={s.cardStrip} style={{ background: CONVICTION_COLOR[lt.conviction] }}/>

      <div className={s.cardBody}>
        {/* Header row */}
        <div className={s.cardHead}>
          <div className={s.cardLeft}>
            <div className={s.symRow}>
              <span className={s.sym}>{stock.symbol}</span>
              <span className={s.convBadge} style={{
                color: CONVICTION_COLOR[lt.conviction],
                background:`${CONVICTION_COLOR[lt.conviction]}18`,
                border:`1px solid ${CONVICTION_COLOR[lt.conviction]}30`
              }}>
                {lt.conviction}
              </span>
            </div>
            <p className={s.cName}>{stock.name}</p>
            <span className={s.sect}>{stock.sector}</span>
          </div>
          <div className={s.scoreRow}>
            <ScoreRing score={lt.totalScore} label="Total" size={54}/>
            <ScoreRing score={lt.fundScore}  label="Funds"  size={46}/>
            <ScoreRing score={lt.valScore}   label="Value"  size={46}/>
          </div>
        </div>

        {/* Entry zone */}
        <div className={s.entryZone} style={{
          background: `${ENTRY_COLOR(lt.entryType)}12`,
          border: `1px solid ${ENTRY_COLOR(lt.entryType)}30`
        }}>
          <div className={s.ezLeft}>
            <Target size={13} style={{ color: ENTRY_COLOR(lt.entryType), flexShrink:0 }}/>
            <div>
              <p className={s.ezType} style={{ color: ENTRY_COLOR(lt.entryType) }}>{lt.entryType}</p>
              <p className={s.ezTime}><Clock size={10}/> Ideal horizon: {lt.horizon}</p>
            </div>
          </div>
          <div className={s.ezRight}>
            <div className={s.ezStat}>
              <span className={s.ezStatL}>Current Price</span>
              <span className={s.ezStatV}>{fmtPrice(stock.price)}</span>
            </div>
            <div className={s.ezStat}>
              <span className={s.ezStatL}>Fair Value</span>
              <span className={s.ezStatV} style={{color:'var(--blue2)'}}>{fmtPrice(valuation?.fairValue)}</span>
            </div>
            <div className={s.ezStat}>
              <span className={s.ezStatL}>Upside</span>
              <span className={s.ezStatV} style={{color:(valuation?.upsidePct||0)>=0?'var(--green)':'var(--red)'}}>
                {fmtPct(valuation?.upsidePct)}
              </span>
            </div>
            <div className={s.ezStat}>
              <span className={s.ezStatL}>Best Buy ≤</span>
              <span className={s.ezStatV} style={{color:'var(--green)'}}>{fmtPrice(valuation?.bestBuyPrice)}</span>
            </div>
          </div>
        </div>

        {/* Metric grades */}
        <div className={s.gradesGrid}>
          {[
            { label:'ROE',       g: lt.grades?.roe?.grade,       val: metrics.roe != null ? metrics.roe+'%' : '—'   },
            { label:'Debt/Eq',   g: lt.grades?.debtEq?.grade,    val: metrics.de  != null ? metrics.de+''  : '—'   },
            { label:'Net Margin',g: lt.grades?.netMargin?.grade,  val: metrics.nm  != null ? metrics.nm+'%' : '—'   },
            { label:'Liquidity', g: lt.grades?.liquidity?.grade,  val: metrics.pe  != null ? 'P/E '+fmtNum(metrics.pe,1) : '—' },
            { label:'P/E',       g: lt.valGrades?.peVsBench?.grade, val: metrics.pe != null ? fmtNum(metrics.pe,1) : '—' },
            { label:'P/B',       g: lt.valGrades?.pbVsBench?.grade, val: metrics.pb != null ? fmtNum(metrics.pb,2) : '—' },
            { label:'Upside',    g: lt.valGrades?.upside?.grade,  val: fmtPct(valuation?.upsidePct)                },
            { label:'Div Yield', g: metrics.divYield > 2 ? 'A' : metrics.divYield > 1 ? 'B' : 'C',
              val: metrics.divYield != null ? metrics.divYield+'%' : '—' },
          ].map(m => (
            <div key={m.label} className={s.gradeItem}>
              <span className={s.gradeLbl}>{m.label}</span>
              <span className={s.gradeVal}>{m.val}</span>
              <GradeChip g={m.g || 'N/A'}/>
            </div>
          ))}
        </div>

        {/* Quick reasons */}
        <div className={s.quickReasons}>
          {(reasons||[]).slice(0,3).map((r,i) => (
            <div key={i} className={s.qrItem}>
              <span className={s.qrCat} style={{color: REASON_CAT_COLOR[r.category]||'var(--t2)'}}>{r.category}</span>
              <p className={s.qrText}>{r.text}</p>
            </div>
          ))}
        </div>

        {/* Expand */}
        <button className={s.expandBtn} onClick={() => setExpanded(e=>!e)}>
          {expanded ? 'Hide full analysis' : 'Full Analysis — SWOT + All Reasons'}
          {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
        </button>

        {/* Expanded: SWOT + full reasons */}
        {expanded && (
          <div className={s.expanded}>
            {/* Targets */}
            <div className={s.targetsRow}>
              {[
                { label:'Best Buy Price',  val: fmtPrice(valuation?.bestBuyPrice), color:'var(--green)',  note:'Margin of safety entry' },
                { label:'Fair Value',      val: fmtPrice(valuation?.fairValue),    color:'var(--blue2)',  note:'Intrinsic value estimate' },
                { label:'1-Year Target',   val: fmtPrice(valuation?.target1Y),     color:'var(--purple)', note:'Conservative 1Y upside'  },
                { label:'3-Year Target',   val: fmtPrice(valuation?.target2Y),     color:'var(--teal)',   note:'Long-term compounding'    },
              ].map(t => (
                <div key={t.label} className={s.tCard}>
                  <span className={s.tLabel}>{t.label}</span>
                  <span className={s.tVal} style={{color:t.color}}>{t.val}</span>
                  <span className={s.tNote}>{t.note}</span>
                </div>
              ))}
            </div>

            {/* All reasons */}
            <div className={s.allReasons}>
              <p className={s.secHdr}><Zap size={12}/> Why Invest Long-Term</p>
              {(reasons||[]).map((r,i) => (
                <div key={i} className={s.reason}>
                  <span className={s.reasonN}>{i+1}</span>
                  <div>
                    <span className={s.reasonCat} style={{color: REASON_CAT_COLOR[r.category]||'var(--t2)'}}>{r.category}</span>
                    <p className={s.reasonTxt}>{r.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* SWOT */}
            {swot && (
              <div className={s.swot}>
                <p className={s.secHdr}><BookOpen size={12}/> SWOT Analysis</p>
                <div className={s.swotGrid}>
                  <SWOTQuadrant title="Strengths"     items={swot.strengths}     color="var(--green)"  bg="rgba(46,204,138,.05)"  Icon={CheckCircle}  />
                  <SWOTQuadrant title="Weaknesses"    items={swot.weaknesses}    color="var(--red)"    bg="rgba(240,79,90,.05)"   Icon={AlertTriangle}/>
                  <SWOTQuadrant title="Opportunities" items={swot.opportunities} color="var(--blue2)"  bg="rgba(61,142,240,.05)"  Icon={TrendingUp}   />
                  <SWOTQuadrant title="Threats"       items={swot.threats}       color="var(--amber)"  bg="rgba(245,166,35,.05)"  Icon={Shield}       />
                </div>
              </div>
            )}

            {/* DCF breakdown */}
            {valuation && (
              <div className={s.dcfBox}>
                <p className={s.secHdr}><DollarSign size={12}/> Valuation Model</p>
                <div className={s.dcfGrid}>
                  {[
                    { label:'DCF Intrinsic',  val: fmtPrice(valuation.dcfValue),      note:'Discounted cash flow (CAPM rate: '+fmtNum(valuation.discountRate,1)+'%)' },
                    { label:'Relative Value', val: fmtPrice(valuation.relativeValue),  note:'Sector P/E & P/B benchmark' },
                    { label:'Blended Fair',   val: fmtPrice(valuation.fairValue),      note:'55% DCF + 45% Relative'     },
                    { label:'Margin of Safety',val:fmtPct(valuation.marginOfSafety),  note:'Gap between price & fair value' },
                  ].map(d => (
                    <div key={d.label} className={s.dcfItem}>
                      <span className={s.dcfL}>{d.label}</span>
                      <span className={s.dcfV}>{d.val}</span>
                      <span className={s.dcfN}>{d.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LongTermInvesting() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [scanSize,setScanSize]= useState(30)
  const [filter,  setFilter]  = useState('All')
  const [conviction, setConv] = useState('All')
  const [sort,    setSort]    = useState('total')

  const scan = useCallback(async (size) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/longterm?limit=${size}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) { setError(e.message) }
    finally     { setLoading(false) }
  }, [])

  useEffect(() => { scan(scanSize) }, [scanSize])

  const allSectors    = data ? ['All', ...Array.from(new Set(data.stocks.map(s=>s.sector))).sort()] : ['All']
  const allConvictions= ['All','Strong Buy','Buy','Accumulate','Watch']

  const filtered = data?.stocks
    ? data.stocks
        .filter(s => filter === 'All' || s.sector === s.sector && s.sector === filter)
        .filter(s => conviction === 'All' || s.lt.conviction === conviction)
        .sort((a,b) => {
          if (sort==='total')  return b.lt.totalScore  - a.lt.totalScore
          if (sort==='fund')   return b.lt.fundScore   - a.lt.fundScore
          if (sort==='value')  return b.lt.valScore    - a.lt.valScore
          if (sort==='upside') return (b.valuation?.upsidePct||0) - (a.valuation?.upsidePct||0)
          return 0
        })
    : []

  const buyStocks     = data?.stocks.filter(s=>['Strong Buy','Buy'].includes(s.lt.conviction)) || []
  const avgScore      = data?.stocks.length ? Math.round(data.stocks.reduce((a,b)=>a+b.lt.totalScore,0)/data.stocks.length) : 0
  const undervalued   = data?.stocks.filter(s=>(s.valuation?.upsidePct||0)>=15).length || 0

  return (
    <div className={s.wrap}>
      {/* Header */}
      <div className={s.header}>
        <div className={s.hLeft}>
          <div className={s.hIcon}><Star size={20}/></div>
          <div>
            <h2 className={s.hTitle}>Long-Term Investing Scanner</h2>
            <p className={s.hSub}>Strong fundamentals · Cheap/fair valuation · SWOT analysis · Buy reasons · Holding horizon</p>
          </div>
        </div>
        <div className={s.hRight}>
          {data && <span className={s.scanMeta}>Scanned {data.scanned} · Found {data.found} candidates</span>}
          <div className={s.scanSizes}>
            {SCAN_SIZES.map(sz=>(
              <button key={sz.value}
                className={`${s.sizeBtn} ${scanSize===sz.value?s.sizeBtnOn:''}`}
                onClick={()=>setScanSize(sz.value)} disabled={loading}>
                {sz.label}
              </button>
            ))}
          </div>
          <button className={s.refreshBtn} onClick={()=>scan(scanSize)} disabled={loading}>
            <RefreshCw size={13} className={loading?s.spin:''}/>
            {loading?'Scanning…':'Rescan'}
          </button>
        </div>
      </div>

      {/* Loading bar */}
      {loading && (
        <div className={s.loadWrap}>
          <div className={s.loadBar}><div className={s.loadFill}/></div>
          <p className={s.loadTxt}>Analysing {scanSize} stocks — Fundamentals · DCF · SWOT · Valuation…</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className={s.errBox}>
          <AlertTriangle size={14} style={{color:'var(--amber)'}}/>
          <p>Scan failed: {error}</p>
          <button onClick={()=>scan(scanSize)} className={s.retryBtn}>Retry</button>
        </div>
      )}

      {/* Results */}
      {!loading && data && (
        <>
          {/* Summary */}
          <div className={s.summaryRow}>
            <div className={s.sumCard}>
              <span className={s.sumV} style={{color:'var(--green)'}}>{buyStocks.length}</span>
              <span className={s.sumL}>BUY Signals</span>
            </div>
            <div className={s.sumCard}>
              <span className={s.sumV} style={{color:'var(--blue2)'}}>{undervalued}</span>
              <span className={s.sumL}>Undervalued</span>
            </div>
            <div className={s.sumCard}>
              <span className={s.sumV} style={{color:'var(--teal)'}}>{avgScore}</span>
              <span className={s.sumL}>Avg Score</span>
            </div>
            <div className={s.sumCard}>
              <span className={s.sumV} style={{color:'var(--amber)'}}>{data.found}</span>
              <span className={s.sumL}>Candidates</span>
            </div>
            <div className={s.sumCard}>
              <span className={s.sumV} style={{color:'var(--purple)'}}>
                {data.stocks.length ? fmtNum(data.stocks.reduce((a,b)=>a+(b.valuation?.upsidePct||0),0)/data.stocks.length,1) : '—'}%
              </span>
              <span className={s.sumL}>Avg Upside</span>
            </div>
          </div>

          {/* Grade legend */}
          <div className={s.gradeLegend}>
            <span className={s.glegLbl}>Grades:</span>
            {[['A','Excellent'],['B','Good'],['C','Average'],['D','Weak'],['F','Poor']].map(([g,l])=>(
              <span key={g} className={s.glegItem} style={{color:GRADE_COLOR[g]}}>
                <strong>{g}</strong> {l}
              </span>
            ))}
          </div>

          {/* Filters */}
          <div className={s.filtersWrap}>
            <div className={s.filterRow}>
              <span className={s.filterLbl}>Conviction:</span>
              {allConvictions.map(c=>(
                <button key={c}
                  className={`${s.fBtn} ${conviction===c?s.fBtnOn:''}`}
                  onClick={()=>setConv(c)}
                  style={conviction===c && c!=='All'?{color:CONVICTION_COLOR[c],background:`${CONVICTION_COLOR[c]}18`,border:`1px solid ${CONVICTION_COLOR[c]}30`}:{}}
                >
                  {c}
                  {c!=='All' && <span className={s.fCount}>{data.stocks.filter(s=>s.lt.conviction===c).length}</span>}
                </button>
              ))}
            </div>
            <div className={s.filterRow}>
              <span className={s.filterLbl}>Sector:</span>
              <div className={s.sectorScroll}>
                {allSectors.map(sec=>(
                  <button key={sec}
                    className={`${s.fBtn} ${filter===sec?s.fBtnOn:''}`}
                    onClick={()=>setFilter(sec)}
                  >{sec}</button>
                ))}
              </div>
            </div>
            <div className={s.filterRow}>
              <span className={s.filterLbl}>Sort by:</span>
              {[['total','Overall'],['fund','Fundamentals'],['value','Valuation'],['upside','Upside %']].map(([v,l])=>(
                <button key={v}
                  className={`${s.fBtn} ${sort===v?s.fBtnOn:''}`}
                  onClick={()=>setSort(v)}
                >{l}</button>
              ))}
            </div>
          </div>

          <p className={s.countLine}>Showing {filtered.length} stock{filtered.length!==1?'s':''}</p>

          {/* Cards */}
          {filtered.length===0
            ? <div className={s.empty}><BarChart2 size={24}/><p>No long-term candidates match your filters.</p></div>
            : <div className={s.grid}>{filtered.map(st=><LTCard key={st.fullSymbol} stock={st}/>)}</div>
          }

          {/* Disclaimer */}
          <div className={s.disclaimer}>
            <AlertTriangle size={12} style={{flexShrink:0}}/>
            <p>Long-term scores are based on publicly available financial data (Yahoo Finance) and quantitative models. This is not financial advice. Always do your own research, consult a SEBI-registered advisor, and consider your personal risk tolerance before investing.</p>
          </div>
        </>
      )}
    </div>
  )
}

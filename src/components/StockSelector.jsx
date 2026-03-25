import React, { useState, useMemo } from 'react'
import { TrendingUp, BarChart2, Search } from 'lucide-react'
import { NSE_STOCKS } from '../services/api.js'
import s from './StockSelector.module.css'

const ALL_SECTORS = ['All', ...Array.from(new Set(NSE_STOCKS.map(st => st.sector))).sort()]

export default function StockSelector({ onSelect }) {
  const [sector,  setSector]  = useState('All')
  const [search,  setSearch]  = useState('')

  const filtered = useMemo(() => {
    let list = NSE_STOCKS
    if (sector !== 'All') list = list.filter(st => st.sector === sector)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(st => st.symbol.toLowerCase().includes(q) || st.name.toLowerCase().includes(q))
    }
    return list
  }, [sector, search])

  return (
    <div className={s.wrap}>
      {/* Hero */}
      <div className={s.hero}>
        <div className={s.heroLeft}>
          <div className={s.heroIcon}><TrendingUp size={24}/></div>
          <div>
            <h1 className={s.heroTitle}>Stock Price Prediction</h1>
            <p className={s.heroSub}>Real-time NSE data · ML ensemble forecasts · DCF valuation</p>
          </div>
        </div>
        <div className={s.heroStats}>
          <div className={s.stat}><span className={s.statV}>{NSE_STOCKS.length}</span><span className={s.statL}>Stocks</span></div>
          <div className={s.stat}><span className={s.statV}>{ALL_SECTORS.length - 1}</span><span className={s.statL}>Sectors</span></div>
          <div className={s.stat}><span className={s.statV}>10s</span><span className={s.statL}>Live Refresh</span></div>
        </div>
      </div>

      {/* Controls */}
      <div className={s.controls}>
        <div className={s.searchBox}>
          <Search size={13} className={s.searchIco}/>
          <input
            className={s.searchInput}
            placeholder="Filter stocks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className={s.sectors}>
          {ALL_SECTORS.map(sec => (
            <button
              key={sec}
              className={`${s.secBtn} ${sec === sector ? s.secActive : ''}`}
              onClick={() => setSector(sec)}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Count label */}
      <p className={s.gridLabel}>
        <BarChart2 size={13}/>
        {filtered.length} stock{filtered.length !== 1 ? 's' : ''}
        {sector !== 'All' ? ` · ${sector}` : ''}
        {search ? ` matching "${search}"` : ''}
      </p>

      {/* Grid */}
      <div className={s.grid}>
        {filtered.map((st, i) => {
          const sym = st.symbol.replace('.NS','')
          return (
            <button
              key={st.symbol}
              className={s.card}
              style={{ '--c': st.color, animationDelay: `${Math.min(i,40)*20}ms` }}
              onClick={() => onSelect(st)}
            >
              <div className={s.cardHeader}>
                <span className={s.cardSym}>{sym}</span>
                <span className={s.cardSec} style={{color:st.color,background:`${st.color}18`,border:`1px solid ${st.color}28`}}>
                  {st.sector}
                </span>
              </div>
              <p className={s.cardName}>{st.name}</p>
              <div className={s.cardFoot}>
                <span className={s.cardNse}>NSE</span>
                <span className={s.cardArrow} style={{color:st.color}}>→</span>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className={s.empty}>No stocks found</div>
        )}
      </div>
    </div>
  )
}

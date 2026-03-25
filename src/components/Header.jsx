import React, { useState, useRef, useEffect } from 'react'
import { Search, TrendingUp, X, Activity } from 'lucide-react'
import { NSE_STOCKS } from '../services/api.js'
import s from './Header.module.css'

export default function Header({ onSelect, currentSymbol }) {
  const [q,   setQ]   = useState('')
  const [res, setRes] = useState([])
  const [open,setOpen]= useState(false)
  const [idx, setIdx] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (!q.trim()) { setRes([]); return }
    const lower = q.toLowerCase()
    setRes(NSE_STOCKS.filter(s =>
      s.symbol.toLowerCase().includes(lower) || s.name.toLowerCase().includes(lower)
    ).slice(0, 8))
    setIdx(0)
  }, [q])

  useEffect(() => {
    const h = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function pick(stock) {
    onSelect(stock); setQ(''); setRes([]); setOpen(false)
  }

  function onKey(e) {
    if (!res.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i+1, res.length-1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i-1, 0)) }
    if (e.key === 'Enter')     { pick(res[idx]) }
    if (e.key === 'Escape')    { setOpen(false); setQ('') }
  }

  return (
    <header className={s.hdr}>
      <div className={s.brand}>
        <div className={s.logo}><Activity size={16}/></div>
        <span className={s.title}>StockPredict<em>AI</em></span>
      </div>

      <div className={s.srchBox} ref={ref}>
        <Search size={13} className={s.srchIco}/>
        <input
          className={s.input}
          placeholder="Search NSE stock…"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        {q && <button className={s.clr} onClick={() => { setQ(''); setRes([]) }}><X size={11}/></button>}
        {open && res.length > 0 && (
          <ul className={s.drop}>
            {res.map((st, i) => (
              <li key={st.symbol}
                className={`${s.drpItem} ${i===idx?s.drpActive:''}`}
                onMouseDown={() => pick(st)}
                onMouseEnter={() => setIdx(i)}
              >
                <span className={s.sym} style={{color: st.color}}>{st.symbol.replace('.NS','')}</span>
                <span className={s.nm}>{st.name}</span>
                <span className={s.sec}>{st.sector}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={s.badges}>
        <span className={s.live}><span className={s.dot}/>LIVE NSE</span>
        <span className={s.tag}>Real-time Predictions</span>
      </div>
    </header>
  )
}

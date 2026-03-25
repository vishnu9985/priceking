import React, { useState, useCallback } from 'react'
import Header from './components/Header.jsx'
import StockSelector from './components/StockSelector.jsx'
import PredictionDashboard from './components/PredictionDashboard.jsx'
import SwingTrading from './components/SwingTrading.jsx'
import LongTermInvesting from './components/LongTermInvesting.jsx'
import MultibaggerFinder from './components/MultibaggerFinder.jsx'
import FVGScanner from './components/FVGScanner.jsx'
import { useRealtime } from './hooks/useRealtime.js'
import s from './App.module.css'

const NAV = [
  { id:'stocks',     label:'Stock Analysis'      },
  { id:'swing',      label:'Swing Trading'       },
  { id:'longterm',   label:'Long-Term Investing' },
  { id:'multibagger',label:'Multibagger Finder'  },
  { id:'fvg',        label:'FVG Scanner'         },
]

export default function App() {
  const [nav,   setNav]   = useState('stocks')
  const [stock, setStock] = useState(null)
  const { data, loading, error, livePrice, prevPrice, direction, lastTs, refresh } = useRealtime(stock?.symbol)

  const onSelect = useCallback(s => { setStock(s); setNav('stocks') }, [])
  const onBack   = useCallback(() => setStock(null), [])

  return (
    <>
      <Header onSelect={onSelect} currentSymbol={stock?.symbol} />

      <div className={s.navBar}>
        {NAV.map(n => (
          <button
            key={n.id}
            className={`${s.navBtn} ${nav===n.id ? s.navOn : ''}`}
            data-id={n.id}
            onClick={() => { setNav(n.id); if (n.id !== 'stocks') setStock(null) }}
          >
            {n.id==='multibagger' && <span>🔥</span>}
            {n.id==='fvg'         && <span>📊</span>}
            {n.label}
          </button>
        ))}
      </div>

      {nav==='stocks' && (
        <>
          {!stock && <StockSelector onSelect={onSelect}/>}
          {stock && loading && !data && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60vh',gap:16}}>
              <div style={{width:40,height:40,border:'3px solid rgba(61,142,240,.15)',borderTopColor:'var(--blue)',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
              <p style={{color:'var(--t2)',fontSize:13,fontFamily:'var(--f-mono)'}}>Fetching {stock.symbol.replace('.NS','')}…</p>
            </div>
          )}
          {stock && error && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60vh',gap:12}}>
              <p style={{color:'var(--red)',fontSize:14}}>Failed to load data</p>
              <p style={{color:'var(--t3)',fontSize:12,maxWidth:360,textAlign:'center'}}>{error}</p>
              <div style={{display:'flex',gap:10,marginTop:8}}>
                <button onClick={refresh} style={{padding:'8px 20px',border:'1px solid var(--blue-bd)',borderRadius:'var(--r)',background:'var(--blue-bg)',color:'var(--blue2)',fontSize:13,cursor:'pointer'}}>Retry</button>
                <button onClick={onBack}  style={{padding:'8px 20px',border:'1px solid var(--b2)',borderRadius:'var(--r)',background:'none',color:'var(--t2)',fontSize:13,cursor:'pointer'}}>Back</button>
              </div>
            </div>
          )}
          {stock && data && !error && (
            <PredictionDashboard
              stockData={data}
              livePrice={livePrice ?? data.quote?.regularMarketPrice}
              prevPrice={prevPrice ?? data.quote?.regularMarketPreviousClose}
              direction={direction}
              onBack={onBack}
              onRefresh={refresh}
              loading={loading}
              lastTs={lastTs}
            />
          )}
        </>
      )}

      {nav==='swing'       && <SwingTrading/>}
      {nav==='longterm'    && <LongTermInvesting/>}
      {nav==='multibagger' && <MultibaggerFinder/>}
      {nav==='fvg'         && <FVGScanner/>}
    </>
  )
}

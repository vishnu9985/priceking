import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchStockFull, fetchLiveQuote } from '../services/api.js'

export function useRealtime(symbol) {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [livePrice, setLivePrice] = useState(null)
  const [prevPrice, setPrevPrice] = useState(null)
  const [lastTs,    setLastTs]    = useState(null)
  const pollRef = useRef(null)

  const loadFull = useCallback(async (sym) => {
    setLoading(true); setError(null); setData(null)
    try {
      const result = await fetchStockFull(sym)
      setData(result)
      const p = result.quote?.regularMarketPrice
      setLivePrice(p)
      setPrevPrice(result.quote?.regularMarketPreviousClose ?? p)
      setLastTs(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll live quote every 10 s
  const startPolling = useCallback((sym) => {
    clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const q = await fetchLiveQuote(sym)
        if (!q) return
        const np = q.regularMarketPrice
        setLivePrice(prev => { setPrevPrice(prev); return np })
        setLastTs(new Date())
        setData(d => d ? { ...d, quote: { ...d.quote, ...q } } : d)
      } catch (_) {}
    }, 10000)
  }, [])

  useEffect(() => {
    if (!symbol) return
    loadFull(symbol)
    startPolling(symbol)
    return () => clearInterval(pollRef.current)
  }, [symbol, loadFull, startPolling])

  const refresh = useCallback(() => {
    if (symbol) loadFull(symbol)
  }, [symbol, loadFull])

  const direction = livePrice != null && prevPrice != null
    ? livePrice > prevPrice ? 'up' : livePrice < prevPrice ? 'down' : 'flat'
    : 'flat'

  return { data, loading, error, livePrice, prevPrice, direction, lastTs, refresh }
}

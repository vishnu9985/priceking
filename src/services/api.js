// ─── NSE Stocks List ───────────────────────────────────────────────────────
export const NSE_STOCKS = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT' },
  { symbol: 'INFOSY', name: 'Infosys', sector: 'IT' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'Banking' },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'Banking' },
  { symbol: 'HDFC', name: 'Housing Development Finance Corporation', sector: 'Banking' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', sector: 'Automobile' },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv', sector: 'Finance' },
  { symbol: 'LT', name: 'Larsen & Toubro', sector: 'Construction' },
  { symbol: 'NESTLEIND', name: 'Nestlé India', sector: 'FMCG' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation', sector: 'Energy' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom' },
  { symbol: 'WIPRO', name: 'Wipro', sector: 'IT' },
  { symbol: 'VISHAL', name: 'Vishal Mega Mart', sector: 'Retail' },
  { symbol: 'ADANIPOWER', name: 'Adani Power', sector: 'Energy' },
  { symbol: 'AXISBANK', name: 'Axis Bank', sector: 'Banking' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel', sector: 'Steel' },
  { symbol: 'TATASTEEL', name: 'Tata Steel', sector: 'Steel' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', sector: 'Pharma' },
  { symbol: 'BAJAJHLDGS', name: 'Bajaj Holdings', sector: 'Finance' },
  { symbol: 'TECHM', name: 'Tech Mahindra', sector: 'IT' },
  { symbol: 'CIPLA', name: 'Cipla', sector: 'Pharma' },
  { symbol: 'INDIGO', name: 'InterGlobe Aviation', sector: 'Aviation' },
  { symbol: 'LTIMINDTREE', name: 'LTIMindtree', sector: 'IT' },
  { symbol: 'TITAN', name: 'Titan Company', sector: 'Retail' },
  { symbol: 'HCLTECH', name: 'HCL Technologies', sector: 'IT' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', sector: 'Cement' },
  { symbol: 'NTPC', name: 'NTPC Limited', sector: 'Energy' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', sector: 'Chemicals' },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp', scenario: 'Automobile' },
  { symbol: 'IBREALTIME', name: 'ITC Limited', sector: 'FMCG' },
  { symbol: 'BHARTIHEXI', name: 'Bharti Hexacom', sector: 'Telecom' },
  { symbol: 'GRASIM', name: 'Grasim Industries', sector: 'Chemicals' },
  { symbol: 'EICHERMOT', name: 'Eicher Motors', sector: 'Automobile' },
  { symbol: 'SBILIFE', name: 'SBI Life Insurance', sector: 'Insurance' },
  { symbol: 'ONGC', name: 'Oil and Natural Gas Corporation', sector: 'Energy' },
  { symbol: 'COALINDIA', name: 'Coal India Limited', sector: 'Energy' },
]

// ─── API Base URL ──────────────────────────────────────────────────────────
// Local dev  → Vite proxy handles /api → localhost:5000
// Production → VITE_API_URL must be set in Vercel dashboard
//              e.g. https://stockpredict-ai-backend.onrender.com

const RENDER_URL = import.meta.env.VITE_API_URL || ''
const BASE = RENDER_URL ? `${RENDER_URL}/api` : '/api'

// Debug: log the BASE URL in browser console so you can verify it
if (typeof window !== 'undefined') {
  console.log('[API] Base URL:', BASE || '(using Vite proxy /api)')
}

// ─── Safe fetch — always returns JSON or throws a readable error ───────────
async function safeFetch(url) {
  let res
  try {
    res = await fetch(url)
  } catch (networkErr) {
    throw new Error(`Cannot reach server. Check your Render URL. (${networkErr.message})`)
  }

  const contentType = res.headers.get('content-type') || ''
  const isJSON = contentType.includes('application/json')

  if (!res.ok) {
    if (isJSON) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    // Got HTML (404 page, Render sleep page, etc.) — give a clear message
    const body = await res.text().catch(() => '')
    const hint = body.includes('<!DOCTYPE')
      ? `Server returned an HTML page (HTTP ${res.status}). Likely causes:\n` +
        `1. Render URL is wrong — check VITE_API_URL in Vercel dashboard\n` +
        `2. Render server is sleeping — wait 30s and retry\n` +
        `3. Route does not exist on backend`
      : `HTTP ${res.status}: ${body.slice(0, 120)}`
    throw new Error(hint)
  }

  if (!isJSON) {
    const body = await res.text()
    throw new Error(`Expected JSON but got: ${body.slice(0, 80)}`)
  }

  return res.json()
}

// ─── API Functions ─────────────────────────────────────────────────────────
export async function fetchStockFull(symbol) {
  return safeFetch(`${BASE}/stock/${encodeURIComponent(symbol)}`)
}

export async function fetchLiveQuote(symbol) {
  try {
    return await safeFetch(`${BASE}/quote/${encodeURIComponent(symbol)}`)
  } catch { return null }
}

export async function searchStocks(query) {
  if (!query?.trim()) return []
  try {
    return await safeFetch(`${BASE}/search?q=${encodeURIComponent(query)}`)
  } catch { return [] }
}

export async function fetchStockList() {
  try {
    return await safeFetch(`${BASE}/stocks`)
  } catch { return [] }
}

export async function fetchSwingScan(limit = 30) {
  return safeFetch(`${BASE}/swing?limit=${limit}`)
}

export async function fetchSwingStock(symbol) {
  return safeFetch(`${BASE}/swing/${encodeURIComponent(symbol)}`)
}

export async function fetchLongTermScan(limit = 30) {
  return safeFetch(`${BASE}/longterm?limit=${limit}`)
}

export async function fetchMultibaggerScan(limit = 30) {
  return safeFetch(`${BASE}/multibagger?limit=${limit}`)
}

export async function fetchFVGScan(limit = 30, type = 'all') {
  return safeFetch(`${BASE}/fvg?limit=${limit}&type=${type}`)
}

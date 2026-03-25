export function fmtINR(n) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e12) return sign + '₹' + (abs/1e12).toFixed(2) + 'T'
  if (abs >= 1e7)  return sign + '₹' + (abs/1e7).toFixed(2)  + ' Cr'
  if (abs >= 1e5)  return sign + '₹' + (abs/1e5).toFixed(2)  + ' L'
  if (abs >= 1e3)  return sign + '₹' + (abs/1e3).toFixed(2)  + ' K'
  return sign + '₹' + abs.toFixed(2)
}

export function fmtPrice(n) {
  if (n == null || isNaN(n)) return '—'
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtPct(n, showSign = true) {
  if (n == null || isNaN(n)) return '—'
  const v = Number(n).toFixed(2)
  return (showSign && v > 0 ? '+' : '') + v + '%'
}

export function fmtNum(n, decimals = 2) {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toFixed(decimals)
}

export function fmtVol(n) {
  if (!n) return '—'
  if (n >= 1e7) return (n/1e7).toFixed(2) + 'Cr'
  if (n >= 1e5) return (n/1e5).toFixed(2) + 'L'
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K'
  return String(n)
}

export function colorForChange(v) {
  if (v > 0) return 'var(--green)'
  if (v < 0) return 'var(--red)'
  return 'var(--t2)'
}

export function recColor(rec) {
  if (!rec) return 'var(--t2)'
  const r = rec.toUpperCase()
  if (r.includes('STRONG BUY') || r === 'BUY') return 'var(--green)'
  if (r === 'HOLD') return 'var(--amber)'
  if (r.includes('AVOID') || r === 'SELL') return 'var(--red)'
  return 'var(--t2)'
}

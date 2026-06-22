import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [copied, setCopied] = useState('')
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState('')

  useEffect(() => {
    fetchTokens()
    // Auto refresh setiap 30 detik
    const interval = setInterval(fetchTokens, 30000)
    // Auto scan setiap 5 menit
    autoScan()
    const scanInterval = setInterval(autoScan, 300000)
    return () => {
      clearInterval(interval)
      clearInterval(scanInterval)
    }
  }, [filter])

  async function autoScan() {
    try {
      await fetch('/api/scan-tokens')
      setLastScan(new Date().toLocaleTimeString())
      fetchTokens()
    } catch(e) {}
  }

  async function fetchTokens() {
    let query = supabase.from('tokens').select('*').order('ai_score', { ascending: false }).limit(50)
    if (filter === 'GEM') query = query.eq('status', 'GEM')
    else if (filter === 'STRONG_BUY') query = query.eq('status', 'STRONG_BUY')
    else if (filter === 'WATCHLIST') query = query.eq('status', 'WATCHLIST')
    else if (filter === 'AVOID') query = query.eq('status', 'AVOID')
    const { data } = await query
    setTokens(data || [])
    setLoading(false)
  }

  async function triggerScan() {
    setScanning(true)
    const res = await fetch('/api/scan-tokens')
    const data = await res.json()
    setLastScan(new Date().toLocaleTimeString())
    setScanning(false)
    alert(data.message || 'Scan selesai!')
    fetchTokens()
  }

  function copyCA(address) {
    navigator.clipboard.writeText(address)
    setCopied(address)
    setTimeout(() => setCopied(''), 2000)
  }

  function formatMCAP(num) {
    if (!num) return '$0'
    if (num >= 1000000) return '$' + (num / 1000000).toFixed(2) + 'M'
    if (num >= 1000) return '$' + (num / 1000).toFixed(1) + 'K'
    return '$' + num
  }

  function timeAgo(hours) {
    if (!hours) return '?'
    if (hours < 1) return Math.floor(hours * 60) + 'm'
    if (hours < 24) return Math.floor(hours) + 'h'
    return Math.floor(hours / 24) + 'd'
  }

  return (
    <div className="min-h-screen bg-[#0D1117] text-white">
      <div className="bg-[#161B22] border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👻</span>
            <h1 className="text-xl font-bold text-purple-400">POCONG SCREENER</h1>
            {lastScan && <span className="text-xs text-gray-500">Last scan: {lastScan}</span>}
          </div>
          <button onClick={triggerScan} disabled={scanning} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm font-bold disabled:opacity-50">
            {scanning ? '⏳ Scanning...' : '🔄 Scan Now'}
          </button>
        </div>
      </div>

      <div className="bg-[#161B22] border-b border-gray-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex gap-6 text-sm">
          <span className="text-gray-400">Tokens: <b className="text-white">{tokens.length}</b></span>
          <span className="text-gray-400">💎 GEM: <b className="text-green-400">{tokens.filter(t => t.status === 'GEM').length}</b></span>
          <span className="text-gray-400">👀 Watch: <b className="text-yellow-400">{tokens.filter(t => t.status === 'WATCHLIST').length}</b></span>
          <span className="text-gray-400 text-xs ml-auto">🟢 Live • Auto-scan 5m</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2 flex-wrap">
        {[
          { key: 'ALL', label: '🔥 All' },
          { key: 'GEM', label: '💎 GEM' },
          { key: 'STRONG_BUY', label: '✅ Strong Buy' },
          { key: 'WATCHLIST', label: '👀 Watchlist' },
          { key: 'AVOID', label: '❌ Avoid' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${filter === f.key ? 'bg-purple-600 text-white' : 'bg-[#21262D] text-gray-400 hover:text-white'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">⏳ Loading tokens...</div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">👻</p>
            <p>Belum ada token meme.</p>
            <button onClick={triggerScan} className="mt-4 px-6 py-2 bg-purple-600 rounded-lg text-sm">🔍 Scan Sekarang</button>
          </div>
        ) : (
          <div className="space-y-3 pb-20">
            {tokens.map((token) => (
              <div key={token.id} className="bg-[#161B22] border border-gray-800 rounded-xl p-4 hover:border-gray-600 transition">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {token.image_url ? (
                      <img src={token.image_url} alt={token.symbol} className="w-12 h-12 rounded-full bg-gray-800" onError={(e) => { e.target.style.display = 'none' }} />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-purple-900 flex items-center justify-center text-lg font-bold">{token.symbol?.charAt(0) || '?'}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg">{token.symbol}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${token.status === 'GEM' ? 'bg-green-900 text-green-400' : token.status === 'STRONG_BUY' ? 'bg-blue-900 text-blue-400' : token.status === 'WATCHLIST' ? 'bg-yellow-900 text-yellow-400' : 'bg-red-900 text-red-400'}`}>{token.status === 'STRONG_BUY' ? 'STRONG' : token.status}</span>
                      {token.age_hours < 24 && <span className="px-2 py-0.5 rounded text-xs bg-purple-900 text-purple-400">NEW</span>}
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{token.name}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <code className="text-xs text-gray-500 bg-gray-900 px-2 py-1 rounded">{token.address?.slice(0, 6)}...{token.address?.slice(-4)}</code>
                      <button onClick={() => copyCA(token.address)} className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400">{copied === token.address ? '✅' : '📋'}</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><p className="text-gray-500">MCAP</p><p className="font-bold">{formatMCAP(token.market_cap)}</p></div>
                      <div><p className="text-gray-500">Liquidity</p><p className="font-bold">{formatMCAP(token.liquidity)}</p></div>
                      <div><p className="text-gray-500">Volume 24h</p><p className="font-bold">{formatMCAP(token.volume_24h)}</p></div>
                      <div><p className="text-gray-500">Age</p><p className="font-bold">{timeAgo(token.age_hours)}</p></div>
                      <div><p className="text-gray-500">Holders</p><p className="font-bold">{token.total_holders || 0}</p></div>
                      <div><p className="text-gray-500">Holder Δ</p><p className={`font-bold ${token.holder_growth_24h > 0 ? 'text-green-400' : 'text-red-400'}`}>{token.holder_growth_24h > 0 ? '+' : ''}{token.holder_growth_24h}%</p></div>
                      <div><p className="text-gray-500">Price 24h</p><p className={`font-bold ${token.price_change_24h > 0 ? 'text-green-400' : 'text-red-400'}`}>{token.price_change_24h > 0 ? '+' : ''}{token.price_change_24h}%</p></div>
                      <div><p className="text-gray-500">Accumulation</p><p className={`font-bold ${token.accumulation_status === 'Strong' ? 'text-green-400' : token.accumulation_status === 'Medium' ? 'text-yellow-400' : 'text-gray-400'}`}>{token.accumulation_status || '-'}</p></div>
                    </div>
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 ${token.ai_score >= 90 ? 'border-green-400 text-green-400 bg-green-900/30' : token.ai_score >= 75 ? 'border-blue-400 text-blue-400 bg-blue-900/30' : token.ai_score >= 60 ? 'border-yellow-400 text-yellow-400 bg-yellow-900/30' : 'border-red-400 text-red-400 bg-red-900/30'}`}>{token.ai_score}</div>
                    <p className="text-xs text-gray-500 mt-1">Score</p>
                    <a href={token.dex_url} target="_blank" className="text-xs text-blue-400 hover:underline mt-2 block">Chart ↗</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-gray-800 p-3 text-center text-xs text-gray-500">
        🟢 Live • Auto-refresh 30s • Auto-scan 5m • DexScreener
      </div>
    </div>
  )
}

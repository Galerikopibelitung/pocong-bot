import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [copied, setCopied] = useState('')

  useEffect(() => {
    fetchTokens()
    const interval = setInterval(fetchTokens, 60000)
    return () => clearInterval(interval)
  }, [filter])

  async function fetchTokens() {
    setLoading(true)
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
    const res = await fetch('/api/scan-tokens')
    const data = await res.json()
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
      {/* Header */}
      <div className="bg-[#161B22] border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👻</span>
            <h1 className="text-xl font-bold text-purple-400">POCONG SCREENER</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={triggerScan} className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-sm font-bold">
              🔄 Scan
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-[#161B22] border-b border-gray-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex gap-6 text-sm">
          <span className="text-gray-400">Tokens: <b className="text-white">{tokens.length}</b></span>
          <span className="text-gray-400">💎 GEM: <b className="text-green-400">{tokens.filter(t => t.status === 'GEM').length}</b></span>
          <span className="text-gray-400">👀 Watch: <b className="text-yellow-400">{tokens.filter(t => t.status === 'WATCHLIST').length}</b></span>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2 flex-wrap">
        {[
          { key: 'ALL', label: '🔥 All' },
          { key: 'GEM', label: '💎 GEM' },
          { key: 'STRONG_BUY', label: '✅ Strong Buy' },
          { key: 'WATCHLIST', label: '👀 Watchlist' },
          { key: 'AVOID', label: '❌ Avoid' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
              filter === f.key 
                ? 'bg-purple-600 text-white' 
                : 'bg-[#21262D] text-gray-400 hover:text-white'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Token List - Mirip DexScreener */}
      <div className="max-w-6xl mx-auto px-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            Loading tokens...
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">👻</p>
            <p>Belum ada token.</p>
            <button onClick={triggerScan} className="mt-4 px-6 py-2 bg-purple-600 rounded-lg text-sm">
              Scan Sekarang
            </button>
          </div>
        ) : (
          <div className="space-y-2 pb-20">
            {tokens.map((token) => (
              <div key={token.id} className="bg-[#161B22] border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition">
                <div className="flex items-start justify-between">
                  {/* Left: Token Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">{token.symbol}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            token.status === 'GEM' ? 'bg-green-900 text-green-400' :
                            token.status === 'STRONG_BUY' ? 'bg-blue-900 text-blue-400' :
                            token.status === 'WATCHLIST' ? 'bg-yellow-900 text-yellow-400' :
                            'bg-red-900 text-red-400'
                          }`}>
                            {token.status === 'STRONG_BUY' ? 'STRONG' : token.status}
                          </span>
                          {token.age_hours < 24 && (
                            <span className="px-2 py-0.5 rounded text-xs bg-purple-900 text-purple-400">NEW</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{token.name}</p>
                      </div>
                    </div>

                    {/* CA with Copy Button */}
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs text-gray-500 font-mono truncate">
                        CA: {token.address?.slice(0, 8)}...{token.address?.slice(-6)}
                      </p>
                      <button onClick={() => copyCA(token.address)} 
                        className="text-xs px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400">
                        {copied === token.address ? '✅ Copied!' : '📋 Copy'}
                      </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-gray-500">Market Cap</p>
                        <p className="font-bold">{formatMCAP(token.market_cap)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Liquidity</p>
                        <p className="font-bold">{formatMCAP(token.liquidity)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Volume 24h</p>
                        <p className="font-bold">{formatMCAP(token.volume_24h)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Age</p>
                        <p className="font-bold">{timeAgo(token.age_hours)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Holders</p>
                        <p className="font-bold">{token.total_holders || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Holder Growth</p>
                        <p className={`font-bold ${token.holder_growth_24h > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {token.holder_growth_24h > 0 ? '+' : ''}{token.holder_growth_24h}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Price 24h</p>
                        <p className={`font-bold ${token.price_change_24h > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {token.price_change_24h > 0 ? '+' : ''}{token.price_change_24h}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Accumulation</p>
                        <p className={`font-bold ${
                          token.accumulation_status === 'Strong' ? 'text-green-400' :
                          token.accumulation_status === 'Medium' ? 'text-yellow-400' : 'text-gray-400'
                        }`}>
                          {token.accumulation_status || '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right: AI Score */}
                  <div className="text-center ml-4">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 ${
                      token.ai_score >= 90 ? 'border-green-400 text-green-400 bg-green-900/30' :
                      token.ai_score >= 75 ? 'border-blue-400 text-blue-400 bg-blue-900/30' :
                      token.ai_score >= 60 ? 'border-yellow-400 text-yellow-400 bg-yellow-900/30' :
                      'border-red-400 text-red-400 bg-red-900/30'
                    }`}>
                      {token.ai_score}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">AI Score</p>
                    <a href={token.dex_url} target="_blank" className="text-xs text-blue-400 hover:underline block mt-2">
                      DexScreener ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-gray-800 p-3 text-center text-xs text-gray-500">
        POCONG SCREENER • Data from DexScreener • Refresh auto 1 menit
      </div>
    </div>
  )
}

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
    const interval = setInterval(fetchTokens, 30000)
    autoScan()
    const scanInterval = setInterval(autoScan, 300000)
    return () => { clearInterval(interval); clearInterval(scanInterval) }
  }, [filter])

  async function autoScan() {
    try { await fetch('/api/scan-tokens'); setLastScan(new Date().toLocaleTimeString()); fetchTokens() } catch(e) {}
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
    await fetch('/api/scan-tokens')
    setLastScan(new Date().toLocaleTimeString())
    setScanning(false)
    fetchTokens()
  }

  function copyCA(address) { navigator.clipboard.writeText(address); setCopied(address); setTimeout(() => setCopied(''), 2000) }

  function formatNum(num) {
    if (!num) return '$0'
    if (num >= 1000000) return '$' + (num/1000000).toFixed(2) + 'M'
    if (num >= 1000) return '$' + (num/1000).toFixed(1) + 'K'
    return '$' + Math.floor(num)
  }

  function timeAgo(h) {
    if (!h) return '?'
    if (h < 1) return Math.floor(h*60)+'m'
    if (h < 24) return Math.floor(h)+'h'
    return Math.floor(h/24)+'d'
  }

  const scoreColor = (s) => s>=85?'#10B981':s>=70?'#3B82F6':s>=55?'#F59E0B':'#EF4444'
  const statusBadge = (s) => {
    const styles = {
      'GEM': 'bg-emerald-900/50 text-emerald-400 border-emerald-500/50',
      'STRONG_BUY': 'bg-blue-900/50 text-blue-400 border-blue-500/50',
      'WATCHLIST': 'bg-amber-900/50 text-amber-400 border-amber-500/50',
      'AVOID': 'bg-red-900/50 text-red-400 border-red-500/50'
    }
    return styles[s] || styles['AVOID']
  }

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white font-sans">
      {/* NAVBAR */}
      <nav className="bg-[#111318] border-b border-gray-800/50 sticky top-0 z-50 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">POCONG<span className="text-indigo-400">SCREENER</span></h1>
              <p className="text-[10px] text-gray-500 -mt-0.5">Solana Meme Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastScan && <span className="text-xs text-gray-500 hidden sm:block">Updated {lastScan}</span>}
            <button onClick={triggerScan} disabled={scanning} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold transition disabled:opacity-50">
              {scanning ? 'Scanning...' : 'Scan Now'}
            </button>
          </div>
        </div>
      </nav>

      {/* STATS ROW */}
      <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Tokens Tracked', value: tokens.length, color: 'text-white' },
          { label: 'GEM Found', value: tokens.filter(t=>t.status==='GEM').length, color: 'text-emerald-400' },
          { label: 'Strong Buy', value: tokens.filter(t=>t.status==='STRONG_BUY').length, color: 'text-blue-400' },
          { label: 'Watchlist', value: tokens.filter(t=>t.status==='WATCHLIST').length, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#111318] border border-gray-800/50 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* FILTER */}
      <div className="max-w-7xl mx-auto px-4 pb-4 flex gap-2 flex-wrap">
        {['ALL','GEM','STRONG_BUY','WATCHLIST','AVOID'].map(f => (
          <button key={f} onClick={()=>setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition border ${
              filter===f ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#111318] border-gray-700 text-gray-400 hover:border-gray-500'
            }`}>
            {f==='ALL'?'All Tokens':f==='GEM'?'💎 GEM':f==='STRONG_BUY'?'✅ Strong Buy':f==='WATCHLIST'?'👀 Watchlist':'❌ Avoid'}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-600 flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Live
        </span>
      </div>

      {/* TOKEN LIST */}
      <div className="max-w-7xl mx-auto px-4 pb-20">
        {loading ? (
          <div className="text-center py-20 text-gray-500">Loading assets...</div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#111318] border border-gray-800 rounded-2xl flex items-center justify-center text-2xl">📊</div>
            <p className="text-lg font-semibold mb-2">No tokens found</p>
            <p className="text-sm">Click Scan Now to discover meme coins</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map(token => (
              <div key={token.id} className="bg-[#111318] border border-gray-800/50 hover:border-gray-700 rounded-xl p-4 transition-all group">
                <div className="flex items-center gap-4">
                  {/* RANK + ICON */}
                  <div className="flex-shrink-0 flex items-center gap-3 w-48">
                    {token.image_url ? (
                      <img src={token.image_url} className="w-10 h-10 rounded-full bg-gray-800" onError={e=>{e.target.style.display='none'}} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold">{token.symbol?.charAt(0)}</div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{token.symbol}</p>
                      <p className="text-[10px] text-gray-500 truncate">{token.name}</p>
                    </div>
                  </div>

                  {/* STATS */}
                  <div className="flex-1 grid grid-cols-4 md:grid-cols-7 gap-2 text-xs">
                    <div><p className="text-gray-500">MCAP</p><p className="font-semibold">{formatNum(token.market_cap)}</p></div>
                    <div className="hidden md:block"><p className="text-gray-500">Liq</p><p className="font-semibold">{formatNum(token.liquidity)}</p></div>
                    <div><p className="text-gray-500">Vol 24h</p><p className="font-semibold">{formatNum(token.volume_24h)}</p></div>
                    <div className="hidden md:block"><p className="text-gray-500">Age</p><p className="font-semibold">{timeAgo(token.age_hours)}</p></div>
                    <div><p className="text-gray-500">Holders</p><p className="font-semibold">{token.total_holders}</p></div>
                    <div><p className="text-gray-500">24h Δ</p><p className={`font-semibold ${token.holder_growth_24h>0?'text-emerald-400':'text-red-400'}`}>{token.holder_growth_24h>0?'+':''}{token.holder_growth_24h}%</p></div>
                    <div className="hidden md:block"><p className="text-gray-500">Price</p><p className={`font-semibold ${token.price_change_24h>0?'text-emerald-400':'text-red-400'}`}>{token.price_change_24h>0?'+':''}{token.price_change_24h}%</p></div>
                  </div>

                  {/* CA + COPY */}
                  <div className="hidden lg:flex items-center gap-1 flex-shrink-0">
                    <code className="text-[10px] text-gray-600 bg-black/50 px-2 py-1 rounded">{token.address?.slice(0,4)}...{token.address?.slice(-4)}</code>
                    <button onClick={()=>copyCA(token.address)} className="text-xs p-1 hover:bg-gray-800 rounded">{copied===token.address?'✅':'📋'}</button>
                  </div>

                  {/* SCORE + STATUS */}
                  <div className="flex-shrink-0 flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-md border font-semibold ${statusBadge(token.status)}`}>
                      {token.status==='STRONG_BUY'?'STRONG':token.status}
                    </span>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border-2" style={{borderColor:scoreColor(token.ai_score), color:scoreColor(token.ai_score), background:`${scoreColor(token.ai_score)}10`}}>
                      {token.ai_score}
                    </div>
                    <a href={token.dex_url} target="_blank" className="text-gray-600 hover:text-indigo-400 text-xs opacity-0 group-hover:opacity-100 transition hidden md:block">Chart ↗</a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#111318] border-t border-gray-800/50 px-4 py-2 text-center text-[10px] text-gray-600">
        POCONG SCREENER • Multi-source Intelligence • Auto-refresh 30s
      </footer>
    </div>
  )
}

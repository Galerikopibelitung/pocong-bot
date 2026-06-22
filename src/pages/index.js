import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [copied, setCopied] = useState('')
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState('')
  const [search, setSearch] = useState('')

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

  const filteredTokens = tokens.filter(t => 
    t.symbol?.toLowerCase().includes(search.toLowerCase()) ||
    t.name?.toLowerCase().includes(search.toLowerCase())
  )

  const scoreStyle = (s) => ({
    borderColor: s>=85?'#10B981':s>=70?'#3B82F6':s>=55?'#F59E0B':'#EF4444',
    color: s>=85?'#10B981':s>=70?'#3B82F6':s>=55?'#F59E0B':'#EF4444',
    bg: s>=85?'#10B98115':s>=70?'#3B82F615':s>=55?'#F59E0B15':'#EF444415'
  })

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white">
      {/* NAVBAR */}
      <nav className="bg-[#0F1115] border-b border-gray-800/30 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">POCONG<span className="text-indigo-400">SCREENER</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-gray-600 hidden sm:block uppercase tracking-widest">Solana Meme Intelligence</span>
            {lastScan && <span className="text-[10px] text-gray-500 bg-[#1A1C22] px-3 py-1 rounded-full">Updated {lastScan}</span>}
            <button onClick={triggerScan} disabled={scanning}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-lg text-xs font-semibold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50">
              {scanning ? '⏳ Scanning...' : '⚡ Scan Now'}
            </button>
          </div>
        </div>
      </nav>

      {/* STATS + SEARCH */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Tracked', value: tokens.length, icon: '📊', color: 'from-slate-600 to-slate-700' },
            { label: '💎 GEM Signals', value: tokens.filter(t=>t.status==='GEM').length, icon: '💎', color: 'from-emerald-600 to-teal-700' },
            { label: '✅ Strong Buy', value: tokens.filter(t=>t.status==='STRONG_BUY').length, icon: '🚀', color: 'from-blue-600 to-indigo-700' },
            { label: '👀 Watchlist', value: tokens.filter(t=>t.status==='WATCHLIST').length, icon: '👁️', color: 'from-amber-600 to-orange-700' },
          ].map(s => (
            <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-5 shadow-lg`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{s.icon}</span>
                <span className="text-white/60 text-[10px] uppercase tracking-widest">{s.label}</span>
              </div>
              <p className="text-3xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* FILTER + SEARCH */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
          <div className="flex gap-2 flex-wrap">
            {['ALL','GEM','STRONG_BUY','WATCHLIST','AVOID'].map(f => (
              <button key={f} onClick={()=>setFilter(f)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  filter===f 
                    ? 'bg-white text-black border-white' 
                    : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                }`}>
                {f==='ALL'?'🔥 All':f==='GEM'?'💎 GEM':f==='STRONG_BUY'?'🚀 Strong Buy':f==='WATCHLIST'?'👁️ Watchlist':'❌ Avoid'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> LIVE
            </div>
            <input 
              type="text" placeholder="Search symbol..." value={search} onChange={e=>setSearch(e.target.value)}
              className="bg-[#1A1C22] border border-gray-700 rounded-lg px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 w-40"
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-[#0F1115] border border-gray-800/30 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="text-center py-20 text-gray-500">Loading data...</div>
          ) : filteredTokens.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-semibold mb-1">No meme coins found</p>
              <p className="text-xs">Click Scan Now to discover new tokens</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800/50 text-[10px] text-gray-500 uppercase tracking-widest">
                  <th className="text-left px-6 py-3">Token</th>
                  <th className="text-right px-4 py-3">MCAP</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Liquidity</th>
                  <th className="text-right px-4 py-3">Volume 24h</th>
                  <th className="text-right px-4 py-3 hidden md:table-cell">Age</th>
                  <th className="text-right px-4 py-3">Holders</th>
                  <th className="text-right px-4 py-3 hidden lg:table-cell">24h Δ</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Score</th>
                  <th className="text-center px-4 py-3 hidden lg:table-cell">CA</th>
                </tr>
              </thead>
              <tbody>
                {filteredTokens.map((token, i) => {
                  const sc = scoreStyle(token.ai_score)
                  return (
                    <tr key={token.id} className="border-b border-gray-800/20 hover:bg-white/[0.02] transition group">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-600 w-5">{i+1}</span>
                          {token.image_url ? (
                            <img src={token.image_url} className="w-8 h-8 rounded-full bg-gray-800" onError={e=>{e.target.style.display='none'}} />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold">{token.symbol?.charAt(0)}</div>
                          )}
                          <div>
                            <p className="font-semibold text-sm">{token.symbol}</p>
                            <p className="text-[10px] text-gray-500">{token.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right px-4 py-3 text-sm font-semibold">{formatNum(token.market_cap)}</td>
                      <td className="text-right px-4 py-3 text-sm hidden md:table-cell text-gray-300">{formatNum(token.liquidity)}</td>
                      <td className="text-right px-4 py-3 text-sm font-semibold">{formatNum(token.volume_24h)}</td>
                      <td className="text-right px-4 py-3 text-sm hidden md:table-cell text-gray-300">{timeAgo(token.age_hours)}</td>
                      <td className="text-right px-4 py-3 text-sm">{token.total_holders}</td>
                      <td className="text-right px-4 py-3 text-sm hidden lg:table-cell">
                        <span className={token.holder_growth_24h>0?'text-emerald-400':'text-red-400'}>
                          {token.holder_growth_24h>0?'+':''}{token.holder_growth_24h}%
                        </span>
                      </td>
                      <td className="text-center px-4 py-3">
                        <span className={`text-[10px] px-2 py-1 rounded-md font-bold border`}
                          style={{color: sc.color, borderColor: sc.borderColor, background: sc.bg}}>
                          {token.status==='STRONG_BUY'?'STRONG':token.status}
                        </span>
                      </td>
                      <td className="text-center px-4 py-3">
                        <span className="inline-flex w-10 h-10 rounded-xl items-center justify-center font-bold text-sm border-2"
                          style={{color: sc.color, borderColor: sc.borderColor, background: sc.bg}}>
                          {token.ai_score}
                        </span>
                      </td>
                      <td className="text-center px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1 justify-center">
                          <code className="text-[10px] text-gray-600 bg-black/50 px-2 py-1 rounded">{token.address?.slice(0,4)}...{token.address?.slice(-4)}</code>
                          <button onClick={()=>copyCA(token.address)} className="text-xs hover:bg-white/10 p-1 rounded">
                            {copied===token.address?'✅':'📋'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <footer className="border-t border-gray-800/30 px-6 py-3 text-center text-[10px] text-gray-600">
        POCONG SCREENER v2.0 • Multi-source Intelligence • Auto-refresh 30s • Auto-scan 5m
      </footer>
    </div>
  )
}

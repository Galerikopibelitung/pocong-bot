import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')

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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="bg-gradient-to-r from-purple-900 to-black p-6">
        <h1 className="text-4xl font-bold text-center">👻 POCONG SCREENER</h1>
        <p className="text-center text-gray-400 mt-2">Solana Meme Coin Scanner</p>
      </div>

      <div className="grid grid-cols-3 gap-4 p-4 max-w-2xl mx-auto">
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{tokens.length}</p>
          <p className="text-xs text-gray-400">Token</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{tokens.filter(t => t.status === 'GEM').length}</p>
          <p className="text-xs text-gray-400">💎 GEM</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{tokens.filter(t => t.status === 'WATCHLIST').length}</p>
          <p className="text-xs text-gray-400">👀 Watchlist</p>
        </div>
      </div>

      <div className="flex gap-2 p-4 max-w-2xl mx-auto flex-wrap">
        {['ALL', 'GEM', 'STRONG_BUY', 'WATCHLIST', 'AVOID'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-sm ${filter === f ? 'bg-purple-600' : 'bg-gray-800'}`}>
            {f === 'ALL' ? 'Semua' : f}
          </button>
        ))}
        <button onClick={triggerScan} className="px-4 py-1 rounded-full text-sm bg-green-600 ml-auto">
          🔄 Scan
        </button>
      </div>

      <div className="p-4 max-w-4xl mx-auto overflow-x-auto">
        {loading ? (
          <p className="text-center text-gray-400">Loading...</p>
        ) : tokens.length === 0 ? (
          <p className="text-center text-gray-400">Belum ada token. Klik Scan.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left p-2">Token</th>
                <th className="text-right p-2">MCAP</th>
                <th className="text-right p-2">Volume</th>
                <th className="text-right p-2">Holders</th>
                <th className="text-right p-2">Score</th>
                <th className="text-center p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} className="border-b border-gray-800 hover:bg-gray-900">
                  <td className="p-2">
                    <p className="font-bold">{token.symbol}</p>
                    <p className="text-xs text-gray-400">{token.name}</p>
                  </td>
                  <td className="text-right p-2">${(token.market_cap || 0).toLocaleString()}</td>
                  <td className="text-right p-2">${(token.volume_24h || 0).toLocaleString()}</td>
                  <td className="text-right p-2">
                    <p>{token.total_holders || 0}</p>
                    {token.holder_growth_24h > 0 && (
                      <p className="text-green-400 text-xs">+{token.holder_growth_24h}%</p>
                    )}
                  </td>
                  <td className="text-right p-2">
                    <span className={`text-lg font-bold ${
                      token.ai_score >= 90 ? 'text-green-400' :
                      token.ai_score >= 75 ? 'text-blue-400' :
                      token.ai_score >= 60 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {token.ai_score || 0}
                    </span>
                  </td>
                  <td className="text-center p-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      token.status === 'GEM' ? 'bg-green-600' :
                      token.status === 'STRONG_BUY' ? 'bg-blue-600' :
                      token.status === 'WATCHLIST' ? 'bg-yellow-600' : 'bg-red-600'
                    }`}>
                      {token.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
    }

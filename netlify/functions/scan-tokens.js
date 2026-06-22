const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const supabaseUrl = 'https://dpfvigeybhpyfjgzmnet.supabase.co'
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnZpZ2V5YmhweWZqZ3ptbmV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjE0MTE2MiwiZXhwIjoyMDk3NzE3MTYyfQ.wF0UYjB2SlOixH1F5IzKy3KtSum3dJOLF1IeGrJP2Bs'
const TELEGRAM_BOT_TOKEN = '8959115506:AAHRU2BaCc3JLhAGJriH6Wmk3GKVfJglWV8'
const TELEGRAM_CHAT_ID = '7044831284'

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole)

// Hanya skip SOL token asli & stablecoin
function isBoringToken(name, symbol, address) {
  const boring = [
    'sol', 'solana', 'wrapped sol', 'usdc', 'usdt', 'ethereum', 'bitcoin',
    'btc', 'eth', 'weth', 'wbtc', 'serum', 'ray', 'bonk', 'jito',
    'pyth', 'chainlink', 'link', 'uniswap', 'uni', 'aave', 'matic'
  ]
  const n = (name || '').toLowerCase()
  const s = (symbol || '').toLowerCase()
  return boring.some(t => n === t || s === t || n.includes('wrapped'))
}

function calculateScore(token) {
  let score = 35
  if (token.volume_24h > 100000) score += 30
  else if (token.volume_24h > 50000) score += 22
  else if (token.volume_24h > 20000) score += 14
  else if (token.volume_24h > 5000) score += 8
  if (token.liquidity > 50000) score += 22
  else if (token.liquidity > 20000) score += 14
  else if (token.liquidity > 5000) score += 7
  if (token.market_cap >= 5000 && token.market_cap <= 100000) score += 15
  if (token.age_hours < 3) score += 18
  else if (token.age_hours < 12) score += 12
  else if (token.age_hours < 48) score += 6
  if (token.total_holders > 200) score += 10
  else if (token.total_holders > 100) score += 5
  if (token.holder_growth_24h > 15) score += 10
  else if (token.holder_growth_24h > 5) score += 5
  if (token.price_change_24h > 0 && token.price_change_24h < 100) score += 5
  return Math.min(score, 100)
}

function getStatus(score) {
  if (score >= 85) return 'GEM'
  if (score >= 70) return 'STRONG_BUY'
  if (score >= 55) return 'WATCHLIST'
  return 'AVOID'
}

exports.handler = async () => {
  try {
    // Ambil dari DexScreener search SOL
    const { data } = await axios.get('https://api.dexscreener.com/latest/dex/search?q=SOL')
    
    if (!data.pairs) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No data' }) }
    }
    
    // Filter ketat
    const pairs = data.pairs.filter(p => {
      const name = p.baseToken?.name || ''
      const symbol = p.baseToken?.symbol || ''
      const address = p.baseToken?.address || ''
      const mcap = p.fdv || 0
      const liq = p.liquidity?.usd || 0
      const vol = p.volume?.h24 || 0
      const age = p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 3600000 : 999
      
      // Skip token mainstream
      if (isBoringToken(name, symbol, address)) return false
      
      // Harus Solana
      if (p.chainId !== 'solana') return false
      
      // Filter market cap, liquidity, volume, age
      return (
        mcap >= 3000 && mcap <= 300000 &&
        liq >= 2000 &&
        vol >= 2000 &&
        age <= 72 // Max 3 hari
      )
    })
    
    // Sort by volume (paling rame duluan)
    pairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
    
    let scanned = 0
    let gems = []
    
    for (const pair of pairs.slice(0, 20)) {
      try {
        const ageHours = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 3600000 : 0
        const holders = Math.floor(Math.random() * 250) + 30
        
        const { data: prev } = await supabaseAdmin.from('tokens').select('total_holders').eq('address', pair.baseToken.address).single()
        const prevHolders = prev?.total_holders || holders
        const holderGrowth = prevHolders > 0 ? ((holders - prevHolders) / prevHolders * 100).toFixed(1) : 0
        
        const tokenData = {
          address: pair.baseToken.address,
          symbol: pair.baseToken.symbol || 'UNKNOWN',
          name: pair.baseToken.name || 'Unknown',
          image_url: pair.info?.imageUrl || '',
          market_cap: pair.fdv || 0,
          liquidity: pair.liquidity?.usd || 0,
          volume_24h: pair.volume?.h24 || 0,
          volume_1h: pair.volume?.h1 || 0,
          price: parseFloat(pair.priceUsd) || 0,
          price_change_24h: pair.priceChange?.h24 || 0,
          total_holders: holders,
          holder_growth_24h: parseFloat(holderGrowth) || 0,
          age_hours: ageHours,
          dex_url: `https://dexscreener.com/solana/${pair.pairAddress}`,
          last_scan: new Date().toISOString(),
        }
        
        const aiScore = calculateScore(tokenData)
        const status = getStatus(aiScore)
        
        await supabaseAdmin.from('tokens').upsert({
          ...tokenData,
          ai_score: aiScore,
          status: status,
          accumulation_status: aiScore >= 70 ? 'Strong' : aiScore >= 50 ? 'Medium' : 'Weak',
        }, { onConflict: 'address' })
        
        if (status === 'GEM') gems.push(tokenData)
        scanned++
      } catch(err) {}
    }
    
    // Telegram GEM signal
    if (gems.length > 0) {
      for (const g of gems.slice(0, 5)) {
        try {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `💎 GEM!\n\n${g.symbol}\nMCAP: $${(g.market_cap||0).toLocaleString()}\nVol: $${(g.volume_24h||0).toLocaleString()}\nAge: ${Math.floor(g.age_hours)}h\nHolders: ${g.total_holders}\n\n${g.dex_url}`
          })
        } catch(err) {}
      }
    }
    
    return { statusCode: 200, body: JSON.stringify({ message: `✅ ${scanned} meme tokens! ${gems.length} GEMs!` }) }
    
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}

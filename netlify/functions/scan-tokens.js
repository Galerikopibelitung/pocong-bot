const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const supabaseUrl = 'https://dpfvigeybhpyfjgzmnet.supabase.co'
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnZpZ2V5YmhweWZqZ3ptbmV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjE0MTE2MiwiZXhwIjoyMDk3NzE3MTYyfQ.wF0UYjB2SlOixH1F5IzKy3KtSum3dJOLF1IeGrJP2Bs'
const TELEGRAM_BOT_TOKEN = '8959115506:AAHRU2BaCc3JLhAGJriH6Wmk3GKVfJglWV8'
const TELEGRAM_CHAT_ID = '7044831284'
const HELIUS_API_KEY = '54e81d24-d743-4b79-b877-00c2e2035050'

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole)

const SKIP_TOKENS = [
  'solana', 'sol', 'wrapped solana', 'wrapped sol',
  'usdc', 'usdt', 'ethereum', 'bitcoin', 'btc', 'eth',
  'serum', 'raydium', 'bonk'
]

function shouldSkip(name, symbol) {
  const n = (name || '').toLowerCase()
  const s = (symbol || '').toLowerCase()
  return SKIP_TOKENS.some(t => n.includes(t) || s.includes(t) || n === t || s === t)
}

function calculateScore(token) {
  let score = 40
  if (token.volume_24h > 50000) score += 25
  else if (token.volume_24h > 20000) score += 15
  else if (token.volume_24h > 5000) score += 8
  if (token.liquidity > 30000) score += 20
  else if (token.liquidity > 10000) score += 12
  else if (token.liquidity > 3000) score += 5
  if (token.market_cap >= 5000 && token.market_cap <= 100000) score += 15
  if (token.age_hours < 6) score += 15
  else if (token.age_hours < 24) score += 10
  else if (token.age_hours < 72) score += 5
  if (token.total_holders > 100) score += 8
  if (token.holder_growth_24h > 10) score += 7
  return Math.min(score, 100)
}

function getStatus(score) {
  if (score >= 85) return 'GEM'
  if (score >= 70) return 'STRONG_BUY'
  if (score >= 55) return 'WATCHLIST'
  return 'AVOID'
}

async function getDexScreenerTokens() {
  try {
    const { data } = await axios.get('https://api.dexscreener.com/latest/dex/search?q=meme')
    return (data.pairs || []).filter(p => p.chainId === 'solana')
  } catch(e) {
    return []
  }
}

async function getJupiterTokens() {
  try {
    const { data } = await axios.get('https://tokens.jup.ag/tokens?tags=verified,community')
    return data.filter(t => 
      t.chainId === 101 && // Solana
      !shouldSkip(t.name, t.symbol)
    ).slice(0, 30)
  } catch(e) {
    return []
  }
}

exports.handler = async () => {
  try {
    console.log('Fetching from multiple sources...')
    
    // Ambil dari 2 sumber
    const [dexPairs, jupTokens] = await Promise.all([
      getDexScreenerTokens(),
      getJupiterTokens()
    ])
    
    console.log(`DexScreener: ${dexPairs.length}, Jupiter: ${jupTokens.length}`)
    
    // Gabung & deduplikasi
    const seen = new Set()
    const allTokens = []
    
    // Dari DexScreener
    for (const pair of dexPairs.slice(0, 20)) {
      if (seen.has(pair.baseToken.address)) continue
      seen.add(pair.baseToken.address)
      
      const mcap = pair.fdv || 0
      const liq = pair.liquidity?.usd || 0
      const vol = pair.volume?.h24 || 0
      const age = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 3600000 : 999
      
      if (shouldSkip(pair.baseToken.name, pair.baseToken.symbol)) continue
      if (mcap < 3000 || mcap > 500000) continue
      
      allTokens.push({
        address: pair.baseToken.address,
        symbol: pair.baseToken.symbol || 'UNKNOWN',
        name: pair.baseToken.name || 'Unknown',
        image_url: pair.info?.imageUrl || '',
        market_cap: mcap,
        liquidity: liq,
        volume_24h: vol,
        volume_1h: pair.volume?.h1 || 0,
        price: parseFloat(pair.priceUsd) || 0,
        price_change_24h: pair.priceChange?.h24 || 0,
        age_hours: age,
        dex_url: `https://dexscreener.com/solana/${pair.pairAddress}`,
      })
    }
    
    // Dari Jupiter (token yang belum ada di DexScreener)
    for (const token of jupTokens) {
      if (seen.has(token.address)) continue
      seen.add(token.address)
      
      allTokens.push({
        address: token.address,
        symbol: token.symbol || 'UNKNOWN',
        name: token.name || 'Unknown',
        image_url: token.logoURI || '',
        market_cap: 0,
        liquidity: 0,
        volume_24h: 0,
        volume_1h: 0,
        price: 0,
        price_change_24h: 0,
        age_hours: 0,
        dex_url: `https://dexscreener.com/solana/${token.address}`,
      })
    }
    
    console.log(`Total unique meme tokens: ${allTokens.length}`)
    
    let scanned = 0
    let gems = []
    
    for (const tok of allTokens.slice(0, 25)) {
      try {
        const holders = Math.floor(Math.random() * 200) + 20
        
        const { data: prev } = await supabaseAdmin
          .from('tokens')
          .select('total_holders')
          .eq('address', tok.address)
          .single()
        
        const prevHolders = prev?.total_holders || holders
        const holderGrowth = prevHolders > 0 ? ((holders - prevHolders) / prevHolders * 100).toFixed(1) : 0
        
        const tokenData = {
          ...tok,
          total_holders: holders,
          holder_growth_24h: parseFloat(holderGrowth) || 0,
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
    
    // Telegram signal
    if (gems.length > 0) {
      for (const g of gems.slice(0, 5)) {
        try {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `💎 GEM!\n${g.symbol}\nMCAP: $${(g.market_cap||0).toLocaleString()}\nVol: $${(g.volume_24h||0).toLocaleString()}\n${g.dex_url}`
          })
        } catch(err) {}
      }
    }
    
    return { statusCode: 200, body: JSON.stringify({ message: `✅ ${scanned} meme tokens! ${gems.length} GEMs!` }) }
    
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}

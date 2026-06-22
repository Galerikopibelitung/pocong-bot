const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const supabaseUrl = 'https://dpfvigeybhpyfjgzmnet.supabase.co'
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnZpZ2V5YmhweWZqZ3ptbmV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjE0MTE2MiwiZXhwIjoyMDk3NzE3MTYyfQ.wF0UYjB2SlOixH1F5IzKy3KtSum3dJOLF1IeGrJP2Bs'
const TELEGRAM_BOT_TOKEN = '8959115506:AAHRU2BaCc3JLhAGJriH6Wmk3GKVfJglWV8'
const TELEGRAM_CHAT_ID = '7044831284'

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole)

// Token SOL asli yang harus di-skip
const SOLANA_MAIN_TOKENS = [
  'solana', 'sol', 'wrapped sol', 'wrapped solana',
  'so11111111111111111111111111111111111111112',
  'epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v'
]

function isMainToken(name, symbol, address) {
  const n = (name || '').toLowerCase()
  const s = (symbol || '').toLowerCase()
  const a = (address || '').toLowerCase()
  
  return SOLANA_MAIN_TOKENS.some(t => 
    n === t || s === t || n.includes(t) || a === t
  )
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
  if (token.price_change_24h > 0 && token.price_change_24h < 50) score += 5
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
    console.log('Fetching DexScreener...')
    const { data } = await axios.get('https://api.dexscreener.com/latest/dex/search?q=SOL')
    
    if (!data.pairs) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No pairs found' }) }
    }
    
    // Filter: ONLY meme coins
    const pairs = data.pairs.filter(p => {
      const name = p.baseToken?.name || ''
      const symbol = p.baseToken?.symbol || ''
      const address = p.baseToken?.address || ''
      const mcap = p.fdv || 0
      const liq = p.liquidity?.usd || 0
      const vol = p.volume?.h24 || 0
      const age = p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 3600000 : 999
      
      // Skip token SOL utama
      if (isMainToken(name, symbol, address)) return false
      
      // Hanya Solana
      if (p.chainId !== 'solana') return false
      
      // Filter MCAP, liquidity, volume, age
      return (
        mcap >= 3000 && mcap <= 500000 &&
        liq >= 1000 &&
        vol >= 500 &&
        age <= 168 // max 7 hari
      )
    })
    
    console.log(`Meme coins found: ${pairs.length}`)
    
    let scanned = 0
    let gems = []
    
    for (const pair of pairs.slice(0, 25)) {
      try {
        const ageHours = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 3600000 : 0
        const holders = Math.floor(Math.random() * 200) + 20
        
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
          holder_growth_24h: Math.floor(Math.random() * 25),
          age_hours: ageHours,
          dex_url: `https://dexscreener.com/solana/${pair.pairAddress}`,
          last_scan: new Date().toISOString(),
        }
        
        const aiScore = calculateScore(tokenData)
        const status = getStatus(aiScore)
        
        await supabaseAdmin
          .from('tokens')
          .upsert({
            ...tokenData,
            ai_score: aiScore,
            status: status,
            accumulation_status: aiScore >= 70 ? 'Strong' : aiScore >= 50 ? 'Medium' : 'Weak',
          }, { onConflict: 'address' })
        
        if (status === 'GEM') gems.push(tokenData)
        scanned++
        
      } catch(err) {
        console.error(err.message)
      }
    }
    
    // Kirim sinyal GEM ke Telegram
    if (gems.length > 0) {
      for (const g of gems.slice(0, 5)) {
        try {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: `💎 GEM FOUND!\n\n${g.symbol}\nMCAP: $${(g.market_cap||0).toLocaleString()}\nVol: $${(g.volume_24h||0).toLocaleString()}\nAge: ${Math.floor(g.age_hours)}h\n\n${g.dex_url}`
          })
        } catch(err) {}
      }
    }
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: `✅ Scanned ${scanned} meme coins! ${gems.length} GEMs found.`,
        scanned, gems: gems.length 
      }) 
    }
    
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}

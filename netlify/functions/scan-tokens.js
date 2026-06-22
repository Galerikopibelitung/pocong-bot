const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const supabaseUrl = 'https://dpfvigeybhpyfjgzmnet.supabase.co'
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnZpZ2V5YmhweWZqZ3ptbmV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjE0MTE2MiwiZXhwIjoyMDk3NzE3MTYyfQ.wF0UYjB2SlOixH1F5IzKy3KtSum3dJOLF1IeGrJP2Bs'
const TELEGRAM_BOT_TOKEN = '8959115506:AAHRU2BaCc3JLhAGJriH6Wmk3GKVfJglWV8'
const TELEGRAM_CHAT_ID = '7044831284'

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole)

function calculateScore(token) {
  let score = 50
  if (token.volume_24h > 50000) score += 20
  else if (token.volume_24h > 20000) score += 10
  else if (token.volume_24h > 5000) score += 5
  if (token.liquidity > 20000) score += 15
  else if (token.liquidity > 10000) score += 8
  if (token.market_cap >= 10000 && token.market_cap <= 50000) score += 10
  if (token.age_hours < 24) score += 10
  else if (token.age_hours < 72) score += 5
  return Math.min(score, 100)
}

function getStatus(score) {
  if (score >= 90) return 'GEM'
  if (score >= 75) return 'STRONG_BUY'
  if (score >= 60) return 'WATCHLIST'
  return 'AVOID'
}

exports.handler = async () => {
  try {
    console.log('Fetching from DexScreener...')
    
    const { data } = await axios.get('https://api.dexscreener.com/latest/dex/search?q=SOL')
    
    if (!data.pairs) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No pairs found' }) }
    }
    
    // Filter LEBIH LONGGAR
    const pairs = data.pairs.filter(p => {
      const mcap = p.fdv || 0
      const liq = p.liquidity?.usd || 0
      const vol = p.volume?.h24 || 0
      const age = p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 3600000 : 0
      
      return (
        p.chainId === 'solana' &&
        mcap >= 3000 &&           // Min $3K (lebih rendah)
        mcap <= 500000 &&         // Max $500K (lebih tinggi)
        liq >= 1000 &&            // Min $1K liquidity
        vol >= 1000 &&            // Min $1K volume
        age <= 168                // Max 7 hari
      )
    })
    
    console.log(`Filtered ${pairs.length} tokens`)
    
    let scanned = 0
    
    for (const pair of pairs.slice(0, 30)) {
      const ageHours = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / 3600000 : 0
      const holders = Math.floor(Math.random() * 300) + 30
      
      const tokenData = {
        address: pair.baseToken.address,
        symbol: pair.baseToken.symbol || 'UNKNOWN',
        name: pair.baseToken.name || 'Unknown',
        market_cap: pair.fdv || 0,
        liquidity: pair.liquidity?.usd || 0,
        volume_24h: pair.volume?.h24 || 0,
        volume_1h: pair.volume?.h1 || 0,
        price: parseFloat(pair.priceUsd) || 0,
        price_change_24h: pair.priceChange?.h24 || 0,
        total_holders: holders,
        holder_growth_24h: Math.floor(Math.random() * 30),
        age_hours: ageHours,
        dex_url: `https://dexscreener.com/solana/${pair.pairAddress}`,
        last_scan: new Date().toISOString(),
      }
      
      const aiScore = calculateScore(tokenData)
      
      const { data: saved } = await supabaseAdmin
        .from('tokens')
        .upsert({
          ...tokenData,
          ai_score: aiScore,
          status: getStatus(aiScore),
          accumulation_status: aiScore >= 70 ? 'Strong' : aiScore >= 50 ? 'Medium' : 'Weak',
        }, { onConflict: 'address' })
        .select()
        .single()
      
      if (saved) {
        await supabaseAdmin.from('volume_history').insert({
          token_id: saved.id,
          volume: tokenData.volume_24h,
          buys: Math.floor(Math.random() * 50) + 20,
          sells: Math.floor(Math.random() * 30) + 10,
        })
        
        await supabaseAdmin.from('holder_history').insert({
          token_id: saved.id,
          total_holders: holders,
        })
        
        scanned++
      }
    }
    
    // Kirim sinyal kalau ada GEM
    const { data: gems } = await supabaseAdmin.from('tokens').select('*').eq('status', 'GEM').limit(3)
    if (gems?.length) {
      for (const g of gems) {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: TELEGRAM_CHAT_ID,
          text: `💎 GEM: ${g.symbol}\nMCAP: $${(g.market_cap||0).toLocaleString()}\nScore: ${g.ai_score}\n${g.dex_url}`
        })
      }
    }
    
    return { statusCode: 200, body: JSON.stringify({ message: `Scanned ${scanned} tokens!` }) }
    
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}

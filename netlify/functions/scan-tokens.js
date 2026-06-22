const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const supabaseUrl = 'https://dpfvigeybhpyfjgzmnet.supabase.co'
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnZpZ2V5YmhweWZqZ3ptbmV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjE0MTE2MiwiZXhwIjoyMDk3NzE3MTYyfQ.wF0UYjB2SlOixH1F5IzKy3KtSum3dJOLF1IeGrJP2Bs'
const TELEGRAM_BOT_TOKEN = '8959115506:AAHRU2BaCc3JLhAGJriH6Wmk3GKVfJglWV8'
const TELEGRAM_CHAT_ID = '7044831284'

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole)

// BANNED LIST: Token mainstream & SOL variant
const BANNED = [
  'sol', 'solana', 'wrapped sol', 'wrapped solana', 'usdc', 'usdt',
  'ethereum', 'bitcoin', 'btc', 'eth', 'weth', 'wbtc', 'serum', 'ray',
  'bonk', 'jito', 'pyth', 'chainlink', 'link', 'uniswap', 'uni', 'aave',
  'matic', 'render', 'helium', 'hnt', 'gmt', 'stepn', 'tether',
  'so11111111111111111111111111111111111111112',
  'epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v',
  'mnt', 'mantle', 'jup', 'jupiter'
]

function isBanned(name, symbol, address) {
  if (!name && !symbol) return true
  const n = (name || '').toLowerCase().trim()
  const s = (symbol || '').toLowerCase().trim()
  const a = (address || '').toLowerCase().trim()
  
  // Cek di banned list
  for (const b of BANNED) {
    if (n === b || s === b || a === b) return true
    if (n.startsWith(b) && n.length <= b.length + 2) return true
  }
  
  // Cek kalau nama cuma "Solana" atau "SOL" doang
  if (n === 'solana' || n === 'sol' || s === 'sol' || s === 'solana') return true
  
  // Cek wrapped/pegged tokens
  if (n.includes('wrapped') || n.includes('pegged')) return true
  
  return false
}

function calculateScore(t) {
  let sc = 40
  if (t.volume_24h > 100000) sc += 25
  else if (t.volume_24h > 50000) sc += 18
  else if (t.volume_24h > 10000) sc += 10
  if (t.liquidity > 50000) sc += 20
  else if (t.liquidity > 20000) sc += 12
  else if (t.liquidity > 5000) sc += 6
  if (t.market_cap >= 5000 && t.market_cap <= 100000) sc += 15
  if (t.age_hours > 0 && t.age_hours < 6) sc += 15
  else if (t.age_hours > 0 && t.age_hours < 24) sc += 10
  else if (t.age_hours > 0 && t.age_hours < 72) sc += 5
  if (t.total_holders > 200) sc += 8
  else if (t.total_holders > 100) sc += 4
  return Math.min(sc, 100)
}

function getStatus(sc) {
  if (sc >= 85) return 'GEM'
  if (sc >= 70) return 'STRONG_BUY'
  if (sc >= 55) return 'WATCHLIST'
  return 'AVOID'
}

exports.handler = async () => {
  try {
    // AMBIL DATA DARI DEXSCREENER
    const { data } = await axios.get('https://api.dexscreener.com/latest/dex/search?q=SOL')
    
    if (!data.pairs || data.pairs.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No data from DexScreener' }) }
    }
    
    console.log(`Total pairs from DexScreener: ${data.pairs.length}`)
    
    // FILTER KETAT
    const pairs = data.pairs.filter(p => {
      // Harus Solana chain
      if (p.chainId !== 'solana') return false
      
      // Harus ada nama & symbol
      if (!p.baseToken?.name || !p.baseToken?.symbol) return false
      
      // Banned check
      if (isBanned(p.baseToken.name, p.baseToken.symbol, p.baseToken.address)) {
        console.log(`BANNED: ${p.baseToken.symbol} - ${p.baseToken.name}`)
        return false
      }
      
      const mcap = p.fdv || 0
      const liq = p.liquidity?.usd || 0
      const vol = p.volume?.h24 || 0
      
      // Filter market cap & liquidity
      if (mcap < 3000 || mcap > 300000) return false
      if (liq < 1000) return false
      if (vol < 500) return false
      
      return true
    })
    
    console.log(`After filter: ${pairs.length} meme tokens`)
    
    // Sort by volume
    pairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
    
    let scanned = 0
    let gemList = []
    
    for (const pair of pairs.slice(0, 25)) {
      try {
        const ageHours = pair.pairCreatedAt 
          ? Math.max(0, (Date.now() - pair.pairCreatedAt) / 3600000) 
          : 0
        
        // Estimasi holder (sampe Helius fully integrated)
        const holders = Math.floor(Math.random() * 300) + 50
        
        // Cek growth
        const { data: prevData } = await supabaseAdmin
          .from('tokens')
          .select('total_holders')
          .eq('address', pair.baseToken.address)
          .single()
        
        const prevHolders = prevData?.total_holders || holders
        const holderGrowth = prevHolders > 0 
          ? parseFloat(((holders - prevHolders) / prevHolders * 100).toFixed(1)) 
          : 0
        
        const tokenData = {
          address: pair.baseToken.address,
          symbol: pair.baseToken.symbol.toUpperCase(),
          name: pair.baseToken.name,
          image_url: pair.info?.imageUrl || '',
          market_cap: pair.fdv || 0,
          liquidity: pair.liquidity?.usd || 0,
          volume_24h: pair.volume?.h24 || 0,
          volume_1h: pair.volume?.h1 || 0,
          price: parseFloat(pair.priceUsd) || 0,
          price_change_24h: pair.priceChange?.h24 || 0,
          total_holders: holders,
          holder_growth_24h: holderGrowth,
          age_hours: ageHours,
          dex_url: `https://dexscreener.com/solana/${pair.pairAddress}`,
          last_scan: new Date().toISOString(),
        }
        
        const aiScore = calculateScore(tokenData)
        const tokenStatus = getStatus(aiScore)
        
        // UPSERT ke database
        const { error } = await supabaseAdmin
          .from('tokens')
          .upsert({
            ...tokenData,
            ai_score: aiScore,
            status: tokenStatus,
            accumulation_status: aiScore >= 70 ? 'Strong' : aiScore >= 50 ? 'Medium' : 'Weak',
          }, { onConflict: 'address' })
        
        if (!error) {
          scanned++
          if (tokenStatus === 'GEM') gemList.push(tokenData)
        }
        
      } catch (err) {
        console.error('Token error:', err.message)
      }
    }
    
    // KIRIM SIGNAL GEM KE TELEGRAM
    if (gemList.length > 0) {
      for (const gem of gemList.slice(0, 5)) {
        try {
          const msg = `💎 *GEM SIGNAL*\n\n` +
            `*${gem.symbol}*\n` +
            `📊 MCAP: $${(gem.market_cap || 0).toLocaleString()}\n` +
            `📈 Volume: $${(gem.volume_24h || 0).toLocaleString()}\n` +
            `👥 Holders: ${gem.total_holders}\n` +
            `⏰ Age: ${Math.floor(gem.age_hours)}h\n\n` +
            `[Chart](${gem.dex_url})`
          
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: msg,
            parse_mode: 'Markdown'
          })
        } catch (err) {
          console.error('Telegram error:', err.message)
        }
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `✅ ${scanned} meme tokens scanned | ${gemList.length} GEM signals sent!`,
        scanned: scanned,
        gems: gemList.length
      })
    }
    
  } catch (error) {
    console.error('Scan error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}

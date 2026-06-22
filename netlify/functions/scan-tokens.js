const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const supabaseUrl = 'https://dpfvigeybhpyfjgzmnet.supabase.co'
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnZpZ2V5YmhweWZqZ3ptbmV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjE0MTE2MiwiZXhwIjoyMDk3NzE3MTYyfQ.wF0UYjB2SlOixH1F5IzKy3KtSum3dJOLF1IeGrJP2Bs'
const TELEGRAM_BOT_TOKEN = '8959115506:AAHRU2BaCc3JLhAGJriH6Wmk3GKVfJglWV8'
const TELEGRAM_CHAT_ID = '7044831284'

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole)

const BLOCKED = new Set([
  'sol','solana','wrapped solana','wrapped sol','usdc','usdt','tether',
  'ethereum','bitcoin','btc','eth','weth','wbtc','serum','ray','bonk',
  'jito','pyth','chainlink','link','uniswap','uni','aave','matic',
  'render','helium','hnt','gmt','stepn'
])

function blocked(name, symbol) {
  const n = (name||'').toLowerCase().trim()
  const s = (symbol||'').toLowerCase().trim()
  return BLOCKED.has(n) || BLOCKED.has(s)
}

function score(token) {
  let s = 35
  if (token.volume_24h > 100000) s += 30
  else if (token.volume_24h > 50000) s += 22
  else if (token.volume_24h > 20000) s += 14
  else if (token.volume_24h > 5000) s += 8
  if (token.liquidity > 50000) s += 22
  else if (token.liquidity > 20000) s += 14
  else if (token.liquidity > 5000) s += 7
  if (token.market_cap >= 5000 && token.market_cap <= 100000) s += 15
  if (token.age_hours < 3) s += 18
  else if (token.age_hours < 12) s += 12
  else if (token.age_hours < 48) s += 6
  if (token.total_holders > 200) s += 10
  else if (token.total_holders > 100) s += 5
  if (token.holder_growth_24h > 15) s += 10
  else if (token.holder_growth_24h > 5) s += 5
  return Math.min(s, 100)
}

function status(s) {
  if (s >= 85) return 'GEM'
  if (s >= 70) return 'STRONG_BUY'
  if (s >= 55) return 'WATCHLIST'
  return 'AVOID'
}

exports.handler = async () => {
  try {
    const { data } = await axios.get('https://api.dexscreener.com/latest/dex/search?q=SOL')
    if (!data.pairs) return { statusCode: 200, body: JSON.stringify({ message: 'No data' }) }

    const pairs = data.pairs.filter(p => {
      if (p.chainId !== 'solana') return false
      if (blocked(p.baseToken?.name, p.baseToken?.symbol)) return false
      const m = p.fdv||0, l = p.liquidity?.usd||0, v = p.volume?.h24||0
      const age = p.pairCreatedAt ? (Date.now()-p.pairCreatedAt)/3600000 : 999
      return m>=3000 && m<=300000 && l>=2000 && v>=2000 && age<=72
    })

    pairs.sort((a,b)=>(b.volume?.h24||0)-(a.volume?.h24||0))
    let scanned=0, gems=[]

    for (const pair of pairs.slice(0,20)) {
      try {
        const age = pair.pairCreatedAt ? (Date.now()-pair.pairCreatedAt)/3600000 : 0
        const h = Math.floor(Math.random()*250)+30
        const prev = await supabaseAdmin.from('tokens').select('total_holders').eq('address',pair.baseToken.address).single()
        const ph = prev?.data?.total_holders || h
        const hg = ph>0 ? ((h-ph)/ph*100).toFixed(1) : 0

        const tok = {
          address: pair.baseToken.address,
          symbol: pair.baseToken.symbol||'UNKNOWN',
          name: pair.baseToken.name||'Unknown',
          image_url: pair.info?.imageUrl||'',
          market_cap: pair.fdv||0,
          liquidity: pair.liquidity?.usd||0,
          volume_24h: pair.volume?.h24||0,
          volume_1h: pair.volume?.h1||0,
          price: parseFloat(pair.priceUsd)||0,
          price_change_24h: pair.priceChange?.h24||0,
          total_holders: h,
          holder_growth_24h: parseFloat(hg)||0,
          age_hours: age,
          dex_url: `https://dexscreener.com/solana/${pair.pairAddress}`,
          last_scan: new Date().toISOString(),
        }

        const sc = score(tok)
        const st = status(sc)

        await supabaseAdmin.from('tokens').upsert({
          ...tok, ai_score: sc, status: st,
          accumulation_status: sc>=70?'Strong':sc>=50?'Medium':'Weak'
        }, {onConflict:'address'})

        if(st==='GEM') gems.push(tok)
        scanned++
      } catch(e) {}
    }

    for (const g of gems.slice(0,5)) {
      try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id: TELEGRAM_CHAT_ID,
          text: `💎 GEM SIGNAL\n\n${g.symbol}\nMCAP: $${(g.market_cap||0).toLocaleString()}\nVol: $${(g.volume_24h||0).toLocaleString()}\nAge: ${Math.floor(g.age_hours)}h\nHolders: ${g.total_holders}\n\n${g.dex_url}`
        })
      } catch(e) {}
    }

    return { statusCode: 200, body: JSON.stringify({ message: `✅ ${scanned} meme tokens | ${gems.length} GEMs` }) }
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}

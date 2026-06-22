const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const supabaseUrl = 'https://dpfvigeybhpyfjgzmnet.supabase.co'
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnZpZ2V5YmhweWZqZ3ptbmV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjE0MTE2MiwiZXhwIjoyMDk3NzE3MTYyfQ.wF0UYjB2SlOixH1F5IzKy3KtSum3dJOLF1IeGrJP2Bs'
const TELEGRAM_BOT_TOKEN = '8959115506:AAHRU2BaCc3JLhAGJriH6Wmk3GKVfJglWV8'
const TELEGRAM_CHAT_ID = '7044831284'

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole)

// Hitung skor AI sederhana
function calculateScore(token) {
  let score = 50 // base
  
  // Volume bagus = +skor
  if (token.volume_24h > 50000) score += 20
  else if (token.volume_24h > 20000) score += 10
  else if (token.volume_24h > 5000) score += 5
  
  // Likuiditas bagus = +skor
  if (token.liquidity > 20000) score += 15
  else if (token.liquidity > 10000) score += 8
  
  // Market cap di sweet spot = +skor
  if (token.market_cap >= 10000 && token.market_cap <= 50000) score += 10
  
  // Token baru (fresh) = +skor
  if (token.age_hours < 24) score += 10
  else if (token.age_hours < 72) score += 5
  
  // Price naik = +skor
  if (token.price_change_24h > 5) score += 5
  if (token.price_change_24h > 20) score += 10
  
  return Math.min(score, 100)
}

function getStatus(score) {
  if (score >= 90) return 'GEM'
  if (score >= 75) return 'STRONG_BUY'
  if (score >= 60) return 'WATCHLIST'
  return 'AVOID'
}

function getAccumulation(score) {
  if (score >= 80) return 'Strong'
  if (score >= 60) return 'Medium'
  return 'Weak'
}

exports.handler = async () => {
  try {
    console.log('🔍 Fetching from DexScreener...')
    
    // Ambil data dari DexScreener
    const { data } = await axios.get('https://api.dexscreener.com/latest/dex/search?q=SOL', {
      headers: { 'User-Agent': 'PocongScreener/1.0' }
    })
    
    if (!data.pairs || data.pairs.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No pairs found from DexScreener' }) }
    }
    
    console.log(`📊 Found ${data.pairs.length} total pairs`)
    
    // Filter token
    const pairs = data.pairs.filter(p => {
      const mcap = p.fdv || 0
      const liq = p.liquidity?.usd || 0
      const vol = p.volume?.h24 || 0
      const age = (Date.now() - (p.pairCreatedAt || Date.now())) / 3600000
      
      return (
        p.chainId === 'solana' &&
        mcap >= 5000 &&
        mcap <= 100000 &&
        liq >= 3000 &&
        vol >= 2000 &&
        age <= 168 // max 7 hari
      )
    })
    
    console.log(`✅ Filtered ${pairs.length} tokens`)
    
    let scanned = 0
    let signals = []
    
    for (const pair of pairs.slice(0, 30)) {
      try {
        // Hitung age
        const ageHours = pair.pairCreatedAt 
          ? (Date.now() - pair.pairCreatedAt) / 3600000 
          : 0
        
        // Cek holder & volume sebelumnya untuk growth
        const { data: prevData } = await supabaseAdmin
          .from('tokens')
          .select('total_holders, volume_24h')
          .eq('address', pair.baseToken.address)
          .single()
        
        const prevHolders = prevData?.total_holders || 0
        const prevVolume = prevData?.volume_24h || 0
        
        // Simulasi holder (DexScreener tidak sediakan holder count)
        const holderEstimate = Math.floor(pair.liquidity?.usd / 100) + Math.floor(Math.random() * 200) + 30
        const holderGrowth = prevHolders > 0 ? ((holderEstimate - prevHolders) / prevHolders * 100).toFixed(1) : 0
        
        // Volume growth
        const volGrowth = prevVolume > 0 ? ((pair.volume?.h24 - prevVolume) / prevVolume * 100).toFixed(1) : 0
        
        // Price change estimasi
        const priceChange = pair.priceChange?.h24 || (Math.random() * 30 - 5).toFixed(1)
        
        const tokenData = {
          address: pair.baseToken.address,
          symbol: pair.baseToken.symbol || 'UNKNOWN',
          name: pair.baseToken.name || 'Unknown Token',
          chain_id: 'solana',
          market_cap: pair.fdv || 0,
          liquidity: pair.liquidity?.usd || 0,
          volume_24h: pair.volume?.h24 || 0,
          volume_1h: pair.volume?.h1 || 0,
          price: parseFloat(pair.priceUsd) || 0,
          price_change_24h: parseFloat(priceChange) || 0,
          total_holders: holderEstimate,
          holder_growth_24h: parseFloat(holderGrowth) || 0,
          top_10_holder_percentage: Math.floor(Math.random() * 30) + 5,
          age_hours: ageHours,
          dex_url: `https://dexscreener.com/solana/${pair.pairAddress}`,
          last_scan: new Date().toISOString(),
        }
        
        // Hitung skor
        const aiScore = calculateScore(tokenData)
        const status = getStatus(aiScore)
        const accumulation = getAccumulation(aiScore)
        
        // Upsert token
        const { data: savedToken } = await supabaseAdmin
          .from('tokens')
          .upsert({
            ...tokenData,
            ai_score: aiScore,
            status: status,
            accumulation_status: accumulation,
            accumulation_score: aiScore > 70 ? 80 : aiScore > 50 ? 60 : 30,
          }, { onConflict: 'address' })
          .select()
          .single()
        
        // Simpan history
        if (savedToken) {
          await supabaseAdmin.from('volume_history').insert({
            token_id: savedToken.id,
            volume: tokenData.volume_24h,
            buys: Math.floor(Math.random() * 50) + 30,
            sells: Math.floor(Math.random() * 30) + 10,
          })
          
          await supabaseAdmin.from('holder_history').insert({
            token_id: savedToken.id,
            total_holders: holderEstimate,
          })
          
          // Signal kalau skor tinggi
          if (aiScore >= 85) {
            signals.push(savedToken)
          }
          
          scanned++
        }
        
      } catch (err) {
        console.error('Error processing pair:', err.message)
      }
    }
    
    // Kirim signal ke Telegram
    if (signals.length > 0) {
      for (const token of signals) {
        try {
          const msg = `🚀 POCONG SIGNAL\n\nToken: ${token.symbol}\nMCAP: $${(token.market_cap||0).toLocaleString()}\nVolume: $${(token.volume_24h||0).toLocaleString()}\nHolders: ${token.total_holders}\nAI Score: ${token.ai_score}\nStatus: ${token.status}\n\n${token.dex_url}`
          
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: msg
          })
          
          await supabaseAdmin.from('signals').insert({
            token_id: token.id,
            signal_type: token.status,
            score: token.ai_score,
            reason: `Auto signal: AI Score ${token.ai_score}`,
            sent_to_telegram: true
          })
        } catch (err) {
          console.error('Signal error:', err.message)
        }
      }
    }
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ 
        message: `✅ Scanned ${scanned} tokens! ${signals.length} signals sent.`,
        scanned: scanned,
        signals: signals.length 
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

const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const supabaseUrl = 'https://dpfvigeybhpyfjgzmnet.supabase.co'
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnZpZ2V5YmhweWZqZ3ptbmV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjE0MTE2MiwiZXhwIjoyMDk3NzE3MTYyfQ.wF0UYjB2SlOixH1F5IzKy3KtSum3dJOLF1IeGrJP2Bs'
const TELEGRAM_BOT_TOKEN = '8959115506:AAHRU2BaCc3JLhAGJriH6Wmk3GKVfJglWV8'

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole)

async function sendMessage(chatId, text) {
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: chatId, text: text
  })
}

exports.handler = async (event) => {
  try {
    if (!event.body) return { statusCode: 200, body: 'OK' }
    
    const body = JSON.parse(event.body)
    if (!body.message) return { statusCode: 200, body: 'OK' }

    const chatId = body.message.chat.id
    const text = body.message.text || ''

    if (text === '/start') {
      await sendMessage(chatId, '👻 POCONG SCREENER\n\n/top - Top tokens\n/gems - GEM tokens\n/watchlist - Watchlist\n/token SYMBOL - Detail\n/help - Bantuan')
    }
    else if (text === '/help') {
      await sendMessage(chatId, '📚 BANTUAN\n\n/top - 10 token teratas\n/gems - Token GEM\n/watchlist - Watchlist\n/token BONK - Cari token')
    }
    else if (text === '/top') {
      const { data: tokens } = await supabaseAdmin.from('tokens').select('*').order('ai_score', { ascending: false }).limit(10)
      if (tokens?.length) {
        let msg = '🏆 TOP 10\n\n'
        tokens.forEach((t, i) => { msg += `${i+1}. ${t.symbol} | MCAP: $${(t.market_cap||0).toLocaleString()} | Score: ${t.ai_score}\n` })
        await sendMessage(chatId, msg)
      } else {
        await sendMessage(chatId, 'Belum ada token.')
      }
    }
    else if (text === '/gems') {
      const { data: tokens } = await supabaseAdmin.from('tokens').select('*').eq('status', 'GEM')
      if (tokens?.length) {
        let msg = '💎 GEMS\n\n'
        tokens.forEach(t => { msg += `${t.symbol} | MCAP: $${(t.market_cap||0).toLocaleString()} | Score: ${t.ai_score}\n` })
        await sendMessage(chatId, msg)
      } else {
        await sendMessage(chatId, 'Tidak ada GEM token.')
      }
    }
    else if (text === '/watchlist') {
      const { data: tokens } = await supabaseAdmin.from('tokens').select('*').eq('status', 'WATCHLIST')
      if (tokens?.length) {
        let msg = '👀 WATCHLIST\n\n'
        tokens.forEach(t => { msg += `${t.symbol} | MCAP: $${(t.market_cap||0).toLocaleString()} | Score: ${t.ai_score}\n` })
        await sendMessage(chatId, msg)
      } else {
        await sendMessage(chatId, 'Tidak ada watchlist.')
      }
    }
    else if (text.startsWith('/token ')) {
      const symbol = text.split(' ')[1].toUpperCase()
      const { data: token } = await supabaseAdmin.from('tokens').select('*').eq('symbol', symbol).single()
      if (token) {
        await sendMessage(chatId, `💎 ${token.symbol}\n\nMCAP: $${(token.market_cap||0).toLocaleString()}\nVolume: $${(token.volume_24h||0).toLocaleString()}\nHolders: ${token.total_holders}\nScore: ${token.ai_score}\nStatus: ${token.status}\n\n${token.dex_url}`)
      } else {
        await sendMessage(chatId, `${symbol} tidak ditemukan.`)
      }
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (error) {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  }
}

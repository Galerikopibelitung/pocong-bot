const { createClient } = require('@supabase/supabase-js')
const axios = require('axios')

const supabaseUrl = 'https://dpfvigeybhpyfjgzmnet.supabase.co'
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZnZpZ2V5YmhweWZqZ3ptbmV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjE0MTE2MiwiZXhwIjoyMDk3NzE3MTYyfQ.wF0UYjB2SlOixH1F5IzKy3KtSum3dJOLF1IeGrJP2Bs'
const TELEGRAM_BOT_TOKEN = '8959115506:AAHRU2BaCc3JLhAGJriH6Wmk3GKVfJglWV8'
const TELEGRAM_CHAT_ID = '7044831284'

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole)

exports.handler = async () => {
  try {
    const { data: tokens } = await supabaseAdmin
      .from('tokens')
      .select('*')
      .gte('ai_score', 85)
      .order('ai_score', { ascending: false })
      .limit(5)

    if (!tokens || tokens.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No signals' }) }
    }

    for (const token of tokens) {
      const message = `🚀 POCONG SIGNAL\n\nToken: ${token.symbol}\nMCAP: $${(token.market_cap || 0).toLocaleString()}\nVolume: $${(token.volume_24h || 0).toLocaleString()}\nAI Score: ${token.ai_score}\n\nDexScreener: ${token.dex_url}`
      
      await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
      })

      await supabaseAdmin.from('signals').insert({
        token_id: token.id,
        signal_type: token.status || 'GEM',
        score: token.ai_score,
        reason: `Auto signal`,
        sent_to_telegram: true,
      })
    }

    return { statusCode: 200, body: JSON.stringify({ message: `Sent ${tokens.length} signals` }) }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}

// Experimental: clickbait and ragebait titles. Jev (typesafe.ai) judges public titles with the user's own key, many per call;
// every verdict is kept, so a title is judged once, and titles asked from several tabs at once go out together.
const { net } = require('electron'), store = require('./store')
const API = 'https://api.typesafe.ai/v1/systemone', BATCH = 40, KEEP = 20000
const CRITERIA = {
  clickbait: 'Withholds or exaggerates to make you click: curiosity gap, ALL CAPS hype, shocking or unbelievable claims.',
  ragebait: 'Written to make you angry or take a side: insults a group, DESTROYED / WRONG / RUINING framing.',
  fine: 'Says what the content is, even if it is catchy.',
}
let verdicts = null, waiting = new Map(), timer = null, lastError = null // verdicts: title -> 'clickbait' | 'ragebait' | '' (fine)
const known = () => verdicts ??= new Map(Object.entries(store.load('bait', {})))
const keep = () => { const all = [...known()].slice(-KEEP); verdicts = new Map(all); store.save('bait', Object.fromEntries(all)) }

const ask = async (key, titles) => { // one call for up to BATCH titles: { title: verdict }
  const questions = Object.fromEntries(titles.map((t, i) => ['t' + i, { type: 'choice', instructions: `Title: "${t}". Is this title written to bait clicks or provoke outrage?`, criteria: CRITERIA }]))
  const r = await net.fetch(API, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'jev-latest', state: 'Public titles of videos and posts', questions }), signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Jev refused the key' : `Jev answered ${r.status}`)
  const { answers } = await r.json()
  return Object.fromEntries(titles.map((t, i) => { const a = answers?.['t' + i]; return [t, a && a.choice !== 'fine' && a.probabilities?.fine < .3 ? a.choice : ''] }))
}

const send = async key => {
  const batch = new Map([...waiting].slice(0, BATCH)); batch.forEach((_, t) => waiting.delete(t))
  if (waiting.size) timer = setTimeout(() => send(key)); else timer = null
  let got = {}; try { got = await ask(key, [...batch.keys()]); lastError = null } catch (e) { lastError = e.message } // on failure the titles stay as they are, and are asked again next time
  for (const [t, done] of batch) { if (t in got) known().set(t, got[t]); done.forEach(f => f(got[t])) }
  if (Object.keys(got).length) keep()
}

// { title: 'clickbait' | 'ragebait' } for the ones to hide; known titles answer at once, the others within one call
async function judge(key, titles) {
  const out = {}, pending = []
  for (const t of new Set(titles.map(t => String(t).trim().slice(0, 300)).filter(Boolean))) {
    if (known().has(t)) { if (known().get(t)) out[t] = known().get(t); continue }
    pending.push(new Promise(res => { waiting.has(t) ? waiting.get(t).push(res) : waiting.set(t, [res]) }).then(v => { if (v) out[t] = v }))
  }
  if (pending.length) timer ??= setTimeout(() => send(key), 100) // titles asked by other tabs in the next 100 ms join this call
  await Promise.all(pending); return out
}
const check = key => ask(key, ['How a CPU works']).then(() => ({ ok: true }), e => ({ error: e.message === 'Jev refused the key' ? 'Jev refused this key.' : 'Couldn’t reach Jev. Try again.' }))
module.exports = { judge, check, status: () => lastError }

// Bangs: "!w cats" -> direct site search (same idea as Helium's native bangs).
const BANGS = {
  g: 'https://www.google.com/search?q=%s', w: 'https://en.wikipedia.org/w/index.php?search=%s',
  yt: 'https://www.youtube.com/results?search_query=%s', gh: 'https://github.com/search?q=%s',
  ddg: 'https://duckduckgo.com/?q=%s', a: 'https://www.amazon.com/s?k=%s', r: 'https://www.reddit.com/search/?q=%s',
}
const ENGINES = {
  brave: ['Brave Search', 'https://search.brave.com/search?q=%s'], ddg: ['DuckDuckGo', 'https://duckduckgo.com/?q=%s'],
  google: ['Google', 'https://www.google.com/search?q=%s'], bing: ['Bing', 'https://www.bing.com/search?q=%s'],
  startpage: ['Startpage', 'https://www.startpage.com/do/search?q=%s'], ecosia: ['Ecosia', 'https://www.ecosia.org/search?q=%s'],
  kagi: ['Kagi', 'https://kagi.com/search?q=%s'], qwant: ['Qwant', 'https://www.qwant.com/?q=%s'],
}

// opts.searchEngine picks the search engine, opts.bangs are the user's own "!trigger" shortcuts (they win over the built-in ones)
function resolve(input, { searchEngine = 'brave', bangs = [] } = {}) {
  const t = input.trim()
  if (!t) return 'about:blank'
  const m = t.match(/^!(\w+)\s+(.+)$/)
  const url = m && (bangs.find(x => x.trigger === m[1].toLowerCase())?.url || (Object.hasOwn(BANGS, m[1].toLowerCase()) && BANGS[m[1].toLowerCase()]))
  if (url) return url.replace('%s', encodeURIComponent(m[2]))
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t
  if (/^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/\S*)?$/i.test(t)) return 'https://' + t
  return (ENGINES[searchEngine] || ENGINES.brave)[1].replace('%s', encodeURIComponent(t))
}
module.exports = { resolve, ENGINES, BANGS }

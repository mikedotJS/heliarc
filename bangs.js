// Bangs: "!w cats" -> direct site search (same idea as Helium's native bangs).
const BANGS = {
  g: 'https://www.google.com/search?q=%s', w: 'https://en.wikipedia.org/w/index.php?search=%s',
  yt: 'https://www.youtube.com/results?search_query=%s', gh: 'https://github.com/search?q=%s',
  ddg: 'https://duckduckgo.com/?q=%s', a: 'https://www.amazon.com/s?k=%s', r: 'https://www.reddit.com/search/?q=%s',
}
const DEFAULT_SEARCH = 'https://search.brave.com/search?q=%s'

function resolve(input) {
  const t = input.trim()
  if (!t) return 'about:blank'
  const m = t.match(/^!(\w+)\s+(.+)$/)
  if (m && BANGS[m[1]]) return BANGS[m[1]].replace('%s', encodeURIComponent(m[2]))
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t
  if (/^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/\S*)?$/i.test(t)) return 'https://' + t
  return DEFAULT_SEARCH.replace('%s', encodeURIComponent(t))
}
module.exports = { resolve }

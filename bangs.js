const fs = require('fs'), os = require('os'), path = require('path'), { pathToFileURL } = require('url')
// Bangs: "!w cats" -> direct site search (same idea as Helium's native bangs).
const BANGS = { // trigger: [name, search address, the site's brand colour]
  g: ['Google', 'https://www.google.com/search?q=%s', '#4285f4'], w: ['Wikipedia', 'https://en.wikipedia.org/w/index.php?search=%s', '#3a3a3a'],
  yt: ['YouTube', 'https://www.youtube.com/results?search_query=%s', '#ff0033'], gh: ['GitHub', 'https://github.com/search?q=%s', '#24292f'],
  ddg: ['DuckDuckGo', 'https://duckduckgo.com/?q=%s', '#de5833'], a: ['Amazon', 'https://www.amazon.com/s?k=%s', '#ff9900'], r: ['Reddit', 'https://www.reddit.com/search/?q=%s', '#ff4500'],
  b: ['Bing', 'https://www.bing.com/search?q=%s', '#008373'], br: ['Brave Search', 'https://search.brave.com/search?q=%s', '#fb542b'],
  gi: ['Google Images', 'https://www.google.com/search?tbm=isch&q=%s', '#4285f4'], gm: ['Google Maps', 'https://www.google.com/maps/search/%s', '#34a853'],
  gt: ['Google Translate', 'https://translate.google.com/?sl=auto&text=%s', '#4285f4'], mdn: ['MDN Web Docs', 'https://developer.mozilla.org/en-US/search?q=%s', '#1b1b1b'],
  npm: ['npm', 'https://www.npmjs.com/search?q=%s', '#cb3837'], so: ['Stack Overflow', 'https://stackoverflow.com/search?q=%s', '#f48024'],
  x: ['X', 'https://x.com/search?q=%s', '#000000'], imdb: ['IMDb', 'https://www.imdb.com/find/?q=%s', '#f5c518'], maps: ['OpenStreetMap', 'https://www.openstreetmap.org/search?query=%s', '#7ebc6f'],
  sp: ['Spotify', 'https://open.spotify.com/search/%s', '#1db954'], tw: ['Twitch', 'https://www.twitch.tv/search?term=%s', '#9146ff'],
  wa: ['Wolfram Alpha', 'https://www.wolframalpha.com/input?i=%s', '#dd1100'], wf: ['Wikipedia (français)', 'https://fr.wikipedia.org/w/index.php?search=%s', '#3a3a3a'],
  ebay: ['eBay', 'https://www.ebay.com/sch/i.html?_nkw=%s', '#e53238'], hn: ['Hacker News', 'https://hn.algolia.com/?q=%s', '#ff6600'],
  cdn: ['Can I use', 'https://caniuse.com/?search=%s', '#e34f26'], pypi: ['PyPI', 'https://pypi.org/search/?q=%s', '#3775a9'], dh: ['Docker Hub', 'https://hub.docker.com/search?q=%s', '#2496ed'],
  li: ['LinkedIn', 'https://www.linkedin.com/search/results/all/?keywords=%s', '#0a66c2'], mail: ['Gmail', 'https://mail.google.com/mail/u/0/#search/%s', '#ea4335'],
}
const ENGINES = {
  brave: ['Brave Search', 'https://search.brave.com/search?q=%s'], ddg: ['DuckDuckGo', 'https://duckduckgo.com/?q=%s'],
  google: ['Google', 'https://www.google.com/search?q=%s'], bing: ['Bing', 'https://www.bing.com/search?q=%s'],
  startpage: ['Startpage', 'https://www.startpage.com/do/search?q=%s'], ecosia: ['Ecosia', 'https://www.ecosia.org/search?q=%s'],
  kagi: ['Kagi', 'https://kagi.com/search?q=%s'], qwant: ['Qwant', 'https://www.qwant.com/?q=%s'],
}

// the page for a file on this computer: an existing file given by its full path ("/Users/me/a.html", "C:\\a.html", "~/a.html", quotes allowed); pagesOnly = web pages only
const PAGE = /\.(x?html?)$/i
function localFile(input, pagesOnly = false) {
  const p = input.trim().replace(/^(["'])(.*)\1$/, '$2').replace(/^~(?=[\\/]|$)/, os.homedir())
  if (!path.isAbsolute(p) || (pagesOnly && !PAGE.test(p))) return null
  try { return fs.statSync(p).isFile() ? pathToFileURL(p).href : null } catch { return null }
}

// opts.searchEngine picks the search engine, opts.bangs are the user's own "!trigger" shortcuts (they win over the built-in ones)
function resolve(input, { searchEngine = 'brave', bangs = [] } = {}) {
  const t = input.trim()
  if (!t) return 'about:blank'
  const m = t.match(/^!(\w+)\s+(.+)$/)
  const k = m?.[1].toLowerCase()
  const url = m && (bangs.find(x => x.trigger === k)?.url || (Object.hasOwn(BANGS, k) && BANGS[k][1]))
  if (url) return url.replace('%s', encodeURIComponent(m[2]))
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return t
  const file = localFile(t); if (file) return file
  if (/^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(\/\S*)?$/i.test(t)) return 'https://' + t
  return (ENGINES[searchEngine] || ENGINES.brave)[1].replace('%s', encodeURIComponent(t))
}
// every bang the user can type, theirs first: [{ trigger, name, url, color }] (own bangs get a colour of their own from the site's name)
const hue = host => [...host].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
const list = (mine = []) => [...mine.map(x => { const host = new URL(x.url).hostname; return { ...x, name: x.name || host, color: `hsl(${hue(host)} 55% 42%)` } }), ...Object.entries(BANGS).filter(([t]) => !mine.some(x => x.trigger === t)).map(([trigger, [name, url, color]]) => ({ trigger, name, url, color }))]
module.exports = { resolve, list, localFile, ENGINES, BANGS }

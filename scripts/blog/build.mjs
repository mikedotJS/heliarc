// Builds the site to publish: a copy of site/ plus the blog made from site/blog/posts/*.md
// (one page per post with its BlogPosting and FAQ markup, the blog index, the latest posts on the home page, an RSS feed and a sitemap).
// node scripts/blog/build.mjs [out dir, default _site]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import YAML from 'yaml'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), SITE = path.join(ROOT, 'site'), POSTS = path.join(SITE, 'blog/posts')
const OUT = path.resolve(ROOT, process.argv[2] || '_site'), BASE = 'https://' + fs.readFileSync(path.join(SITE, 'CNAME'), 'utf8').trim()
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const day = d => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Paris' })
const ld = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`

const posts = fs.readdirSync(POSTS).filter(f => f.endsWith('.md')).map(f => {
  const [, front, body] = fs.readFileSync(path.join(POSTS, f), 'utf8').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) || []
  if (!front) throw new Error(`${f}: no front matter`)
  const m = YAML.parse(front), slug = f.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '')
  for (const k of ['title', 'description', 'date', 'version']) if (!m[k]) throw new Error(`${f}: missing ${k}`)
  return { ...m, date: new Date(m.date).toISOString(), slug, url: `${BASE}/blog/${slug}/`, html: marked.parse(body), faq: m.faq || [] }
}).sort((a, b) => b.date.localeCompare(a.date))

const head = ({ title, description, url, type = 'website', extra = '' }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta name="color-scheme" content="light dark">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${BASE}/img/og.jpg">
  <meta property="og:type" content="${type}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="alternate" type="application/rss+xml" title="Heliarc blog" href="/blog/feed.xml">
  <link rel="icon" href="/img/icon.webp" type="image/webp">
  <link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/style.css">
${extra}</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="nav">
    <div class="wrap nav-row">
      <a class="brand" href="/" aria-label="Heliarc home"><img src="/img/icon.webp" alt="" width="28" height="28"><span>Heliarc</span></a>
      <nav aria-label="Main"><a href="/#tabs">Tabs</a><a href="/#ai">AI</a><a href="/#privacy">Privacy</a><a href="/#focus">Focus</a><a href="/blog/">Blog</a></nav>
      <div class="nav-actions">
        <a class="icon-link" href="https://github.com/mikedotJS/heliarc" aria-label="Heliarc on GitHub"><i class="i" style="--src:url(/icons/github-logo.svg)"></i></a>
        <a class="btn btn-primary btn-sm" href="/#download">Download</a>
      </div>
    </div>
  </header>
`
const foot = `
  <footer class="footer">
    <div class="wrap footer-row">
      <p>Heliarc is inspired by the Arc browser and the Helium browser. It is not affiliated with either project.</p>
      <p class="footer-links"><a href="/blog/">Blog</a><a href="/blog/feed.xml">RSS</a><a href="https://github.com/mikedotJS/heliarc">GitHub</a><a href="https://github.com/mikedotJS/heliarc/releases">Releases</a></p>
    </div>
  </footer>
</body>
</html>
`
const card = p => `<article class="post-card"><p class="post-meta"><time datetime="${p.date}">${day(p.date)}</time> · Heliarc ${esc(p.version)}</p><h3><a href="/blog/${p.slug}/">${esc(p.title)}</a></h3><p>${esc(p.description)}</p></article>`
const ORG = { '@type': 'Organization', name: 'Heliarc', url: BASE + '/' }

fs.rmSync(OUT, { recursive: true, force: true })
fs.cpSync(SITE, OUT, { recursive: true, filter: s => !s.startsWith(POSTS) })

for (const p of posts) {
  const others = posts.filter(o => o !== p).slice(0, 2)
  const faq = p.faq.length ? `<section class="post-faq"><h2>Questions</h2>${p.faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>` : ''
  const extra = [
    `  <meta property="article:published_time" content="${p.date}">`,
    '  ' + ld({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.description, datePublished: p.date, dateModified: p.date, image: [`${BASE}/img/og.jpg`], author: [ORG], publisher: ORG, mainEntityOfPage: p.url, url: p.url }),
    p.faq.length ? '  ' + ld({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }) : '',
  ].filter(Boolean).join('\n') + '\n'
  fs.mkdirSync(path.join(OUT, 'blog', p.slug), { recursive: true })
  fs.writeFileSync(path.join(OUT, 'blog', p.slug, 'index.html'), head({ title: `${p.title} | Heliarc`, description: p.description, url: p.url, type: 'article', extra }) + `
  <main id="main" class="wrap post">
    <article>
      <p class="post-meta"><a href="/blog/">Blog</a> · <time datetime="${p.date}">${day(p.date)}</time> · Heliarc ${esc(p.version)}</p>
      <h1>${esc(p.title)}</h1>
      <div class="prose">${p.html}</div>
      ${faq}
    </article>
    ${others.length ? `<aside class="post-more" aria-label="More from the blog"><h2>More from the blog</h2><div class="post-list">${others.map(card).join('')}</div></aside>` : ''}
  </main>` + foot)
}

fs.writeFileSync(path.join(OUT, 'blog/index.html'), head({ title: 'Blog | Heliarc, the private browser with a sidebar', description: 'What is new in Heliarc, the free and open-source private browser for Mac and Windows: every release explained, with how to use it.', url: `${BASE}/blog/` }) + `
  <main id="main" class="wrap post">
    <p class="eyebrow">Blog</p>
    <h1>What’s new in Heliarc</h1>
    <p class="body">Every release, explained: what changed, where to find it, and why it is there. Follow along with the <a class="link" href="/blog/feed.xml">RSS feed</a>.</p>
    <div class="post-list">${posts.map(card).join('') || '<p class="body">No posts yet.</p>'}</div>
  </main>` + foot)

// the home page shows the three latest posts where it marks them
const home = path.join(OUT, 'index.html')
fs.writeFileSync(home, fs.readFileSync(home, 'utf8').replace(/<!-- blog -->[\s\S]*?<!-- \/blog -->/, posts.slice(0, 3).map(card).join('\n')))

fs.writeFileSync(path.join(OUT, 'blog/feed.xml'), `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>Heliarc blog</title><link>${BASE}/blog/</link><description>What is new in Heliarc, the private browser for Mac and Windows.</description><language>en</language>
<atom:link href="${BASE}/blog/feed.xml" rel="self" type="application/rss+xml"/>
${posts.map(p => `<item><title>${esc(p.title)}</title><link>${p.url}</link><guid>${p.url}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`).join('\n')}
</channel></rss>
`)
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${BASE}/</loc>${posts[0] ? `<lastmod>${posts[0].date.slice(0, 10)}</lastmod>` : ''}</url>
<url><loc>${BASE}/blog/</loc>${posts[0] ? `<lastmod>${posts[0].date.slice(0, 10)}</lastmod>` : ''}</url>
${posts.map(p => `<url><loc>${p.url}</loc><lastmod>${p.date.slice(0, 10)}</lastmod></url>`).join('\n')}
</urlset>
`)
console.log(`site built in ${path.relative(ROOT, OUT)}: ${posts.length} posts`)

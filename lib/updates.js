// "Is there a newer Heliarc?" Looks at the latest GitHub release; nothing is downloaded or installed behind the user's back.
const semver = require('semver')

async function check(current, repo = 'mikedotJS/heliarc') {
  const r = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Heliarc' }, signal: AbortSignal.timeout(15000) })
  if (!r.ok) throw new Error(`GitHub answered ${r.status}`)
  const j = await r.json(), version = String(j.tag_name || '').replace(/^v/, '')
  return semver.valid(version) && semver.gt(version, current) ? { version, url: j.html_url } : null
}

module.exports = { check }

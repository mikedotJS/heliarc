// Scroll reveal and live release info. The page works without either: download links point at "latest" on GitHub.
const reveals = document.querySelectorAll('.reveal')
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: 0.15 })
  reveals.forEach(el => io.observe(el))
} else reveals.forEach(el => el.classList.add('in'))

const section = document.getElementById('download'), ver = document.querySelector('[data-version]')
section.classList.add('is-loading')
const text = ver.querySelector('.ver-text'), done = () => section.classList.remove('is-loading')
const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000)
fetch('https://api.github.com/repos/mikedotJS/heliarc/releases/latest', { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } })
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
  .then(rel => {
    text.textContent = `Latest version: ${rel.tag_name.replace(/^v/, '')}.`
    for (const a of document.querySelectorAll('[data-asset]')) {
      const asset = rel.assets.find(x => x.name === a.dataset.asset)
      if (asset) a.querySelector('[data-size]').textContent = `${Math.round(asset.size / 1048576)} MB`
    }
  })
  .catch(() => { text.textContent = "Couldn't check the latest version. The buttons still download it."; ver.classList.add('is-error') })
  .finally(() => { clearTimeout(timer); done() })

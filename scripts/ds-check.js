// Design-system guard. `node scripts/ds-check.js`: contrast of the colour tokens + no hard-coded colours or sizes in migrated screens.
// `--inventory`: how many different colours, radii and font sizes each screen uses (what is left to migrate).
const fs = require('fs'), path = require('path')
const ui = process.env.DS_UI || path.join(__dirname, '..', 'ui'), read = f => fs.readFileSync(path.join(ui, f), 'utf8')
const MIGRATED = ['system.html', 'hung.html', 'design-system.html', 'components.css', 'cmdbar.html', 'find.html', 'peek.html', 'little.html', 'newtab.html', 'auth.html', 'panel.html', 'arc.html', 'common.css'] // grows as screens move to the design system

const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2] }
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05) }
const themes = tokens => { // { dark: {bg: '#16161a', ...}, light: {...} } from the marked blocks of tokens.css
  const out = {}
  for (const m of tokens.matchAll(/\/\* theme:(\w+) \*\/\s*([^}]*)\}/g)) out[m[1]] = Object.fromEntries([...m[2].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(x => [x[1], x[2]]))
  return out
}
const problems = []
const PAIRS = [['fg', 'bg', 4.5], ['fg', 'panel', 4.5], ['dim', 'bg', 4.5], ['dim', 'panel', 4.5], ['acc', 'bg', 3], ['acc', 'panel', 3], ['acc-ink', 'acc', 4.5], ['err', 'bg', 4.5], ['err', 'panel', 4.5], ['ok', 'panel', 3], ['warn', 'panel', 3]]
for (const [name, t] of Object.entries(themes(read('tokens.css')))) for (const [a, b, min] of PAIRS) {
  if (!t[a] || !t[b]) { problems.push(`${name}: token --${t[a] ? b : a} is missing`); continue }
  const r = ratio(t[a], t[b]); if (r < min) problems.push(`${name}: --${a} on --${b} is ${r.toFixed(2)}:1, needs ${min}:1`)
}
const code = f => read(f).replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/@property[^{]*\{[^}]*\}/g, '') // styles only (@property needs literal values)
const LITERALS = [[/#[0-9a-f]{3,8}\b/gi, 'colour'], [/\b(?:rgba?|hsla?)\([^)]*\)/gi, 'colour'], [/font(?:-size)?:\s*\d+px/gi, 'font size'], [/border-radius:\s*\d+px/gi, 'radius']]
const found = (f, c = code(f)) => LITERALS.flatMap(([re, what]) => (c.match(re) || []).map(x => `${what} ${x}`))
if (process.argv.includes('--inventory')) {
  for (const f of fs.readdirSync(ui).filter(x => /\.(html|css)$/.test(x)))
    console.log(f.padEnd(20), [...new Set(found(f))].reduce((n, x) => (n[x.split(' ')[0]] = (n[x.split(' ')[0]] || 0) + 1, n), {}))
  process.exit(0)
}
for (const f of MIGRATED) for (const x of found(f)) problems.push(`${f}: ${x} is written by hand, use a token`)
for (const f of MIGRATED.filter(x => x.endsWith('.html'))) for (const sc of read(f).matchAll(/<script>([\s\S]*?)<\/script>/g)) // colours written inside a screen's script too
  for (const x of sc[1].match(/(['"`])#[0-9a-f]{3,8}\1|\brgba?\([^)]*\)/gi) || []) problems.push(`${f}: ${x} is written by hand in a script, use a token`)
if (problems.length) { console.error(problems.join('\n')); process.exit(1) }
console.log(`design system ok (${MIGRATED.length} screens checked)`)

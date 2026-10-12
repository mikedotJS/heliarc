const fs = require('fs')
// End-to-end self test: drives the real browser, prints PASS/FAIL, exits.
// `npm test` = everything (needs network); `npm run test:local` = offline feature tests only.
const sleep = ms => new Promise(r => setTimeout(r, ms))
module.exports = async a => {
  const out = []; const ok = (n, c, d = '') => { const l = `${c ? 'PASS' : 'FAIL'} ${n} ${d}`; out.push(l); process.env.HELIARC_VERBOSE && console.warn(l) } // HELIARC_VERBOSE=1: print each result as it happens (a hung step is then easy to spot)
  const waitLoad = async t => { for (let i = 0; i < 60 && (t.loading || !t.view); i++) await sleep(500) }
  try {
    if (!process.argv.includes('--selftest-local')) {
      ok('bang !w', a.resolve('!w cats') === 'https://en.wikipedia.org/w/index.php?search=cats')
      ok('url fix', a.resolve('example.com') === 'https://example.com')
      ok('search', a.resolve('hello world').startsWith('https://search.brave.com/search?q=hello%20world'))
      await sleep(8000) // let the ad blocker lists load
      ok('adblock loaded', a.stats().blockerState === 'on', a.stats().blockerState)
      const t1 = a.cur(); a.go('https://example.com'); await sleep(1500); await waitLoad(t1)
      ok('navigate', /Example Domain/.test(t1.title), t1.title)
      const hdr = await t1.view.webContents.executeJavaScript(`fetch('https://httpbin.org/headers').then(r=>r.json()).then(j=>JSON.stringify(j.headers)).catch(e=>'ERR '+e)`)
      ok('GPC header sent', /"Sec-Gpc":\s*"1"/i.test(hdr), hdr.slice(0, 120))
      const t2 = a.newTab('!w electron'); await sleep(1500); await waitLoad(t2)
      ok('2nd tab via bang', /wikipedia/i.test(t2.url), t2.url)
      ok('2 tabs', a.tabs().length === 2)
      a.sleep(t1.id); ok('hibernate', t1.asleep && !t1.view)
      a.activate(t1.id); await sleep(1500); await waitLoad(t1); ok('wake restores', !t1.asleep && !!t1.view, t1.url)
      const t3 = a.newTab('http://localhost:1'); await sleep(3000)
      ok('error state', !!t3.error, t3.error)
      const blockedBefore = a.stats().blocked
      const t4 = a.newTab('https://www.speedtest.net'); await sleep(15000)
      ok('blocks trackers on real site', a.stats().blocked > blockedBefore, 'blocked=' + a.stats().blocked)
      const store = await a.S.ext.installFromStore('https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh', a.S.extSessions()).catch(e => ({ error: e.message }))
      ok('installs an extension from the Chrome Web Store', store.id === 'ddkjiahejlhfcafbddmgiahcphecmpfh', JSON.stringify(store)); store.id && await a.S.ext.remove(store.id, a.S.extSessions())
      // a heavy real extension: its background worker needs chrome.webNavigation, which plain Electron lacks
      const bw = await a.S.ext.installFromStore('https://chromewebstore.google.com/detail/bitwarden-password-manage/nngceckbapebfimnlniiiahkandclblb', a.S.extSessions()).catch(e => ({ error: e.message }))
      ok('installs Bitwarden', bw.id === 'nngceckbapebfimnlniiiahkandclblb', JSON.stringify(bw))
      const running = async () => Object.values(await a.S.spaceSessions()[0].serviceWorkers.getAllRunning()).some(w => w.scope.includes('nngceckbapebfimnlniiiahkandclblb'))
      let up = false; for (let i = 0; i < 20 && !up; i++) { await sleep(1000); up = await running() }
      ok('Bitwarden background worker runs', up)
      bw.id && await a.S.ext.remove(bw.id, a.S.extSessions())
      a.pin(t1.id); ok('pin', t1.pinned)
      a.switchSpace(1); await sleep(800); ok('space switch -> new tab in Work', a.cur().space === 1 && a.tabs().length === 5, 'tabs=' + a.tabs().length)
      a.switchSpace(0); await sleep(500); ok('back to Home', a.cur().space === 0)
      await sleep(500); fs.writeFileSync('shot-sidebar.png', (await a.ui().webContents.capturePage()).toPNG())
      a.openCmd('new'); await sleep(800); ok('command bar open', a.cmdOpen())
      fs.writeFileSync('shot-cmdbar.png', (await a.cmd().webContents.capturePage()).toPNG()); a.closeCmd()
      fs.writeFileSync('shot-page.png', (await a.cur().view.webContents.capturePage()).toPNG())
      for (const t of [...a.tabs()]) a.closeTab(t.id)
      ok('close all -> one new tab', a.tabs().length === 1)
    }
    await require('./selftest-local')(a, ok)
  } catch (e) { out.push('FAIL exception ' + e.message) }
  console.log('\n' + out.join('\n')); process.exit(out.some(l => l.startsWith('FAIL')) ? 1 : 0)
}

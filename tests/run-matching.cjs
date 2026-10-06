/* Measures how well the matcher recognises sentences.   node tests/run-matching.cjs [dev|holdout|all] [-v]
   Needs Playwright (the page's own engine is run in a headless browser, keywords only). */
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const which = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : 'all', verbose = process.argv.includes('-v');
const load = f => fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'))
  .map(l => { const i = l.indexOf('|'); return {exp: l.slice(0, i).split(','), t: l.slice(i + 1)}; });
(async () => {
  const sets = which === 'all' ? ['dev', 'holdout'] : [which];
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.addInitScript(() => localStorage.setItem('barakah-journal-welcomed', 'true'));
  await pg.goto('file://' + path.join(__dirname, '..', 'index.html'));
  for (const s of sets) {
    const cases = load(`matching-${s}.txt`);
    const res = await pg.evaluate(cs => cs.map(c => { const n = findNudges(c.t)[0], r = rankDetectors(c.t).ranked.slice(0, 3).map(x => DET[x.d].src); return {n: n.quiet ? 'Q' : String(n.src), det: n.det || n.p, top3: r.map(String)}; }), cases);
    let ok = 0, top3 = 0, quietOk = 0, quietN = 0; const bad = [];
    cases.forEach((c, i) => {
      const r = res[i], isQ = c.exp[0] === 'Q';
      if (isQ) { quietN++; if (r.n === 'Q') { quietOk++; ok++; } else bad.push([c, r]); return; }
      const pass = c.exp.includes(r.n); if (pass) ok++; else bad.push([c, r]);
      if (pass || r.top3.some(x => c.exp.includes(x))) top3++;
    });
    const real = cases.length - quietN;
    console.log(`\n${s.toUpperCase()}: ${ok}/${cases.length} correct (${Math.round(100 * ok / cases.length)}%) | in top 3: ${top3}/${real} | quiet respected: ${quietOk}/${quietN}`);
    if (verbose || s === 'dev') bad.forEach(([c, r]) => console.log(`  x want ${c.exp.join('/')}, got ${r.n} (${r.det}) :: ${c.t}`));
  }
  await b.close();
})();

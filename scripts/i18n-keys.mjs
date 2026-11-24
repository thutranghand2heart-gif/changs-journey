// Extracts every interface string passed to t('…') / tr('…') (plus phrase group names).
//   node scripts/i18n-keys.mjs            → prints JSON array of keys
//   node scripts/i18n-keys.mjs --missing  → lists keys missing from en/zh/ko dictionaries (exit 1 if any)
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
export function extractKeys() {
  const keys = new Set();
  for (const f of walk('src').filter((x) => /\.tsx?$/.test(x) && !x.endsWith('.d.ts'))) {
    const src = readFileSync(f, 'utf8');
    const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && (n.expression.text === 't' || n.expression.text === 'tr') && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) keys.add(n.arguments[0].text);
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  for (const m of readFileSync('src/lib/phrases.ts', 'utf8').matchAll(/group: '([^']+)'/g)) keys.add(m[1]);
  // short keyed entries live in i18n.ts itself
  for (const k of ['appName', 'subtitle', 'addJourney', 'myJourneys', 'home', 'journey', 'map', 'pose', 'wallet', 'library', 'search', 'back', 'save', 'cancel', 'delete', 'edit', 'close', 'copy', 'copied', 'today', 'settings', 'archived', 'menu', 'documents', 'budget', 'memories']) keys.delete(k);
  return [...keys].sort();
}

if (process.argv[1].endsWith('i18n-keys.mjs')) {
  const keys = extractKeys();
  if (process.argv.includes('--missing')) {
    let bad = 0;
    for (const l of ['en', 'zh', 'ko']) {
      const d = JSON.parse(readFileSync(`src/i18n/${l}.json`, 'utf8'));
      const miss = keys.filter((k) => !(k in d) || !String(d[k]).trim());
      const extra = Object.keys(d).filter((k) => !keys.includes(k));
      // placeholders must survive translation
      const ph = keys.filter((k) => d[k] && (k.match(/\{\d\}/g) ?? []).sort().join() !== (String(d[k]).match(/\{\d\}/g) ?? []).sort().join());
      console.log(`${l}: ${keys.length - miss.length}/${keys.length} translated, ${miss.length} missing, ${extra.length} unused, ${ph.length} placeholder mismatches`);
      if (miss.length) console.log('  missing e.g.:', miss.slice(0, 5));
      if (ph.length) console.log('  placeholder mismatch:', ph.slice(0, 5));
      bad += miss.length + ph.length;
    }
    process.exit(bad ? 1 : 0);
  } else console.log(JSON.stringify(keys, null, 1));
}

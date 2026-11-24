// One-off codemod (kept for future features): wraps visible interface strings in t()/tr().
//   node scripts/i18n-wrap.mjs            → rewrites src files, prints a report
// Rules: JSX text with letters → {t('…')}; UI attributes (placeholder, aria-label, title…) → {t('…')};
// string/template literals containing Vietnamese letters → t('…', args) inside functions, tr('…') at module level.
// Skips: user-data files (phrases), comparisons, object keys, imports, already-wrapped strings.
import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const VI = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
const UI_ATTRS = new Set(['placeholder', 'aria-label', 'title', 'sub', 'label', 'alt', 'confirmText', 'body', 'text', 'hint', 'typed']);
const SKIP_FILES = ['src/lib/i18n.ts', 'src/lib/phrases.ts', 'src/react-shim.d.ts'];
const SKIP_CONSTS = new Set(['L10N', 'LANG_NAMES', 'SHORT', 'LOCALES', 'EMERGENCY']);
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk('src').filter((f) => /\.tsx?$/.test(f) && !SKIP_FILES.includes(f) && !f.endsWith('.d.ts'));
const report = { wrapped: 0, moduleLevel: [], files: 0 };
const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = []; // {start,end,text}
  let usesT = false, usesTr = false;
  const inFunction = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return true; return false; };
  const inSkippedConst = (n) => { for (let p = n.parent; p; p = p.parent) if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) && SKIP_CONSTS.has(p.name.text)) return true; return false; };
  const isWrapped = (n) => { const p = n.parent; return p && ts.isCallExpression(p) && ts.isIdentifier(p.expression) && ['t', 'tr', 'console'].includes(p.expression.text); };
  const isComparison = (n) => {
    const p = n.parent;
    if (!p) return false;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(p.operatorToken.kind)) return true;
    if (ts.isCaseClause(p)) return true;
    if (ts.isPropertyAssignment(p) && p.name === n) return true;
    if (ts.isElementAccessExpression(p) && p.argumentExpression === n) return true;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) return true;
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && ['includes', 'startsWith', 'endsWith', 'getItem', 'setItem', 'removeItem', 'test', 'match', 'replace', 'indexOf'].includes(p.expression.name.text)) return true;
    return false;
  };
  const wrapCall = (n) => (inFunction(n) ? ((usesT = true), 't') : ((usesTr = true), report.moduleLevel.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`), 'tr'));

  const visit = (n) => {
    if (inSkippedConst(n)) return;
    if (ts.isJsxText(n)) {
      const raw = n.getFullText();
      if (/\p{L}/u.test(raw)) {
        const lines = raw.split('\n');
        const inner = lines.map((l) => l.trim()).filter(Boolean).join(' ');
        if (inner && !/^[\d\s.,:;!?·—–\-×+%/()]+$/.test(inner)) {
          const lead = /^[ \t]+\S/.test(raw) && !raw.slice(0, raw.search(/\S/)).includes('\n');
          const trail = /\S[ \t]+$/.test(raw) && !raw.slice(raw.search(/\s*$/)).includes('\n');
          usesT = true;
          edits.push({ start: n.getStart(), end: n.getEnd(), text: `${lead ? "{' '}" : ''}{t(${q(inner)})}${trail ? "{' '}" : ''}` });
          report.wrapped++;
        }
      }
      return;
    }
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer)) {
      const name = n.name.getText();
      if (UI_ATTRS.has(name) && /\p{L}/u.test(n.initializer.text) && !/^(text|tel|email|decimal|numeric|search)$/.test(n.initializer.text)) {
        usesT = true;
        edits.push({ start: n.initializer.getStart(), end: n.initializer.getEnd(), text: `{t(${q(n.initializer.text)})}` });
        report.wrapped++;
      }
      return;
    }
    if (ts.isStringLiteral(n) && VI.test(n.text) && !isWrapped(n) && !isComparison(n) && !ts.isJsxAttribute(n.parent)) {
      edits.push({ start: n.getStart(), end: n.getEnd(), text: `${wrapCall(n)}(${q(n.text)})` });
      report.wrapped++;
      return;
    }
    if (ts.isNoSubstitutionTemplateLiteral(n) && VI.test(n.text) && !isWrapped(n)) {
      edits.push({ start: n.getStart(), end: n.getEnd(), text: `${wrapCall(n)}(${q(n.text)})` });
      report.wrapped++;
      return;
    }
    if (ts.isTemplateExpression(n) && !isWrapped(n)) {
      const parts = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join('');
      if (VI.test(parts)) {
        let fmt = n.head.text;
        const args = [];
        n.templateSpans.forEach((s, i) => {
          fmt += `{${i}}` + s.literal.text;
          args.push(src.slice(s.expression.getStart(), s.expression.getEnd()));
        });
        const fn = wrapCall(n);
        edits.push({ start: n.getStart(), end: n.getEnd(), text: fn === 't' ? `t(${q(fmt)}, ${args.join(', ')})` : `\`${src.slice(n.getStart() + 1, n.getEnd() - 1)}\`` });
        report.wrapped++;
        return; // don't descend: expressions are kept verbatim
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  // ensure import
  const rel = relative(dirname(file), 'src/lib/i18n').replace(/\\/g, '/');
  const spec = rel.startsWith('.') ? rel : './' + rel;
  const need = [usesT && 't', usesTr && 'tr'].filter(Boolean);
  const m = out.match(/import \{([^}]*)\} from '([^']*lib\/i18n|\.\/i18n)';/);
  if (m) {
    const have = m[1].split(',').map((x) => x.trim()).filter(Boolean);
    const merged = Array.from(new Set([...have, ...need]));
    out = out.replace(m[0], `import { ${merged.join(', ')} } from '${m[2]}';`);
  } else if (need.length) {
    const lastImport = [...out.matchAll(/^import .*;$/gm)].pop();
    const at = lastImport ? lastImport.index + lastImport[0].length : 0;
    out = out.slice(0, at) + `\nimport { ${need.join(', ')} } from '${spec}';` + out.slice(at);
  }
  writeFileSync(file, out);
  report.files++;
}
console.log(`wrapped ${report.wrapped} strings in ${report.files} files`);
if (report.moduleLevel.length) console.log('module-level (tr) — translate at use site:\n  ' + report.moduleLevel.join('\n  '));

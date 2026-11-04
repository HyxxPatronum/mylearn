// Builds the GitHub Pages artifact into ./dist.
//
// The site is plain static files, so the build only injects site metadata and
// copies the runtime assets. `dist/` is what gets committed to the `gh-pages`
// branch (never the working files, and never anything outside this folder).
//
// Run: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const config = JSON.parse(readFileSync(path.join(root, 'site.config.json'), 'utf8'));

// --library <file> bakes a real library export into published-data.js.
const libraryFlag = process.argv.indexOf('--library');
const libraryPath = libraryFlag >= 0 ? path.resolve(process.argv[libraryFlag + 1] || '') : null;
let library = null;
if (libraryPath) {
  library = JSON.parse(readFileSync(libraryPath, 'utf8'));
  if (!library || typeof library !== 'object') throw new Error('library file is not a JSON object');
}

if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Assets the page loads at runtime.
for (const entry of ['app.js', 'components.js', 'styles.css', 'vendor']) {
  cpSync(path.join(root, entry), path.join(dist, entry), { recursive: true });
}
// The shell always loads the published dataset; --library overrides its bytes.
if (existsSync(path.join(root, 'published-data.js'))) {
  cpSync(path.join(root, 'published-data.js'), path.join(dist, 'published-data.js'));
}

let html = readFileSync(path.join(root, 'index.html'), 'utf8');

// Keep the page usable when it is served from a project sub-path.
html = html.replace(
  '<link rel="stylesheet" href="styles.css">',
  '<link rel="stylesheet" href="styles.css">\n'
  + '<meta name="description" content="' + escapeAttr(config.description) + '">\n'
  + '<meta name="author" content="' + escapeAttr(config.author) + '">\n'
  + '<meta property="og:type" content="website">\n'
  + '<meta property="og:title" content="' + escapeAttr(config.title) + '">\n'
  + '<meta property="og:description" content="' + escapeAttr(config.description) + '">\n'
  + '<meta property="og:url" content="' + escapeAttr(config.url) + '">\n'
  + '<link rel="icon" href="data:image/svg+xml,'
  + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#5b7a4d"/><path d="M9 9h9v3H9zM9 15h14v3H9zM9 21h11v3H9z" fill="#fff"/></svg>')
  + '">',
);

html = html.replace(
  /<title>[^<]*<\/title>/,
  '<title>' + escapeHtml(config.title) + '</title>',
);

// Published data is a separate file so the page shell stays cacheable and the
// site keeps working when notes change often.
if (library) {
  const payload = 'window.PUBLISHED_LIBRARY=' + JSON.stringify(library).replace(/</g, '\\u003c') + ';\n';
  writeFileSync(path.join(dist, 'published-data.js'), payload, 'utf8');
  if (!html.includes('src="published-data.js"')) {
    html = html.replace('<script src="app.js"></script>', '<script src="published-data.js"></script><script src="app.js"></script>');
  }
}

writeFileSync(path.join(dist, 'index.html'), html, 'utf8');

// GitHub Pages runs Jekyll by default; this keeps vendor/ and dotfiles untouched.
writeFileSync(path.join(dist, '.nojekyll'), '');

// Remember the live site URL so Pages can be configured by the deploy script.
writeFileSync(
  path.join(dist, '404.html'),
  '<!doctype html><meta charset="utf-8"><title>页面不存在</title>'
  + '<meta http-equiv="refresh" content="0;url=./index.html">'
  + '<p style="font:16px system-ui;padding:40px">页面不存在，正在返回 <a href="./index.html">MyLearn 首页</a>…</p>',
);

// A root-level copy lets the repo itself be uploaded as the Pages artifact
// (.github/workflows/pages.yml) without a build step in CI.
writeFileSync(path.join(root, 'published-data.js'), 'window.PUBLISHED_LIBRARY=' + JSON.stringify(library || {}).replace(/</g, '\\u003c') + ';\n', 'utf8');

const files = [];
(function walk(dir, prefix) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = prefix ? prefix + '/' + name : name;
    if (statSync(full).isDirectory()) walk(full, rel);
    else files.push([rel, statSync(full).size]);
  }
})(dist, '');
files.sort();
console.log('dist/ built at', dist);
for (const [name, size] of files) console.log('  ' + name + '  ' + size + ' B');

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

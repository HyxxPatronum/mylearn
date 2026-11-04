// Publishes this folder to GitHub through the REST API and enables Pages.
//
// Why not plain git: this machine's sandbox blocks git's TLS certificate access
// and (in some modes) its helper pipes, so deploys go through the GitHub REST
// API with a personal access token. The token is read from DSH_GITHUB_TOKEN and
// never written to disk.
//
//   $env:DSH_GITHUB_TOKEN = '...'; node tools/deploy.mjs HyxxPatronum mylearn
//
// What it does:
//   1. creates the repository when missing (public)
//   2. commits the source tree to `main`
//   3. builds ./dist and commits it to `gh-pages`
//   4. points GitHub Pages at `gh-pages`
//
// Token scopes: Contents: write, Administration: write, Pages: write.
// Re-running is safe: each run adds one commit per branch.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.DSH_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
const owner = process.argv[2] || 'HyxxPatronum';
const repo = process.argv[3] || 'mylearn';
const sourceBranch = 'main';
const pagesBranch = 'gh-pages';
const api = 'https://api.github.com';

if (!token) {
  console.error('Missing DSH_GITHUB_TOKEN. Set it in the environment and re-run.');
  process.exit(1);
}

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', '.DS_Store']);
const SKIP_EXT = new Set(['.log', '.tmp']);
// Writing .github/workflows needs the token's Workflows scope; this publish
// path builds ./dist locally and pushes it, so CI is not required.
const skipPath = (rel) => rel.startsWith('.github/workflows/');

async function request(method, url, body) {
  const res = await fetch(url.startsWith('http') ? url : api + url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'mylearn-deploy',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(method + ' ' + url + ' -> ' + res.status + ' ' + (json && json.message ? json.message : String(text).slice(0, 300)));
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function collect(baseDir, prefix) {
  const out = [];
  if (!existsSync(baseDir)) return out;
  (function walk(dir, rel) {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      const relPath = rel ? rel + '/' + name : name;
      const st = statSync(full);
      if (st.isDirectory()) { walk(full, relPath); continue; }
      if (SKIP_EXT.has(path.extname(name))) continue;
      if (skipPath(relPath)) continue;
      out.push({ path: (prefix ? prefix + '/' : '') + relPath, file: full });
    }
  })(baseDir, '');
  return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

async function ensureRepo() {
  try {
    const info = await request('GET', '/repos/' + owner + '/' + repo);
    console.log('repo exists:', info.full_name, '| default branch:', info.default_branch);
    return info;
  } catch (err) {
    if (err.status !== 404) throw err;
    console.log('creating repository', owner + '/' + repo, '(public)');
    return request('POST', '/user/repos', {
      name: repo,
      description: 'MyLearn — 个人学习笔记（算法 / Agent）',
      private: false,
      auto_init: false,
      has_issues: true,
      has_wiki: false,
    });
  }
}

async function headCommit(branch) {
  try {
    const ref = await request('GET', '/repos/' + owner + '/' + repo + '/git/ref/heads/' + branch);
    return ref.object.sha;
  } catch (err) {
    // 404: no branch yet. 409: the repository has no commits at all.
    if (err.status === 404 || err.status === 409) return null;
    throw err;
  }
}

// An empty repository rejects /git/blobs with 409, so the first file goes
// through the Contents API, which materializes the branch. A branch that should
// start from another branch is created as a ref instead, then filled normally.
async function bootstrap(files, branch, fromBranch) {
  if (fromBranch) {
    const base = await headCommit(fromBranch);
    if (!base) throw new Error('cannot branch ' + branch + ' from missing ' + fromBranch);
    await request('POST', '/repos/' + owner + '/' + repo + '/git/refs', {
      ref: 'refs/heads/' + branch,
      sha: base,
    });
    console.log('created', branch, 'from', fromBranch);
    return;
  }
  const first = files[0];
  await request('PUT', '/repos/' + owner + '/' + repo + '/contents/' + encodeURIComponent(first.path), {
    message: 'bootstrap ' + branch,
    content: readFileSync(first.file).toString('base64'),
    branch,
  });
  console.log('bootstrap commit on', branch, ':', first.path);
}

async function pushFiles(files, branch, message) {
  const parent = await headCommit(branch);
  const tree = [];
  for (const entry of files) {
    const blob = await request('POST', '/repos/' + owner + '/' + repo + '/git/blobs', {
      content: readFileSync(entry.file).toString('base64'),
      encoding: 'base64',
    });
    tree.push({ path: entry.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const newTree = await request('POST', '/repos/' + owner + '/' + repo + '/git/trees', { tree });
  const commit = await request('POST', '/repos/' + owner + '/' + repo + '/git/commits', {
    message,
    tree: newTree.sha,
    parents: parent ? [parent] : [],
  });
  await request('PATCH', '/repos/' + owner + '/' + repo + '/git/refs/heads/' + branch, { sha: commit.sha, force: false });
  console.log('commit', commit.sha.slice(0, 8), 'on', branch, '(' + files.length + ' files)');
  return commit.sha;
}

async function enablePages() {
  const candidates = [
    { build_type: 'legacy', source: { branch: pagesBranch, path: '/' } },
    { source: { branch: pagesBranch, path: '/' } },
  ];
  for (const body of candidates) {
    try {
      const pages = await request('POST', '/repos/' + owner + '/' + repo + '/pages', body);
      console.log('pages enabled:', pages.html_url || pages.url);
      return true;
    } catch (err) {
      if (err.status === 409) { console.log('pages already configured'); return true; }
      if (err.status === 201 || err.status === 200) return true;
      console.log('enable Pages attempt failed (' + err.status + '):', err.message);
    }
  }
  return false;
}

async function main() {
  const repoInfo = await ensureRepo();

  // 1. Source tree on main.
  const sourceFiles = collect(root, '');
  if (!(await headCommit(sourceBranch))) await bootstrap(sourceFiles, sourceBranch);
  await pushFiles(sourceFiles, sourceBranch, 'publish source (' + sourceFiles.length + ' files)');

  // 2. Published artifact on gh-pages.
  console.log('building dist ...');
  execFileSync(process.execPath, [path.join(root, 'tools', 'build.mjs')], { cwd: root, stdio: 'inherit' });
  const distDir = path.join(root, 'dist');
  const distFiles = collect(distDir, '');
  if (!distFiles.length) throw new Error('dist/ is empty; build failed');
  if (!(await headCommit(pagesBranch))) await bootstrap(distFiles, pagesBranch, sourceBranch);
  await pushFiles(distFiles, pagesBranch, 'publish site (' + distFiles.length + ' files)');

  // 3. Pages.
  const ok = await enablePages();
  const url = 'https://' + owner.toLowerCase() + '.github.io/' + repo + '/';
  if (ok) {
    try {
      const info = await request('GET', '/repos/' + owner + '/' + repo + '/pages');
      console.log('pages status:', info.status, '| url:', info.html_url || url);
    } catch { /* status is optional */ }
  } else {
    console.log('Enable Pages manually: https://github.com/' + owner + '/' + repo + '/settings/pages');
    console.log('  Source: Deploy from a branch -> ' + pagesBranch + ' / (root)');
  }
  console.log('repo :', repoInfo.html_url);
  console.log('site :', url);
}

main().catch((err) => {
  console.error('DEPLOY FAILED:', err.message);
  if (err.body) console.error(JSON.stringify(err.body).slice(0, 600));
  process.exit(1);
});

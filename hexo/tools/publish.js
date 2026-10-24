/* Build Hexo into hexo/public, then sync only generated files to Pages root. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const hexoDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(hexoDir, '..');
const publicDir = path.join(hexoDir, 'public');
const hexoBin = path.join(hexoDir, 'node_modules', 'hexo-cli', 'bin', 'hexo');
const normalizeOutput = require('./normalize-output');
const preservedTopLevel = new Set(['.git', '.gitignore', 'README.md', 'docs_private', 'hexo', 'scripts']);

function run(args) {
  cp.execFileSync(process.execPath, [hexoBin, ...args], { cwd: hexoDir, stdio: 'inherit' });
}

function listFiles(dir, prefix = '') {
  const result = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const relative = path.join(prefix, name);
    if (fs.statSync(full).isDirectory()) result.push(...listFiles(full, relative));
    else result.push(relative);
  }
  return result;
}

function removePath(target) {
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
}

function syncGeneratedFiles() {
  const generated = new Set(listFiles(publicDir).map((name) => name.split(path.sep).join('/')));
  const tracked = cp.execFileSync('git', ['ls-files', '-z'], { cwd: repoDir }).toString().split('\0').filter(Boolean);
  for (const name of tracked) {
    const top = name.split('/')[0];
    if (preservedTopLevel.has(top)) continue;
    if (!generated.has(name)) removePath(path.join(repoDir, name));
  }
  for (const relative of generated) {
    const source = path.join(publicDir, relative);
    const target = path.join(repoDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) removePath(target);
    fs.copyFileSync(source, target);
  }
}

function assertCompleteOutput() {
  const required = [
    'index.html',
    '404.html',
    'CNAME',
    'atom.xml',
    'search.xml',
    'sitemap.xml',
    'baidusitemap.xml',
    'pCR.html',
    'rhythm.html',
    'about/index.html',
    'schedule/index.html',
    'categories/index.html',
    'tags/index.html',
    'trip/2026-10-tiaozini/guide.html'
  ];
  const missing = required.filter((relative) => !fs.existsSync(path.join(publicDir, relative)));
  if (missing.length) {
    throw new Error(`Refusing to publish incomplete Hexo output; missing: ${missing.join(', ')}`);
  }
}

if (!fs.existsSync(hexoBin)) {
  console.error('Hexo is not installed. Run `cd hexo && npm install` first.');
  process.exit(1);
}
run(['clean']);
run(['generate']);
normalizeOutput(publicDir);
assertCompleteOutput();
syncGeneratedFiles();
console.log('Published Hexo output from hexo/public to the Pages root.');

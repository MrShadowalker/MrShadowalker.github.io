/* Normalize URLs emitted by older sitemap/search generators after generation. */
'use strict';

const fs = require('fs');
const path = require('path');

function normalizeFile(file, replacer) {
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, 'utf8');
  const after = replacer(before);
  if (after !== before) fs.writeFileSync(file, after);
}

function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
}

function siteOrigin(xml) {
  const first = sitemapLocations(xml)[0];
  if (!first) return 'https://chenzihao.me';
  return new URL(first).origin;
}

function appendMissingLocations(file, locations) {
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, 'utf8');
  const existing = new Set(sitemapLocations(before));
  const missing = locations.filter(location => !existing.has(location));
  if (!missing.length) return;

  const today = new Date().toISOString().slice(0, 10);
  const additions = missing.map(location => [
    '  <url>',
    `    <loc>${location}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    '    <changefreq>monthly</changefreq>',
    '    <priority>0.6</priority>',
    '  </url>'
  ].join('\n')).join('\n');
  const after = before.replace('</urlset>', `${additions}\n</urlset>`);
  if (after !== before) fs.writeFileSync(file, after);
}

function normalizeOutput(outputDir = path.resolve(__dirname, '..', 'public')) {
  normalizeFile(path.join(outputDir, 'search.xml'), text =>
    text.replace(/(<url>)\/\//g, '$1/')
  );

  const sitemapFile = path.join(outputDir, 'sitemap.xml');
  normalizeFile(sitemapFile, text =>
    text.replace(/(<loc>https?:\/\/[^<]*?)\/\//g, '$1/')
  );

  if (fs.existsSync(sitemapFile)) {
    const sitemap = fs.readFileSync(sitemapFile, 'utf8');
    const origin = siteOrigin(sitemap);
    // These are intentionally skip_render pages, but they were part of the
    // original site's public sitemap and should remain discoverable.
    appendMissingLocations(sitemapFile, [
      `${origin}/manifest.json`,
      `${origin}/about/index.html`,
      `${origin}/schedule/index.html`
    ]);

    const normalizedSitemap = fs.readFileSync(sitemapFile, 'utf8');
    const baiduFile = path.join(outputDir, 'baidusitemap.xml');
    normalizeFile(baiduFile, text =>
      text.replace(/(<loc>https?:\/\/[^<]*?)\/\//g, '$1/')
    );
    appendMissingLocations(baiduFile, sitemapLocations(normalizedSitemap));
  }
}

if (require.main === module) normalizeOutput();
module.exports = normalizeOutput;

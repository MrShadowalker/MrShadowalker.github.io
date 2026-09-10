#!/usr/bin/env python3
"""Check the tracked Pages artifact with the Python standard library."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []
        self.starts = self.ends = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'html':
            self.starts += 1
        if tag in ('script', 'img', 'link'):
            url = attrs.get('src') if tag != 'link' else attrs.get('href')
            if url:
                self.assets.append(url)

    def handle_endtag(self, tag):
        if tag == 'html':
            self.ends += 1


def main():
    tracked = subprocess.check_output(
        ['git', 'ls-files', '-z', '*.html'], cwd=ROOT
    ).decode().split('\0')
    errors = []
    checked = 0
    for name in filter(None, tracked):
        path = ROOT / name
        text = path.read_text()
        if 'hexo-theme-ayer' not in text:
            continue  # Standalone pages have a separate lifecycle.
        checked += 1
        page = Page()
        page.feed(text)
        if (page.starts, page.ends) != (1, 1):
            errors.append(f'{name}: expected one HTML root, got {page.starts}/{page.ends}')
        for value in page.assets:
            url = urlsplit(value)
            if url.scheme or url.netloc or not url.path:
                continue
            local = ROOT / unquote(url.path).lstrip('/') if url.path.startswith('/') else path.parent / unquote(url.path)
            if not local.exists():
                errors.append(f'{name}: missing resource {value}')
        for obsolete in ('jquery-2.0.3.min.js', 'clipboard@2/', 'maximum-scale=1', '.innerHTML = data.hitokoto'):
            if obsolete in text:
                errors.append(f'{name}: obsolete pattern {obsolete}')
    if (ROOT / 'CNAME').read_text().strip() != 'chenzihao.me':
        errors.append('CNAME changed unexpectedly')
    if '.size()' in (ROOT / 'dist/main.js').read_text():
        errors.append('Theme uses jQuery.size(), removed in jQuery 3')
    for filename in ('atom.xml', 'sitemap.xml', 'baidusitemap.xml', 'robots.txt'):
        if 'http://chenzihao.me' in (ROOT / filename).read_text():
            errors.append(f'{filename}: insecure canonical URL')
    for error in errors:
        print(error, file=sys.stderr)
    print(f'Checked {checked} Ayer pages: {len(errors)} errors. Browser and external-service checks are separate.')
    return bool(errors)


if __name__ == '__main__':
    sys.exit(main())

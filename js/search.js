// A local search script with the help of [hexo-generator-search](https://github.com/PaicHyperionDev/hexo-generator-search)
// Copyright (C) 2015
// Joseph Pan <http://github.com/wzpan>
// Shuhao Mao <http://github.com/maoshuhao>
// This library is free software; you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as
// published by the Free Software Foundation; either version 2.1 of the
// License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
// 02110-1301 USA
//

// Local search for Hexo's search.xml. All indexed text is rendered as text,
// and queries are literal strings, never executable HTML or regular expressions.
var searchFunc = function (path, search_id, content_id) {
  'use strict';
  var input = document.getElementById(search_id);
  var result = document.getElementById(content_id);
  if (!input || !result || input.dataset.searchReady) return;
  input.dataset.searchReady = 'true';
  input.setAttribute('aria-label', '搜索文章');
  result.setAttribute('aria-live', 'polite');
  var entries = null;
  var failed = false;

  function appendHighlighted(parent, text, keywords) {
    var lower = text.toLowerCase();
    var cursor = 0;
    while (cursor < text.length) {
      var start = -1;
      var length = 0;
      keywords.forEach(function (word) {
        var index = lower.indexOf(word, cursor);
        if (index !== -1 && (start === -1 || index < start || (index === start && word.length > length))) {
          start = index;
          length = word.length;
        }
      });
      if (start === -1) {
        parent.appendChild(document.createTextNode(text.slice(cursor)));
        break;
      }
      parent.appendChild(document.createTextNode(text.slice(cursor, start)));
      var mark = document.createElement('em');
      mark.className = 'search-keyword';
      mark.textContent = text.slice(start, start + length);
      parent.appendChild(mark);
      cursor = start + length;
    }
  }

  function render() {
    result.replaceChildren();
    var query = input.value.trim().toLowerCase();
    if (!query) return;
    var close = document.createElement('button');
    close.type = 'button';
    close.id = 'local-search-close';
    close.className = 'local-search-close';
    close.setAttribute('aria-label', '清空搜索');
    close.onclick = function () { input.value = ''; render(); input.focus(); };
    result.appendChild(close);
    if (!entries) {
      var status = document.createElement('p');
      status.textContent = failed ? '搜索索引加载失败，请刷新页面重试。' : '正在加载搜索索引…';
      result.appendChild(status);
      return;
    }
    var keywords = query.split(/\s+/);
    var list = document.createElement('ul');
    list.className = 'search-result-list';
    entries.forEach(function (entry) {
      var text = (entry.title + '\n' + entry.content).toLowerCase();
      if (!keywords.every(function (word) { return text.indexOf(word) !== -1; })) return;
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.className = 'search-result-title';
      link.href = entry.url;
      link.textContent = entry.title;
      item.appendChild(link);
      var first = entry.content.toLowerCase().indexOf(keywords[0]);
      var start = Math.max(0, first - 20);
      var snippet = entry.content.slice(start, start + 100);
      var paragraph = document.createElement('p');
      paragraph.className = 'search-result';
      appendHighlighted(paragraph, snippet, keywords);
      if (start + 100 < entry.content.length) paragraph.appendChild(document.createTextNode('…'));
      item.appendChild(paragraph);
      list.appendChild(item);
    });
    if (list.childElementCount) result.appendChild(list);
    else {
      var empty = document.createElement('div');
      empty.className = 'search-result-empty';
      empty.textContent = '没有找到内容，更换下搜索词试试吧~';
      result.appendChild(empty);
    }
  }

  input.addEventListener('input', render);
  fetch(path, { credentials: 'same-origin' }).then(function (response) {
    if (!response.ok) throw new Error('Search index HTTP ' + response.status);
    return response.text();
  }).then(function (text) {
    var xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('Invalid search XML');
    entries = Array.from(xml.querySelectorAll('entry')).map(function (entry) {
      function value(name) { var el = entry.querySelector(name); return el ? el.textContent.trim() : ''; }
      var url;
      try { url = new URL(value('url'), location.origin); } catch (_) { return null; }
      if (!['http:', 'https:'].includes(url.protocol)) return null;
      if (![location.host, 'chenzihao.me', 'mrshadowalker.github.io'].includes(url.host.toLowerCase())) return null;
      var content = new DOMParser().parseFromString(value('content'), 'text/html');
      content.querySelectorAll('script,style').forEach(function (el) { el.remove(); });
      return { title: value('title') || 'Untitled', content: content.body.textContent.trim(), url: url.pathname + url.search + url.hash };
    }).filter(Boolean);
    render();
  }).catch(function () { failed = true; render(); });
};

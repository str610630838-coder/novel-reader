/**
 * 静态版 / GitHub Pages 用：通过 CORS 代理抓取书源并解析
 */
(function (global) {
  const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
  const SOURCES = {
    bpshu: {
      name: '搜书网 (默认)',
      baseUrl: 'https://www.bpshu.cc',
      encoding: 'utf-8',
      category: '网络小说',
      search: {
        path: (kw) => '/search.php?q=' + encodeURIComponent(kw),
        resultSelector: '.hot .row > .col-12.col-md-6',
        titleSelector: 'dl dd h3 a',
        authorSelector: 'dl dd.book_other span',
        coverSelector: 'dl dt a img',
        descSelector: '',
      },
      book: {
        titleSelector: '.book_info .info h1',
        authorSelector: '.book_info .info .options li:first-child',
        descSelector: '#intro_pc',
        coverSelector: '.book_info .img-thumbnail',
        chapterListSelector: '.book_list2 ul li a',
      },
      chapter: {
        titleSelector: 'h1',
        contentSelector: 'article',
        prevSelector: '#prev1',
        nextSelector: '#next1',
      },
    },
    qianbi: {
      name: '铅笔小说 (网文)',
      baseUrl: 'https://www.23qb.net',
      encoding: 'utf-8',
      category: '网络小说',
      engine: 'qianbi',
    },
    qianbi_com: {
      name: '铅笔小说镜像 (23qb.com)',
      baseUrl: 'https://www.23qb.com',
      encoding: 'utf-8',
      category: '网络小说',
      engine: 'qianbi',
    },
    luoxia: {
      name: '落霞读书 (出版文学)',
      baseUrl: 'https://luoxiadushu.com',
      encoding: 'utf-8',
      category: '出版文学',
      engine: 'luoxia',
    },
    luoxia_www: {
      name: '落霞读书镜像 (出版文学)',
      baseUrl: 'https://www.luoxiadushu.com',
      encoding: 'utf-8',
      category: '出版文学',
      engine: 'luoxia',
    },
    kanunu8: {
      name: '努努书坊 (出版小说)',
      baseUrl: 'https://www.kanunu8.com',
      encoding: 'gbk',
      category: '出版文学',
      engine: 'kanunu8',
    },
    xyyuedu: {
      name: '心愿阅读 (出版经典)',
      baseUrl: 'https://www.xyyuedu.com',
      encoding: 'utf-8',
      category: '经典名著',
      engine: 'xyyuedu',
    },
    cs99: {
      name: '99藏书网 (出版文学)',
      baseUrl: 'https://www.99csw.com',
      encoding: 'utf-8',
      category: '出版文学',
      engine: 'cs99',
    },
    b111: {
      name: '宝书网 (出版小说)',
      baseUrl: 'https://www.b111.net',
      encoding: 'utf-8',
      category: '出版文学',
      engine: 'b111',
    },
    tianlai: {
      name: '天籁小说 (出版+网文)',
      baseUrl: 'https://www.tianlai.net',
      encoding: 'utf-8',
      category: '网络小说',
      engine: 'tianlai',
    },
  };

  function sourceEngine(source, sourceId) {
    return source.engine || sourceId;
  }

  function resolveUrl(href, baseUrl) {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    const path = href.startsWith('/') ? href : '/' + href;
    try {
      return new URL(path, baseUrl).href;
    } catch (e) {
      return baseUrl + path;
    }
  }

  function fullUrl(url, source) {
    return url.startsWith('http') ? url : source.baseUrl + (url.startsWith('/') ? url : '/' + url);
  }

  async function fetchPage(url, source) {
    const target = fullUrl(url, source);
    const proxyUrl = CORS_PROXY + encodeURIComponent(target);
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('源站返回错误 ' + res.status);
    let html;
    if (source.encoding === 'gbk') {
      const buf = await res.arrayBuffer();
      try {
        html = new TextDecoder('gbk').decode(buf);
      } catch (e) {
        html = new TextDecoder('utf-8').decode(buf);
      }
    } else {
      html = await res.text();
    }
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
  }

  function text(el) { return el ? el.textContent.trim() : ''; }
  function attr(el, name) { return el ? el.getAttribute(name) || '' : ''; }
  function html(el) { return el ? el.innerHTML : ''; }

  function resolveHref(href) {
    if (!href) return '';
    if (href.startsWith('http')) { try { return new URL(href).pathname; } catch(e) { return href; } }
    return href.startsWith('/') ? href : '/' + href;
  }

  async function searchBooks(q, sourceId) {
    const source = SOURCES[sourceId] || SOURCES.bpshu;
    const engine = sourceEngine(source, sourceId);
    const results = [];
    if (engine === 'kanunu8') {
      return { error: '努努书坊不支持搜索，请直接浏览书籍URL', results: [] };
    }
    if (engine === 'qianbi') {
      const url = '/search.html?searchkey=' + encodeURIComponent(q);
      const doc = await fetchPage(url, source);
      const bookName = attr(doc.querySelector('meta[property="og:novel:book_name"]'), 'content');
      if (bookName) {
        const readUrl = attr(doc.querySelector('meta[property="og:novel:read_url"]'), 'content');
        let bookPath = '';
        if (readUrl) try { bookPath = new URL(readUrl).pathname.replace(/\/catalog$/, '/'); } catch (e) {}
        results.push({
          title: bookName,
          author: attr(doc.querySelector('meta[property="og:novel:author"]'), 'content'),
          cover: '',
          desc: text(doc.querySelector('.novel-info-content')).slice(0, 120),
          url: bookPath || '',
          source: sourceId,
        });
      }
      doc.querySelectorAll('.module-search-item').forEach((el) => {
        const a = el.querySelector('.novel-info h3 a');
        if (!a) return;
        const href = attr(a, 'href');
        const title = text(a);
        if (href && title && !results.find((r) => r.title === title)) {
          const img = el.querySelector('img');
          results.push({
            title,
            author: '',
            cover: img ? (attr(img, 'data-src') || attr(img, 'src')) : '',
            desc: text(el.querySelector('.novel-info-item')).slice(0, 120),
            url: href.startsWith('http') ? new URL(href).pathname : href,
            source: sourceId,
          });
        }
      });
      doc.querySelectorAll('h3 a[href]').forEach((a) => {
        const href = attr(a, 'href');
        const title = text(a);
        if (href && /\/book\/\d+\/?$/.test(href) && title && !results.find((r) => r.title === title)) {
          results.push({ title, author: '', cover: '', desc: '', url: href.startsWith('http') ? new URL(href).pathname : href, source: sourceId });
        }
      });
      return { results };
    }
    if (engine === 'luoxia') {
      const url = '/?s=' + encodeURIComponent(q);
      const doc = await fetchPage(url, source);
      doc.querySelectorAll('.search-list-cat .cat-search-item a').forEach((a) => {
        const title = text(a);
        let href = attr(a, 'href');
        if (!title || !href) return;
        if (href.startsWith('http')) try { href = new URL(href).pathname; } catch (e) {}
        results.push({ title, author: '', cover: '', desc: '', url: href, source: sourceId });
      });
      return { results };
    }
    if (engine === 'xyyuedu') {
      const doc = await fetchPage('/gdmz/sidamingzhu/index.html', source);
      const aliasMap = {
        sgyy: ['三国', '三国演义'],
        xyji: ['西游', '西游记'],
        shchuan: ['水浒', '水浒传'],
        hlmeng: ['红楼', '红楼梦'],
      };
      const qLower = q.toLowerCase();
      doc.querySelectorAll('a[href]').forEach((a) => {
        const title = text(a);
        let href = attr(a, 'href');
        if (!title || !href) return;
        if (!/\/gdmz\/sidamingzhu\/.+\/index\.html$/.test(href)) return;
        const textHit = title.toLowerCase().includes(qLower) || href.toLowerCase().includes(qLower);
        const aliasHit = Object.keys(aliasMap).some((key) => href.includes('/' + key + '/') && aliasMap[key].some((k) => q.includes(k)));
        if (!textHit && !aliasHit) return;
        if (href.startsWith('http')) try { href = new URL(href).pathname; } catch (e) {}
        const u = href.startsWith('/') ? href : '/' + href;
        if (!results.find((r) => r.url === u)) {
          results.push({ title, author: '', cover: '', desc: '出版经典（心愿阅读）', url: u, source: sourceId });
        }
      });
      if (results.length === 0) {
        doc.querySelectorAll('a[href]').forEach((a) => {
          const title = text(a);
          let href = attr(a, 'href');
          if (!title || !href) return;
          if (!/\/gdmz\/sidamingzhu\/.+\/index\.html$/.test(href)) return;
          if (href.startsWith('http')) try { href = new URL(href).pathname; } catch (e) {}
          const u = href.startsWith('/') ? href : '/' + href;
          if (!results.find((r) => r.url === u)) {
            results.push({ title, author: '', cover: '', desc: '出版经典（心愿阅读）', url: u, source: sourceId });
          }
        });
      }
      return { results };
    }
    // 99藏书网
    if (engine === 'cs99') {
      const url = '/book/search.php?type=all&keyword=' + encodeURIComponent(q);
      const doc = await fetchPage(url, source);
      doc.querySelectorAll('tr').forEach((el) => {
        const a = el.querySelector('td:first-child a');
        if (!a) return;
        const title = text(a);
        const href = attr(a, 'href');
        if (!title || !href || href.includes('search')) return;
        const authorTd = el.querySelector('td:nth-child(2)');
        results.push({ title, author: authorTd ? text(authorTd) : '', cover: '', desc: '', url: resolveHref(href), source: sourceId });
      });
      if (!results.length) {
        doc.querySelectorAll('a[href]').forEach((a) => {
          const title = text(a);
          const href = attr(a, 'href');
          if (!title || !href || title.length < 2 || title.length > 50) return;
          if (!/\/book\/\d+/.test(href) && !/\/html\//.test(href)) return;
          if (!results.find(r => r.title === title)) {
            results.push({ title, author: '', cover: '', desc: '', url: resolveHref(href), source: sourceId });
          }
        });
      }
      return { results };
    }
    // 宝书网
    if (engine === 'b111') {
      const url = '/search.html?searchkey=' + encodeURIComponent(q);
      const doc = await fetchPage(url, source);
      doc.querySelectorAll('.bookbox').forEach((el) => {
        const a = el.querySelector('.bookinfo a') || el.querySelector('a');
        if (!a) return;
        const title = text(a);
        const href = attr(a, 'href');
        if (!title || !href) return;
        const authorEl = el.querySelector('.author') || el.querySelector('.bookinfo p');
        const author = authorEl ? text(authorEl).replace(/作者[：:]\s*/, '') : '';
        const img = el.querySelector('img');
        const cover = img ? attr(img, 'src') : '';
        results.push({ title, author, cover: cover.startsWith('http') ? cover : '', desc: '', url: resolveHref(href), source: sourceId });
      });
      if (!results.length) {
        doc.querySelectorAll('li a[href], .list-group-item a[href]').forEach((a) => {
          const title = text(a);
          const href = attr(a, 'href');
          if (!title || !href || title.length < 2) return;
          if (!/\/(book|novel|xs)\/\d+/.test(href) && !/\/\d+_\d+/.test(href)) return;
          if (!results.find(r => r.title === title)) {
            results.push({ title, author: '', cover: '', desc: '', url: resolveHref(href), source: sourceId });
          }
        });
      }
      return { results };
    }
    // 天籁小说
    if (engine === 'tianlai') {
      const url = '/search/?searchkey=' + encodeURIComponent(q);
      const doc = await fetchPage(url, source);
      doc.querySelectorAll('.bookbox, .novelslist2 li, .result-game-item').forEach((el) => {
        const a = el.querySelector('h3 a') || el.querySelector('.bookinfo a') || el.querySelector('a.bigger') || el.querySelector('a');
        if (!a) return;
        const title = text(a);
        const href = attr(a, 'href');
        if (!title || !href) return;
        const authorEl = el.querySelector('.author');
        const author = authorEl ? text(authorEl).replace(/作者[：:]\s*/, '') : '';
        const img = el.querySelector('img');
        const cover = img ? attr(img, 'src') : '';
        const introEl = el.querySelector('.intro') || el.querySelector('.result-game-item-desc');
        results.push({
          title, author,
          cover: cover && cover.startsWith('http') ? cover : '',
          desc: introEl ? text(introEl).slice(0, 120) : '',
          url: resolveHref(href), source: sourceId,
        });
      });
      if (!results.length) {
        doc.querySelectorAll('a[href]').forEach((a) => {
          const title = text(a);
          const href = attr(a, 'href');
          if (!title || !href || title.length < 2 || title.length > 50) return;
          if (!/\/(book|novel|xs)\/\d+/.test(href)) return;
          if (!results.find(r => r.title === title)) {
            results.push({ title, author: '', cover: '', desc: '', url: resolveHref(href), source: sourceId });
          }
        });
      }
      return { results };
    }
    // Generic (bpshu etc)
    const url = source.search.path(q);
    const doc = await fetchPage(url, source);
    doc.querySelectorAll(source.search.resultSelector).forEach((el) => {
      const titleEl = el.querySelector(source.search.titleSelector);
      const titleText = text(titleEl);
      if (!titleText) return;
      let u = attr(titleEl, 'href');
      if (u && u.startsWith('http')) try { u = new URL(u).pathname; } catch (e) {}
      results.push({
        title: titleText,
        author: source.search.authorSelector ? text(el.querySelector(source.search.authorSelector)) : '',
        cover: source.search.coverSelector ? attr(el.querySelector(source.search.coverSelector), 'src') : '',
        desc: source.search.descSelector ? text(el.querySelector(source.search.descSelector)).slice(0, 120) : '',
        url: u || '',
        source: sourceId,
      });
    });
    return { results };
  }

  function collectChapters(doc, bookUrl, selectors) {
    const chapters = [];
    const selectorStr = selectors || 'dd a[href], .listmain a[href], .list a[href], #list a[href], ul li a[href], .chapters a[href], table a[href]';
    let bookPath = bookUrl.endsWith('/') ? bookUrl : bookUrl.replace(/\/[^/]+$/, '/');
    doc.querySelectorAll(selectorStr).forEach((a) => {
      const chTitle = text(a);
      let href = attr(a, 'href');
      if (!chTitle || !href || href.includes('javascript:')) return;
      if (!href.startsWith('http') && !href.startsWith('/')) href = bookPath + href;
      const u = href.startsWith('http') ? (() => { try { return new URL(href).pathname; } catch(e) { return href; } })() : href;
      if (!chapters.find((c) => c.url === u)) chapters.push({ title: chTitle, url: u });
    });
    return chapters;
  }

  function findPrevNext(doc) {
    let prevUrl = '', nextUrl = '';
    doc.querySelectorAll('a[href]').forEach((a) => {
      const t = text(a);
      const href = attr(a, 'href');
      if (!href) return;
      if (!prevUrl && /上一|上页|上一章/.test(t)) prevUrl = resolveHref(href);
      if (!nextUrl && /下一|下页|下一章/.test(t)) nextUrl = resolveHref(href);
    });
    return { prevUrl, nextUrl };
  }

  async function getBook(bookUrl, sourceId) {
    const source = SOURCES[sourceId] || SOURCES.bpshu;
    const engine = sourceEngine(source, sourceId);
    const doc = await fetchPage(bookUrl, source);
    let title = '', author = '', desc = '', cover = '';
    const chapters = [];
    if (engine === 'qianbi') {
      title = text(doc.querySelector('h1.page-title')) || attr(doc.querySelector('meta[property="og:novel:book_name"]'), 'content') || '未知书籍';
      author = attr(doc.querySelector('meta[property="og:novel:author"]'), 'content');
      desc = text(doc.querySelector('.novel-info-content'));
      const cov = doc.querySelector('.novel-cover img');
      cover = cov ? (attr(cov, 'data-src') || attr(cov, 'src')) : '';
      if (cover && !cover.startsWith('http')) cover = source.baseUrl + (cover.startsWith('/') ? cover : '/' + cover);
      let catalogUrl = bookUrl.replace(/\/$/, '') + '/catalog';
      const catDoc = await fetchPage(catalogUrl, source);
      catDoc.querySelectorAll('.module-row-info a').forEach((a) => {
        const chTitle = text(a);
        const href = attr(a, 'href');
        if (chTitle && href) chapters.push({ title: chTitle, url: href.startsWith('http') ? new URL(href).pathname : href });
      });
    } else if (engine === 'luoxia') {
      const h1s = doc.querySelectorAll('h1');
      if (h1s.length >= 2) title = text(h1s[1]);
      if (!title) title = (doc.querySelector('title')?.textContent || '').split('-')[0].replace(/小说全集.*$/, '').trim() || '未知书籍';
      const titleTag = (doc.querySelector('title')?.textContent || '');
      const m = titleTag.match(/[-–]\s*(.+?)\s*[-–]\s*落霞/);
      if (m) author = m[1].trim();
      doc.querySelectorAll('.book-list a').forEach((a) => {
        const chTitle = text(a);
        let href = attr(a, 'href');
        if (!chTitle || !href || href.includes('#')) return;
        if (href.startsWith('http')) try { href = new URL(href).pathname; } catch (e) {}
        if (href !== bookUrl) chapters.push({ title: chTitle, url: href });
      });
    } else if (engine === 'kanunu8') {
      title = (doc.querySelector('title')?.textContent || '').split('-')[0].trim() || '未知书籍';
      let bookPath = bookUrl.endsWith('/') ? bookUrl : bookUrl.replace(/\/[^/]+$/, '/');
      doc.querySelectorAll('table a').forEach((a) => {
        const chTitle = text(a);
        let href = attr(a, 'href');
        if (!chTitle || !href || href.includes('javascript:') || !/^\d+\.html$/.test(href.trim())) return;
        if (!href.startsWith('http') && !href.startsWith('/')) href = bookPath + href;
        const u = href.startsWith('http') ? new URL(href).pathname : href;
        if (!chapters.find((c) => c.url === u)) chapters.push({ title: chTitle, url: u });
      });
    } else if (engine === 'xyyuedu') {
      title = text(doc.querySelector('#arcxs_title h1')) || text(doc.querySelector('h1')) || ((doc.querySelector('title')?.textContent || '').split('-')[0].trim()) || '未知书籍';
      const titleTag = doc.querySelector('title')?.textContent || '';
      const m = titleTag.match(/[-–]\s*([^\-–]+)\s*$/);
      if (m) author = m[1].trim();
      desc = attr(doc.querySelector('meta[name="description"]'), 'content');

      let bookPath = bookUrl;
      if (bookPath.startsWith('http')) try { bookPath = new URL(bookPath).pathname; } catch (e) {}
      bookPath = bookPath.replace(/\/index\.html?$/i, '/').replace(/\/$/, '/');

      const escaped = bookPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const chapterRe = new RegExp('^' + escaped + '\\d+\\.html$', 'i');
      doc.querySelectorAll('a[href]').forEach((a) => {
        const chTitle = text(a);
        let href = attr(a, 'href');
        if (!chTitle || !href) return;
        if (href.startsWith('http')) try { href = new URL(href).pathname; } catch (e) {}
        const u = href.startsWith('/') ? href : '/' + href;
        if (!chapterRe.test(u)) return;
        if (!chapters.find((c) => c.url === u)) chapters.push({ title: chTitle, url: u });
      });

      chapters.sort((a, b) => {
        const ai = parseInt((a.url.match(/(\d+)\.html$/) || [0, 0])[1], 10);
        const bi = parseInt((b.url.match(/(\d+)\.html$/) || [0, 0])[1], 10);
        return ai - bi;
      });
    } else if (engine === 'cs99') {
      title = text(doc.querySelector('h1')) || (doc.querySelector('title')?.textContent || '').split('-')[0].trim() || '未知书籍';
      const authorEl = doc.querySelector('a[href*="/author/"]');
      author = authorEl ? text(authorEl) : '';
      desc = text(doc.querySelector('p.intro')) || text(doc.querySelector('.intro')) || attr(doc.querySelector('meta[name="description"]'), 'content') || '';
      cover = attr(doc.querySelector('img.cover') || doc.querySelector('.bookimg img') || doc.querySelector('.pic img'), 'src') || '';
      const chs = collectChapters(doc, bookUrl, 'ul li a[href], .chapters a[href], table a[href]');
      chs.forEach(c => { if (!chapters.find(x => x.url === c.url)) chapters.push(c); });
    } else if (engine === 'b111') {
      title = text(doc.querySelector('h1')) || (doc.querySelector('title')?.textContent || '').split('-')[0].trim() || '未知书籍';
      author = text(doc.querySelector('.info a[href*="author"]') || doc.querySelector('.bookinfo a[href*="author"]')) || attr(doc.querySelector('meta[property="og:novel:author"]'), 'content') || '';
      desc = text(doc.querySelector('.intro') || doc.querySelector('#intro') || doc.querySelector('.bookinfo p')) || attr(doc.querySelector('meta[name="description"]'), 'content') || '';
      cover = attr(doc.querySelector('.bookimg img') || doc.querySelector('.cover img') || doc.querySelector('.pic img'), 'src') || '';
      const chs = collectChapters(doc, bookUrl, 'dd a[href], .listmain a[href], .list a[href], #list a[href]');
      chs.forEach(c => { if (!chapters.find(x => x.url === c.url)) chapters.push(c); });
    } else if (engine === 'tianlai') {
      title = text(doc.querySelector('h1')) || (doc.querySelector('title')?.textContent || '').split('-')[0].trim() || '未知书籍';
      author = text(doc.querySelector('.info a[href*="author"]') || doc.querySelector('.bookinfo a[href*="author"]')) || attr(doc.querySelector('meta[property="og:novel:author"]'), 'content') || '';
      desc = text(doc.querySelector('.intro') || doc.querySelector('#intro') || doc.querySelector('.bookinfo p')) || attr(doc.querySelector('meta[name="description"]'), 'content') || '';
      cover = attr(doc.querySelector('.bookimg img') || doc.querySelector('.cover img'), 'src') || '';
      const chs = collectChapters(doc, bookUrl, 'dd a[href], .listmain a[href], .list a[href], #list a[href]');
      chs.forEach(c => { if (!chapters.find(x => x.url === c.url)) chapters.push(c); });
    } else {
      title = text(doc.querySelector(source.book.titleSelector)) || '未知书籍';
      const authorEl = doc.querySelector(source.book.authorSelector);
      author = (authorEl ? authorEl.textContent : '').replace(/作\s*者[：:]?\s*/g, '').trim();
      desc = text(doc.querySelector(source.book.descSelector));
      cover = attr(doc.querySelector(source.book.coverSelector), 'src') || '';
      if (cover && !cover.startsWith('http')) cover = source.baseUrl + (cover.startsWith('/') ? cover : '/' + cover);
      let bookPath = bookUrl.endsWith('/') ? bookUrl : bookUrl.replace(/\/[^/]+$/, '/');
      doc.querySelectorAll(source.book.chapterListSelector).forEach((a) => {
        const chTitle = text(a);
        let href = attr(a, 'href');
        if (!chTitle || !href || href.includes('javascript:')) return;
        if (!href.startsWith('http') && !href.startsWith('/')) href = bookPath + href;
        const u = href.startsWith('http') ? new URL(href).pathname : href;
        if (u !== bookUrl && !chapters.find((c) => c.url === u)) chapters.push({ title: chTitle, url: u });
      });
    }
    return { title, author, desc, cover, chapters, source: sourceId };
  }

  function stripHtml(htmlStr) {
    return htmlStr
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async function getChapter(chapterUrl, sourceId) {
    const source = SOURCES[sourceId] || SOURCES.bpshu;
    const engine = sourceEngine(source, sourceId);
    const doc = await fetchPage(chapterUrl, source);
    let title = '', content = '', prevUrl = '', nextUrl = '';
    if (engine === 'qianbi') {
      title = text(doc.querySelector('h1.article-title'));
      content = html(doc.querySelector('.article-content'));
    } else if (engine === 'luoxia') {
      title = text(doc.querySelector('h1.post-title')) || text(doc.querySelector('#nr_title'));
      content = html(doc.querySelector('#nr1'));
      prevUrl = attr(doc.querySelector('a[rel="prev"]'), 'href') || '';
      nextUrl = attr(doc.querySelector('a[rel="next"]'), 'href') || '';
      if (prevUrl.startsWith('http')) try { prevUrl = new URL(prevUrl).pathname; } catch (e) {}
      if (nextUrl.startsWith('http')) try { nextUrl = new URL(nextUrl).pathname; } catch (e) {}
    } else if (engine === 'kanunu8') {
      title = (doc.querySelector('title')?.textContent || '').split('-')[0].trim();
      const pTexts = [];
      doc.querySelectorAll('p').forEach((p) => {
        const t = text(p);
        if (t.length > 10) pTexts.push(t);
      });
      content = pTexts.join('\n\n');
    } else if (engine === 'xyyuedu') {
      title = text(doc.querySelector('#arcxs_title h1')) || text(doc.querySelector('h1')) || ((doc.querySelector('title')?.textContent || '').split('_')[0].trim());
      content = html(doc.querySelector('#onearcxsbd')) || html(doc.querySelector('#arcxsbd'));
      doc.querySelectorAll('.list-pages a[href]').forEach((a) => {
        const t = text(a);
        let href = attr(a, 'href') || '';
        if (!href) return;
        if (href.startsWith('http')) try { href = new URL(href).pathname; } catch (e) {}
        if (!prevUrl && /上一|上页/.test(t)) prevUrl = href;
        if (!nextUrl && /下一|下页/.test(t)) nextUrl = href;
      });
    } else if (engine === 'cs99') {
      title = text(doc.querySelector('h1') || doc.querySelector('h2')) || (doc.querySelector('title')?.textContent || '').split('-')[0].trim();
      content = html(doc.querySelector('#content') || doc.querySelector('.content') || doc.querySelector('.text'));
      const nav = findPrevNext(doc);
      prevUrl = nav.prevUrl; nextUrl = nav.nextUrl;
    } else if (engine === 'b111') {
      title = text(doc.querySelector('h1')) || (doc.querySelector('title')?.textContent || '').split('-')[0].trim();
      content = html(doc.querySelector('#content') || doc.querySelector('.content') || doc.querySelector('#BookText'));
      const nav = findPrevNext(doc);
      prevUrl = nav.prevUrl; nextUrl = nav.nextUrl;
    } else if (engine === 'tianlai') {
      title = text(doc.querySelector('h1')) || (doc.querySelector('title')?.textContent || '').split('-')[0].trim();
      content = html(doc.querySelector('#content') || doc.querySelector('.content') || doc.querySelector('#BookText'));
      const nav = findPrevNext(doc);
      prevUrl = nav.prevUrl; nextUrl = nav.nextUrl;
    } else {
      const titleEl = doc.querySelector(source.chapter.titleSelector);
      title = titleEl ? text(titleEl) : '';
      content = html(doc.querySelector(source.chapter.contentSelector));
      prevUrl = attr(doc.querySelector(source.chapter.prevSelector), 'href') || '';
      nextUrl = attr(doc.querySelector(source.chapter.nextSelector), 'href') || '';
    }
    content = stripHtml(content);
    return { title, content, prevUrl: prevUrl || '', nextUrl: nextUrl || '' };
  }

  global.SOURCES = SOURCES;
  global.searchBooks = searchBooks;
  global.getBook = getBook;
  global.getChapter = getChapter;
})(typeof window !== 'undefined' ? window : this);

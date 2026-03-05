const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const cheerio = require('cheerio');

const API_CLIENT_PATH = path.join(__dirname, '..', 'docs', 'api-client.js');

class NodeWrapper {
  constructor($, element) {
    this.$ = $;
    this.element = element;
  }

  querySelector(selector) {
    const found = this.$(this.element).find(selector).first();
    return found.length ? new NodeWrapper(this.$, found[0]) : null;
  }

  querySelectorAll(selector) {
    return this.$(this.element)
      .find(selector)
      .toArray()
      .map((el) => new NodeWrapper(this.$, el));
  }

  get textContent() {
    return this.$(this.element).text();
  }

  get innerHTML() {
    return this.$(this.element).html() || '';
  }

  getAttribute(name) {
    const val = this.$(this.element).attr(name);
    return val == null ? null : val;
  }
}

class DocumentWrapper {
  constructor($) {
    this.$ = $;
  }

  querySelector(selector) {
    const found = this.$(selector).first();
    return found.length ? new NodeWrapper(this.$, found[0]) : null;
  }

  querySelectorAll(selector) {
    return this.$(selector)
      .toArray()
      .map((el) => new NodeWrapper(this.$, el));
  }
}

class DOMParserShim {
  parseFromString(html) {
    const $ = cheerio.load(html);
    return new DocumentWrapper($);
  }
}

function makeFetch(fixtures) {
  return async function fetchStub(url) {
    const parsed = new URL(url);
    const rawTarget = parsed.searchParams.get('url') || parsed.searchParams.get('quest');
    const target = rawTarget || url;
    const body = fixtures.get(target);
    if (body == null) {
      return {
        ok: false,
        status: 404,
        text: async () => '',
        arrayBuffer: async () => Buffer.from('', 'utf-8'),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => body,
      arrayBuffer: async () => Buffer.from(body, 'utf-8'),
    };
  };
}

function loadApiClient(fixtures) {
  const code = fs.readFileSync(API_CLIENT_PATH, 'utf-8');
  const sandbox = {
    console,
    URL,
    TextDecoder,
    AbortSignal,
    DOMParser: DOMParserShim,
    fetch: makeFetch(fixtures),
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'api-client.js' });
  return sandbox;
}

function baseFixtures() {
  const map = new Map();

  map.set(
    'https://www.luoxiadushu.com/?s=%E7%99%BD%E5%A4%9C%E8%A1%8C',
    `
      <div class="search-list-cat">
        <div class="cat-search-item">
          <a href="https://www.luoxiadushu.com/baiyexing/">白夜行</a>
        </div>
      </div>
    `
  );

  map.set(
    'https://www.luoxiadushu.com/baiyexing/',
    `
      <title>白夜行 - 东野圭吾 - 落霞读书</title>
      <h1>站点标题</h1>
      <h1>白夜行</h1>
      <div class="book-list">
        <a href="/baiyexing/1.html">第一章</a>
        <a href="/baiyexing/2.html">第二章</a>
      </div>
    `
  );

  map.set(
    'https://www.luoxiadushu.com/baiyexing/1.html',
    `
      <h1 class="post-title">第一章 开端</h1>
      <div id="nr1">第一段<br>第二段</div>
      <a rel="prev" href="/baiyexing/0.html">上一章</a>
      <a rel="next" href="https://www.luoxiadushu.com/baiyexing/2.html">下一章</a>
    `
  );

  map.set(
    'https://www.kanunu8.com/book3/6879/index.html',
    `
      <title>Animal Farm - kanunu8</title>
      <table>
        <tr><td><a href="1.html">Chapter 1</a></td></tr>
        <tr><td><a href="2.html">Chapter 2</a></td></tr>
      </table>
    `
  );

  map.set(
    'https://www.kanunu8.com/book3/6879/1.html',
    `
      <title>Chapter 1 - kanunu8</title>
      <p>Short</p>
      <p>This is chapter one paragraph with enough text.</p>
      <p>This is chapter one second paragraph.</p>
    `
  );

  map.set(
    'https://www.xyyuedu.com/gdmz/sidamingzhu/index.html',
    `
      <a href="/gdmz/sidamingzhu/sgyy/index.html">三国演义</a>
      <a href="/gdmz/sidamingzhu/xyji/index.html">西游记</a>
    `
  );

  map.set(
    'https://www.xyyuedu.com/gdmz/sidamingzhu/sgyy/index.html',
    `
      <title>三国演义 - 罗贯中</title>
      <meta name="description" content="三国演义简介">
      <div id="arcxs_title"><h1>三国演义</h1></div>
      <a href="/gdmz/sidamingzhu/sgyy/2.html">第二回</a>
      <a href="/gdmz/sidamingzhu/sgyy/1.html">第一回</a>
      <a href="/gdmz/sidamingzhu/sgyy/index.html">目录</a>
    `
  );

  map.set(
    'https://www.xyyuedu.com/gdmz/sidamingzhu/sgyy/1.html',
    `
      <title>三国演义_第一回</title>
      <div id="arcxs_title"><h1>第一回</h1></div>
      <div id="onearcxsbd">天下大势，分久必合。<br>合久必分。</div>
      <div class="list-pages">
        <a href="/gdmz/sidamingzhu/sgyy/0.html">上一页</a>
        <a href="/gdmz/sidamingzhu/sgyy/2.html">下一页</a>
      </div>
    `
  );

  // 99藏书网 fixtures
  map.set(
    'https://www.99csw.com/book/search.php?type=all&keyword=%E7%99%BD%E5%A4%9C%E8%A1%8C',
    `
      <table>
        <tr><td><a href="/book/1234/">白夜行</a></td><td>东野圭吾</td></tr>
      </table>
    `
  );

  map.set(
    'https://www.99csw.com/book/1234/',
    `
      <title>白夜行 - 99藏书</title>
      <h1>白夜行</h1>
      <a href="/author/100/">东野圭吾</a>
      <ul>
        <li><a href="/book/1234/1.html">第一章</a></li>
        <li><a href="/book/1234/2.html">第二章</a></li>
      </ul>
    `
  );

  map.set(
    'https://www.99csw.com/book/1234/1.html',
    `
      <h1>第一章 雪夜</h1>
      <div id="content">雪花纷纷落下。<br>街道上空无一人。</div>
      <a href="/book/1234/0.html">上一章</a>
      <a href="/book/1234/2.html">下一章</a>
    `
  );

  // 宝书网 fixtures
  map.set(
    'https://www.b111.net/search.html?searchkey=%E7%99%BD%E5%A4%9C%E8%A1%8C',
    `
      <div class="bookbox">
        <div class="bookinfo"><a href="/novel/5678/">白夜行</a><p>作者：东野圭吾</p></div>
      </div>
    `
  );

  map.set(
    'https://www.b111.net/novel/5678/',
    `
      <title>白夜行 - 宝书网</title>
      <h1>白夜行</h1>
      <dd><a href="/novel/5678/1.html">第一章</a></dd>
      <dd><a href="/novel/5678/2.html">第二章</a></dd>
    `
  );

  map.set(
    'https://www.b111.net/novel/5678/1.html',
    `
      <h1>第一章 开始</h1>
      <div id="content">故事从这里开始。<br>一切都在黑暗中。</div>
      <a href="/novel/5678/0.html">上一章</a>
      <a href="/novel/5678/2.html">下一章</a>
    `
  );

  // 天籁小说 fixtures
  map.set(
    'https://www.tianlai.net/search/?searchkey=%E6%8E%A8%E7%90%86',
    `
      <div class="bookbox">
        <h3><a href="/book/9999/">推理大师</a></h3>
        <span class="author">作者：某某</span>
        <div class="intro">一本推理小说</div>
      </div>
    `
  );

  map.set(
    'https://www.tianlai.net/book/9999/',
    `
      <title>推理大师 - 天籁小说</title>
      <h1>推理大师</h1>
      <dd><a href="/book/9999/1.html">第一章</a></dd>
      <dd><a href="/book/9999/2.html">第二章</a></dd>
    `
  );

  map.set(
    'https://www.tianlai.net/book/9999/1.html',
    `
      <h1>第一章 密室</h1>
      <div id="content">密室中藏着秘密。<br>没人能逃脱。</div>
      <a href="/book/9999/0.html">上一章</a>
      <a href="/book/9999/2.html">下一章</a>
    `
  );

  return map;
}

async function run() {
  const fixtures = baseFixtures();
  const api = loadApiClient(fixtures);
  let passed = 0;

  const tests = [
    async () => {
      const out = await api.searchBooks('白夜行', 'luoxia_www');
      assert.ok(out.results.length > 0, 'luoxia_www 搜索应返回结果');
      assert.strictEqual(out.results[0].url, '/baiyexing/');
    },
    async () => {
      const out = await api.getBook('/baiyexing/', 'luoxia_www');
      assert.strictEqual(out.title, '白夜行');
      assert.strictEqual(out.author, '东野圭吾');
      assert.strictEqual(out.chapters.length, 2);
    },
    async () => {
      const out = await api.getChapter('/baiyexing/1.html', 'luoxia_www');
      assert.strictEqual(out.title, '第一章 开端');
      assert.ok(out.content.includes('第一段'));
      assert.strictEqual(out.nextUrl, '/baiyexing/2.html');
    },
    async () => {
      const out = await api.getBook('/book3/6879/index.html', 'kanunu8');
      assert.strictEqual(out.chapters.length, 2);
      assert.strictEqual(out.chapters[0].url, '/book3/6879/1.html');
    },
    async () => {
      const out = await api.getChapter('/book3/6879/1.html', 'kanunu8');
      assert.ok(out.content.includes('chapter one paragraph'));
    },
    async () => {
      const out = await api.searchBooks('三国', 'xyyuedu');
      assert.ok(out.results.some((r) => r.url === '/gdmz/sidamingzhu/sgyy/index.html'));
    },
    async () => {
      const out = await api.getBook('/gdmz/sidamingzhu/sgyy/index.html', 'xyyuedu');
      assert.strictEqual(out.title, '三国演义');
      assert.strictEqual(out.chapters[0].url, '/gdmz/sidamingzhu/sgyy/1.html');
      assert.strictEqual(out.chapters[1].url, '/gdmz/sidamingzhu/sgyy/2.html');
    },
    async () => {
      const out = await api.getChapter('/gdmz/sidamingzhu/sgyy/1.html', 'xyyuedu');
      assert.strictEqual(out.title, '第一回');
      assert.ok(out.content.includes('天下大势'));
      assert.strictEqual(out.prevUrl, '/gdmz/sidamingzhu/sgyy/0.html');
      assert.strictEqual(out.nextUrl, '/gdmz/sidamingzhu/sgyy/2.html');
    },
    // 99藏书网 tests
    async () => {
      const out = await api.searchBooks('白夜行', 'cs99');
      assert.ok(out.results.length > 0, 'cs99 搜索应返回结果');
      assert.strictEqual(out.results[0].title, '白夜行');
    },
    async () => {
      const out = await api.getBook('/book/1234/', 'cs99');
      assert.strictEqual(out.title, '白夜行');
      assert.strictEqual(out.chapters.length, 2);
    },
    async () => {
      const out = await api.getChapter('/book/1234/1.html', 'cs99');
      assert.strictEqual(out.title, '第一章 雪夜');
      assert.ok(out.content.includes('雪花纷纷'));
      assert.ok(out.nextUrl.includes('/book/1234/2.html'));
    },
    // 宝书网 tests
    async () => {
      const out = await api.searchBooks('白夜行', 'b111');
      assert.ok(out.results.length > 0, 'b111 搜索应返回结果');
      assert.strictEqual(out.results[0].title, '白夜行');
    },
    async () => {
      const out = await api.getBook('/novel/5678/', 'b111');
      assert.strictEqual(out.title, '白夜行');
      assert.strictEqual(out.chapters.length, 2);
    },
    async () => {
      const out = await api.getChapter('/novel/5678/1.html', 'b111');
      assert.strictEqual(out.title, '第一章 开始');
      assert.ok(out.content.includes('故事从这里开始'));
    },
    // 天籁小说 tests
    async () => {
      const out = await api.searchBooks('推理', 'tianlai');
      assert.ok(out.results.length > 0, 'tianlai 搜索应返回结果');
      assert.strictEqual(out.results[0].title, '推理大师');
    },
    async () => {
      const out = await api.getBook('/book/9999/', 'tianlai');
      assert.strictEqual(out.title, '推理大师');
      assert.strictEqual(out.chapters.length, 2);
    },
    async () => {
      const out = await api.getChapter('/book/9999/1.html', 'tianlai');
      assert.strictEqual(out.title, '第一章 密室');
      assert.ok(out.content.includes('密室中藏着秘密'));
    },
  ];

  for (let i = 0; i < tests.length; i += 1) {
    await tests[i]();
    passed += 1;
  }

  console.log(`PASS ${passed}/${tests.length} offline smoke tests`);
}

run().catch((err) => {
  console.error('FAIL offline smoke tests');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});

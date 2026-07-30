// ====== 入场层逻辑 ======
var introLayer = document.getElementById("intro-layer");
var mainContent = document.getElementById("main-content");
var hasEntered = false;

function typeSubtitle(el, text) {
  if (!el || !text) { el && (el.textContent = "记录与分享"); return; }
  el.textContent = "";
  var chars = text.split("");
  chars.forEach(function(ch, i) {
    var span = document.createElement("span");
    span.textContent = ch;
    span.style.animationDelay = (0.06 * i) + "s";
    el.appendChild(span);
  });
}


if (document.getElementById("intro-layer")) {
  initIntro();
}

// Shared JS for Latte's site

async function loadJSON(path) {
  const res = await fetch(path + '?v=' + Date.now());
  return res.json();
}

const ICONS = {
  camera: '<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="26" r="8" stroke="#2471a3" stroke-width="1.8" fill="none"/><circle cx="24" cy="26" r="4.5" stroke="#2471a3" stroke-width="1.5" fill="none"/><rect x="6" y="14" width="36" height="24" rx="4" stroke="#2471a3" stroke-width="1.8" fill="none"/><rect x="14" y="10" width="8" height="6" rx="2" stroke="#2471a3" stroke-width="1.5" fill="none"/><circle cx="32" cy="19" r="1" fill="#7ab0d4"/></svg>',
  book: '<svg viewBox="0 0 48 48" fill="none"><path d="M12 36V12l12-2v26l-12 2z" stroke="#2471a3" stroke-width="1.8" fill="none" stroke-linejoin="round"/><path d="M36 36V12L24 10v26l12-2z" stroke="#2471a3" stroke-width="1.8" fill="none" stroke-linejoin="round"/><line x1="12" y1="36" x2="36" y2="36" stroke="#2471a3" stroke-width="1.8"/></svg>',
  sparkle: '<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="2" fill="#2471a3"/><line x1="24" y1="8" x2="24" y2="15" stroke="#2471a3" stroke-width="1.5" stroke-linecap="round"/><line x1="24" y1="33" x2="24" y2="40" stroke="#2471a3" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="24" x2="15" y2="24" stroke="#2471a3" stroke-width="1.5" stroke-linecap="round"/><line x1="33" y1="24" x2="40" y2="24" stroke="#2471a3" stroke-width="1.5" stroke-linecap="round"/><line x1="12.3" y1="12.3" x2="17.3" y2="17.3" stroke="#2471a3" stroke-width="1.5" stroke-linecap="round"/><line x1="30.7" y1="30.7" x2="35.7" y2="35.7" stroke="#2471a3" stroke-width="1.5" stroke-linecap="round"/><line x1="35.7" y1="12.3" x2="30.7" y2="17.3" stroke="#2471a3" stroke-width="1.5" stroke-linecap="round"/><line x1="17.3" y1="30.7" x2="12.3" y2="35.7" stroke="#2471a3" stroke-width="1.5" stroke-linecap="round"/></svg>',
  mountain: '<svg viewBox="0 0 48 48" fill="none"><path d="M4 38 L16 18 L24 26 L32 12 L44 38" stroke="#2471a3" stroke-width="1.8" fill="none" stroke-linejoin="round"/><line x1="4" y1="38" x2="44" y2="38" stroke="#a0c8e0" stroke-width="1" stroke-dasharray="3 3"/><circle cx="32" cy="12" r="2" stroke="#2471a3" stroke-width="1.2" fill="none"/></svg>'
};

// ── Render Homepage ──
async function renderHome() {
  try {
  const data = await loadJSON('data/site.json');
  if (!data) return;
  // Hero section removed — title now shown in intro animation
const about = document.querySelector('.about .container');
  if (about) about.innerHTML = '<div class="geo-accent"></div><div class="section-label">关于</div><p>' + data.about + '</p><div class="dot-divider"><span></span><span></span><span></span></div>';

    // 随心一听板块
  const listenEl = document.querySelector('.random-listen .container');
  if (listenEl) {
    listenEl.innerHTML = '<div class="section-label">随心一听</div>' +
      '<div class="listen-status">加载中...</div>' +
      '<div class="listen-song-list"></div>' +
      '<div class="listen-actions"></div>';
    loadRandomListen();
  }
  const grid = document.querySelector('.interest-grid');
  if (grid) {
    grid.innerHTML = data.interests.map(i =>
      '<a class="interest-card" href="' + i.page + '"><div class="icon">' + (ICONS[i.icon] || '') + '</div><span class="label">' + i.name + '</span><span class="card-arrow">探索 &rarr;</span></a>'
    ).join('');
  }

  const bookList = document.querySelector('.book-list');
  if (bookList && data.books) {
    bookList.innerHTML = data.books.map(b =>
      '<div class="book-item"><img class="book-cover" src="' + b.cover + '" alt="' + b.title + '"><div class="book-info">' + b.title + '<span class="author">' + b.author + '</span></div></div>'
    ).join('');
  }

  const contactLinks = document.querySelector('.contact-links');
  if (contactLinks) contactLinks.innerHTML = '<a href="mailto:' + data.contact.email + '">' + data.contact.email + '</a>';

    renderHomeBlog();
    document.querySelectorAll('.fade-in').forEach(function(el) { el.classList.add('visible'); });
  } catch(e) {
    console.error('renderHome error:', e);
    renderHomeBlog();
    document.querySelectorAll('.fade-in').forEach(function(el) { el.classList.add('visible'); });
  }
}

// ── Render blog preview on homepage ──

// ====== 随心一听：网易云音乐集成 ======
// API 地址：本地用相对路径，线上用 Railway
var API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '' : 'https://latte-site-production.up.railway.app';


// API 地址：本地用相对路径，线上用 Railway
var API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '' : 'https://latte-site-production.up.railway.app';
async function loadRandomListen() {
  var statusEl = document.querySelector('.listen-status');
  var listEl = document.querySelector('.listen-song-list');
  var actionsEl = document.querySelector('.listen-actions');
  if (!statusEl || !listEl || !actionsEl) return;

  try {
    var resp = await fetch(API_BASE + '/api/netease/weekly');
    var data = await resp.json();
    
    if (!data.songs || data.songs.length === 0) {
      statusEl.className = 'listen-status listen-offline';
      statusEl.textContent = '暂无播放记录';
      listEl.innerHTML = '<div class="listen-empty">近一周还没有听歌记录</div>';
      return;
    }

    var updatedAt = data.updatedAt ? new Date(data.updatedAt) : null;
    var minutesAgo = updatedAt ? Math.floor((Date.now() - updatedAt.getTime()) / 60000) : null;
    statusEl.className = 'listen-status listen-online';
    statusEl.innerHTML = '最近一周常听' +
      (minutesAgo !== null ? '<span class="listen-cache-time">（' + minutesAgo + '分钟前同步）</span>' : '');

    var songsHTML = '';
    data.songs.slice(0, 5).forEach(function(song, i) {
      songsHTML += '<a class="listen-song-card" href="' + song.url + '" target="_blank" rel="noopener">' +
        '<span class="listen-song-rank">' + (i + 1) + '</span>' +
        '<img class="listen-song-cover" src="' + (song.cover ? song.cover + '?param=80y80' : '') + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' +
        '<div class="listen-song-info">' +
          '<div class="listen-song-name">' + escapeHTML(song.name) + '</div>' +
          '<div class="listen-song-artist">' + escapeHTML(song.artists) + '</div>' +
        '</div>' +
        '<span class="listen-song-count">' + (song.playCount || '') + '次</span>' +
      '</a>';
    });
    listEl.innerHTML = songsHTML;

    actionsEl.innerHTML = '<button class="listen-random-btn" id="randomListenBtn">🎵 随心一听</button>';

    var btn = document.getElementById('randomListenBtn');
    if (btn) {
      btn.addEventListener('click', async function() {
        btn.textContent = '🎵 正在挑选...';
        btn.disabled = true;
        try {
          var r = await fetch(API_BASE + '/api/netease/random');
          var d = await r.json();
          if (d.song && d.song.url) {
            window.open(d.song.url, '_blank', 'noopener');
          }
        } catch (e2) {}
        btn.textContent = '🎵 随心一听';
        btn.disabled = false;
      });
    }
  } catch (e) {
    console.error('loadRandomListen:', e);
    statusEl.className = 'listen-status listen-offline';
    listEl.innerHTML = "<div class=\"listen-empty\">暂时无法加载听歌记录</div>";
  }
}

function escapeHTML(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}



async function renderHomeBlog() {
  const list = document.getElementById('homeBlogList');
  if (!list) return;
  try {
    const res = await fetch('data/blog.json?v=' + Date.now());
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    if (!data.posts || !data.posts.length) { list.innerHTML = '<div class="blog-empty">还没有博客文章</div>'; return; }
    list.innerHTML = data.posts.slice(-3).reverse().map(p =>
      '<a class="blog-card gradient-border-card tilt-card" href="blog/posts/' + p.file + '"><div class="date">' + p.date + '</div><h3>' + p.title + '</h3><div class="summary">' + p.summary + '</div></a>'
    ).join('');
  } catch(e) { list.innerHTML = '<div class="blog-empty">还没有博客文章</div>'; }
}

// ── Render Blog Listing ──
async function renderBlog() {
  const data = await loadJSON('../data/blog.json');
  const list = document.querySelector('.blog-list');
  if (!list) return;
  if (!data.posts || data.posts.length === 0) {
    list.innerHTML = '<div class="blog-empty">还没有博客文章</div>'; return;
  }
  list.innerHTML = [...data.posts].reverse().map(p =>
    '<a class="blog-card" href="posts/' + p.file + '"><div class="date">' + p.date + '</div><h3>' + p.title + '</h3><div class="summary">' + p.summary + '</div></a>'
  ).join('');
}

// ── Render Interest Sub-page ──
async function renderInterestPage() {
  const data = await loadJSON('../data/site.json');
  if (!data) return;
  const pageName = window.location.pathname.split('/').pop().replace('.html', '');
  const pageMap = { 'photography': 'camera', 'books': 'book', 'hobbies': 'sparkle', 'hiking': 'mountain' };
  const iconKey = pageMap[pageName];
  let interest = null;
  for (const i of data.interests) {
    if (i.icon === iconKey || i.page.includes(pageName)) { interest = i; break; }
  }
  if (!interest) return;

  const header = document.querySelector('.interest-page .container');
  if (header) {
    header.innerHTML =
      '<a class="back-link" href="../index.html"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="#2471a3" stroke-width="1.5" stroke-linecap="round"/></svg>返回首页</a>' +
      '<h1>' + interest.name + '</h1>' +
      '<p class="sub-desc">' + (interest.description || '') + '</p>';
  }

  const content = document.querySelector('.interest-content-area');
  if (!content) return;

  if (pageName === 'photography') renderPhotographyPage(interest);
  else if (pageName === 'books') renderBooksPage(interest);
  else if (pageName === 'hobbies') renderHobbiesPage(interest);
  else if (pageName === 'hiking') renderHikingPage(interest);
}

// ── Photography Page ──
function renderPhotographyPage(interest) {
  const content = document.querySelector('.interest-content-area');
  const albums = interest.albums || [];

  if (albums.length === 0) {
    content.innerHTML = '<div class="album-empty">还没有创建图集</div>';
    return;
  }

  var albumIdx = 0;
  var hash = window.location.hash.replace('#album', '');
  if (hash) { var i = parseInt(hash); if (i >= 0 && i < albums.length) albumIdx = i; }

  var album = albums[albumIdx];
  var html = '';
  if (albums.length > 1) {
    html += '<div class="book-tabs" style="margin-bottom:1.5rem">';
    albums.forEach(function(a, i) {
      html += '<button class="' + (i === albumIdx ? 'active' : '') + '" onclick="location.hash=\'album' + i + '\';location.reload()">' + a.name + '</button>';
    });
    html += '</div>';
  }

  html += '<div class="interest-gallery">';
  if (album.images && album.images.length) {
    html += album.images.map(function(img) {
      return '<div class="gallery-item"><img src="../' + img + '" alt="" loading="lazy"></div>';
    }).join('');
  } else {
    html += '<div class="album-empty">暂无照片</div>';
  }
  html += '</div>';

  if (album.journal) {
    html += '<div class="album-journal"><h3>随笔</h3><div class="journal-content">' + album.journal + '</div></div>';
  }

  content.innerHTML = html;
}

// ── Books Page ──
function renderBooksPage(interest) {
  const content = document.querySelector('.interest-content-area');
  var read = interest.read || [];
  var reading = interest.reading || [];
  var wantToRead = interest.wantToRead || [];

  var html = '<div class="book-tabs">';
  html += '<button class="active" onclick="switchBookTab(\'read\')">已读</button>';
  html += '<button onclick="switchBookTab(\'reading\')">正在阅读</button>';
  html += '<button onclick="switchBookTab(\'want\')">想要阅读</button>';
  html += '</div>';

  html += '<div class="book-tab-content active" id="tab-read">';
  if (read.length) {
    html += '<div class="book-list">' + read.map(function(b) {
      return '<div class="book-item"><img class="book-cover" src="../' + b.cover + '" alt="' + b.title + '"><div class="book-info">' + b.title + '<span class="author">' + b.author + '</span>' +
        (b.review ? '<span class="book-review-trigger">我的感想<div class="book-review-popup">' + b.review + '</div></span>' : '') +
        '</div></div>';
    }).join('') + '</div>';
  } else { html += '<div class="album-empty">还没有已读书籍</div>'; }
  html += '</div>';

  html += '<div class="book-tab-content" id="tab-reading">';
  if (reading.length) {
    html += '<div class="book-list">' + reading.map(function(b) {
      return '<div class="book-item"><img class="book-cover" src="../' + b.cover + '" alt="' + b.title + '"><div class="book-info">' + b.title + '<span class="author">' + b.author + '</span>' +
        (b.review ? '<span class="book-review-trigger">我的感想<div class="book-review-popup">' + b.review + '</div></span>' : '') +
        '</div></div>';
    }).join('') + '</div>';
  } else { html += '<div class="album-empty">还没有正在读的书</div>'; }
  html += '</div>';

  html += '<div class="book-tab-content" id="tab-want">';
  if (wantToRead.length) {
    html += '<div class="book-list">' + wantToRead.map(function(b) {
      return '<div class="book-item"><img class="book-cover" src="../' + b.cover + '" alt="' + b.title + '"><div class="book-info">' + b.title + '<span class="author">' + b.author + '</span></div></div>';
    }).join('') + '</div>';
  } else { html += '<div class="album-empty">还没有想读的书</div>'; }
  html += '</div>';

  content.innerHTML = html;
}

function switchBookTab(tab) {
  document.querySelectorAll('.book-tabs button').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.book-tab-content').forEach(function(c) { c.classList.remove('active'); });
  event.target.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
}

// ── Hobbies Page ──
function renderHobbiesPage(interest) {
  const content = document.querySelector('.interest-content-area');
  var hobbies = interest.hobbies || [];
  if (hobbies.length === 0) {
    content.innerHTML = '<div class="album-empty">还没有添加爱好</div>';
    return;
  }
  content.innerHTML = '<div class="hobby-tags">' + hobbies.map(function(h) {
    return '<span class="hobby-tag">' + h + '</span>';
  }).join('') + '</div><p style="color:#aaa;text-align:center;margin-top:2rem;font-size:0.92rem;">这些都是我曾经认真投入过的「三分钟热度」，每一项都值得纪念。</p>';
}

// ── Hiking Page ──
function renderHikingPage(interest) {
  const content = document.querySelector('.interest-content-area');
  var climbed = interest.climbed || [];
  var wantToClimb = interest.wantToClimb || [];
  var images = interest.images || [];
  var journal = interest.journal || '';

  var html = '<div class="book-tabs">';
  html += '<button class="active" onclick="switchBookTab(\'climbed\')">已走过</button>';
  html += '<button onclick="switchBookTab(\'wantClimb\')">想去徒步</button>';
  if (journal) html += '<button onclick="switchBookTab(\'journal\')">随笔</button>';
  if (images.length) html += '<button onclick="switchBookTab(\'photos\')">照片</button>';
  html += '</div>';

  html += '<div class="book-tab-content active" id="tab-climbed">';
  if (climbed.length) {
    html += '<div class="mountain-list">' + climbed.map(function(m) {
      return '<div class="mountain-card"><div class="mountain-icon">' + ICONS.mountain + '</div><div class="mountain-info"><div class="mountain-name">' + m.name + '</div><div class="mountain-detail">' + (m.date || '') + (m.note ? ' · ' + m.note : '') + '</div></div><span class="tag-climbed">已走过</span></div>';
    }).join('') + '</div>';
  } else { html += '<div class="album-empty">还没有徒步记录</div>'; }
  html += '</div>';

  html += '<div class="book-tab-content" id="tab-wantClimb">';
  if (wantToClimb.length) {
    html += '<div class="mountain-list">' + wantToClimb.map(function(m) {
      return '<div class="mountain-card"><div class="mountain-icon">' + ICONS.mountain + '</div><div class="mountain-info"><div class="mountain-name">' + m.name + '</div>' + (m.reason ? '<div class="mountain-detail">' + m.reason + '</div>' : '') + '</div><span class="tag-wanted">想去徒步</span></div>';
    }).join('') + '</div>';
  } else { html += '<div class="album-empty">还没有想去徒步的地方</div>'; }
  html += '</div>';

  if (journal) {
    html += '<div class="book-tab-content" id="tab-journal"><div class="album-journal"><div class="journal-content">' + journal + '</div></div></div>';
  }

  if (images.length) {
    html += '<div class="book-tab-content" id="tab-photos"><div class="interest-gallery">' + images.map(function(img) { return '<div class="gallery-item"><img src="../' + img + '" alt="" loading="lazy"></div>'; }).join('') + '</div></div>';
  }

  content.innerHTML = html;
}

function initFadeIn() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
  }, { threshold: 0.15 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
}

function highlightNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (path.endsWith(href) || (href === 'index.html' && (path.endsWith('/') || path.endsWith('/site/')))) {
      a.classList.add('active');
    }
  });
}

function initBackToTop() {
  var btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', function() {
    btn.classList.toggle('visible', window.scrollY > 400);
  });
  btn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}
var gbComments = [];
var geoDucks = [];
var geoAnimId = null;
var geoMouse = { x: 0, y: 0, down: false, drag: null, ox: 0, oy: 0 };
var geoInfo = null;
var geoNewIdx = -1;
var geoContainerW = 680;
var geoContainerH = 420;
var geoWaterY = 190;
var geoRipples = [];
var waterWaveBoost = 1.0;

var DUCK_COLORS = [
  "#FFD700","#FFC107","#FFB300","#FFCC02","#FFD54F",
  "#FFCA28","#FFB800","#FFD740","#FFC400","#FFDA44"
];

function createDuckSVG(color) {
  return '<svg viewBox="0 0 64 52" width="58" height="48" style="display:block;pointer-events:none;filter:drop-shadow(1px 2px 3px rgba(0,0,0,0.2))">' +
    '<ellipse cx="28" cy="34" rx="22" ry="15" fill="' + color + '" stroke="#C89600" stroke-width="0.6"/>' +
    '<circle cx="45" cy="16" r="12" fill="' + color + '" stroke="#C89600" stroke-width="0.6"/>' +
    '<polygon points="56,14 67,17 56,19" fill="#FF8C00"/>' +
    '<circle cx="48" cy="13" r="1.8" fill="#1a1a1a"/>' +
    '<ellipse cx="46" cy="12" rx="0.7" ry="0.9" fill="#fff" opacity="0.7"/>' +
    '<path d="M18,30 Q30,24 38,34 Q28,40 18,34 Z" fill="' + color + '" opacity="0.45"/>' +
  '</svg>';
}


async function loadGuestbook() {
  try {
    var res = await fetch("data/comments.json?v=" + Date.now());
    if (!res.ok) { gbComments = []; renderGeoGuestbook(); return; }
    gbComments = await res.json();
    if (!Array.isArray(gbComments)) gbComments = [];
  } catch(e) { gbComments = []; }
  try {
    var local = JSON.parse(localStorage.getItem("gb_local") || "[]");
    var syncedLocal = [];
    local.forEach(function(c) {
      if (!gbComments.some(function(x) { return x.text === c.text && x.name === c.name && x.date === c.date; })) {
        gbComments.unshift(c);
      } else {
        syncedLocal.push(c);
      }
    });
    if (syncedLocal.length > 0) {
      var remaining = local.filter(function(c) { return !syncedLocal.some(function(s) { return s.text===c.text&&s.name===c.name&&s.date===c.date; }); });
      localStorage.setItem("gb_local", JSON.stringify(remaining));
    }
  } catch(e) {}
  renderGeoGuestbook();
}
function renderGeoGuestbook() {
  var container = document.getElementById("guestbookList");
  if (!container) return;
  if (geoAnimId) { cancelAnimationFrame(geoAnimId); geoAnimId = null; }
  geoRipples = [];

  if (!gbComments || !gbComments.length) {
    container.innerHTML = '<div style="color:#6e747c;font-size:0.92rem;text-align:center;padding:3rem 0">' +
      '还没有留言，来扔一只小黄鸭吧 ??</div>';
    geoDucks = [];
    return;
  }

  container.innerHTML = '';
  container.style.cssText = 'position:relative;padding:12px;background:#1a1e24;border:1px solid #2a3038;border-radius:24px;box-shadow:0 4px 30px rgba(0,0,0,0.3)';
  container.setAttribute('data-geo', '1');

  var inner = document.createElement('div');
  inner.className = 'geo-inner';
  inner.style.cssText = 'position:relative;height:420px;overflow:hidden;'
    + 'background:radial-gradient(circle,rgba(255,255,255,0.04) 1px,transparent 1px),linear-gradient(180deg,#1e2228 0%,#1a1e24 50%,#161a20 100%);'
    + 'background-size:16px 16px,100% 100%;border-radius:16px;cursor:grab;user-select:none;'
    + 'box-shadow:inset 0 0 60px rgba(0,0,0,0.4)';
  container.appendChild(inner);

  // Water surface SVG wave
  var waveSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  waveSVG.setAttribute('class', 'geo-wave');
  waveSVG.setAttribute('width', '100%'); waveSVG.setAttribute('height', '420');
  waveSVG.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:2';
  waveSVG.innerHTML = ''
    + '<defs>'
      + '<linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">'
        + '<stop offset="0%" stop-color="rgba(41,144,192,0.06)"/>'
        + '<stop offset="60%" stop-color="rgba(41,144,192,0.10)"/>'
        + '<stop offset="100%" stop-color="rgba(41,144,192,0.16)"/>'
      + '</linearGradient>'
    + '</defs>'
    + '<rect x="0" y="' + geoWaterY + '" width="100%" height="' + (420 - geoWaterY) + '" fill="url(#waterGrad)"/>'
    + '<path class="geo-wave-path" d="M0,' + geoWaterY + ' Q120,' + (geoWaterY-6) + ' 240,' + geoWaterY + ' Q360,' + (geoWaterY+6) + ' 480,' + geoWaterY + ' Q600,' + (geoWaterY-6) + ' 720,' + geoWaterY + ' Q840,' + (geoWaterY+6) + ' 960,' + geoWaterY + ' Q1080,' + (geoWaterY-4) + ' 1200,' + geoWaterY + '"'
      + ' fill="none" stroke="rgba(41,144,192,0.25)" stroke-width="1.5"/>'
    + '<path class="geo-wave-path2" d="M0,' + (geoWaterY+4) + ' Q100,' + (geoWaterY-4) + ' 200,' + (geoWaterY+4) + ' Q300,' + (geoWaterY+8) + ' 400,' + (geoWaterY+4) + ' Q500,' + (geoWaterY-4) + ' 600,' + (geoWaterY+4) + ' Q700,' + (geoWaterY+8) + ' 800,' + (geoWaterY+4) + ' Q900,' + (geoWaterY-4) + ' 1000,' + (geoWaterY+4) + ' Q1100,' + (geoWaterY+6) + ' 1200,' + (geoWaterY+4) + '"'
      + ' fill="none" stroke="rgba(41,144,192,0.12)" stroke-width="1"/>';
  inner.appendChild(waveSVG);

  geoInfo = document.createElement('div');
  geoInfo.className = 'geo-info';
  geoInfo.innerHTML = '<div class="geo-info-inner"></div>';
  inner.appendChild(geoInfo);

  var W = inner.clientWidth || geoContainerW;
  var H = 420;
  var cols = Math.min(gbComments.length, 5);

  geoDucks = [];
  gbComments.slice(0, 30).forEach(function(c, i) {
    var color = DUCK_COLORS[i % DUCK_COLORS.length];
    var size = 52 + Math.floor(Math.random() * 8);
    var el = document.createElement('div');
    el.className = 'geo-duck';
    el.style.cssText = 'position:absolute;width:' + size + 'px;height:' + Math.round(size*0.83) + 'px;'
      + 'transition:transform 0.05s linear;z-index:4;cursor:pointer';
    el.innerHTML = createDuckSVG(color);
    el.setAttribute('data-idx', i);
    el.title = (c.name || 'anonymous') + ' | ' + (c.text || '').substring(0, 40);

    var isNew = (i === 0 && geoNewIdx === 0);
    var startX = 30 + (i % cols) * (W / cols) + Math.random() * 30;
    var startY = isNew ? -size : geoWaterY + Math.random() * 50 - 25;

    el.addEventListener('click', function(ev) {
      ev.stopPropagation();
      var idx = parseInt(this.getAttribute('data-idx'));
      var duck = geoDucks[idx];
      if (!duck) return;
      var inn = document.querySelector('[data-geo] .geo-inner');
      if (!inn) return;
      showGeoInfo(duck, inn);
    });
    inner.appendChild(el);

    geoDucks.push({
      el: el, color: color,
      x: startX, y: startY,
      vx: (Math.random() - 0.5) * 0.5, vy: isNew ? 0 : (Math.random() - 0.5) * 0.3,
      size: size, mass: 0.6 + Math.random() * 0.3,
      comment: c,
      angle: Math.random() * 0.3 - 0.15,
      av: 0
    });
  });

  geoLoop(W, H);
  startWaveAnimation();
}

function startWaveAnimation() {
  var phase = 0, _wTimer = 0, _p1 = null, _p2 = null;
  function animate(ts) {
    if (document.hidden) { requestAnimationFrame(animate); return; }
    if (ts - _wTimer < 33) { requestAnimationFrame(animate); return; }
    _wTimer = ts;
    if (!_p1) {
      if (!document.querySelector('[data-geo]')) { requestAnimationFrame(animate); return; }
      _p1 = document.querySelector('.geo-wave-path');
      _p2 = document.querySelector('.geo-wave-path2');
    }
    if (!_p1) { requestAnimationFrame(animate); return; }
    phase += 0.04;
    waterWaveBoost = waterWaveBoost * 0.97 + 1.0 * 0.03;
    var amp = waterWaveBoost;
    var y0 = geoWaterY;
    var d = '', d2 = '';
    for (var x = 0; x <= 800; x += 160) {
      var y = y0 + (Math.sin(x/80 + phase) * 7 + Math.cos(x/140 + phase*0.7) * 5) * amp;
      d += (x === 0 ? 'M' : 'Q') + x + ',' + Math.round(y) + ' ';
    }
    _p1.setAttribute('d', d);
    if (_p2) {
      for (var x2 = 0; x2 <= 800; x2 += 133) {
        var y2 = y0 + 4 + (Math.sin(x2/90 + phase*1.3) * 5 + Math.cos(x2/120 + phase*0.9) * 3.5) * amp;
        d2 += (x2 === 0 ? 'M' : 'Q') + x2 + ',' + Math.round(y2) + ' ';
      }
      _p2.setAttribute('d', d2);
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

function spawnRipple(x, y, inner) {
  // Simple expanding ring at water surface
  var ripple = document.createElement('div');
  ripple.style.cssText = 'position:absolute;left:' + (x-3) + 'px;top:' + (y-3) + 'px;'
    + 'width:6px;height:6px;border-radius:50%;'
    + 'border:1.5px solid rgba(160,210,235,0.6);'
    + 'background:rgba(160,210,235,0.1);'
    + 'animation:duckRipple 1.5s ease-out forwards;'
    + 'pointer-events:none;z-index:3';
  inner.appendChild(ripple);
  setTimeout(function() { if (ripple.parentElement) ripple.remove(); }, 1600);
  
  // Boost water wave amplitude on impact
  waterWaveBoost = 3.0;
}

function spawnSplash(x, y, vy, inner) {
  var speed = Math.abs(vy);
  var count = Math.min(20, Math.max(5, Math.floor(speed * 2.5)));
  var isEntering = vy > 0;
  for (var i = 0; i < count; i++) {
    var particle = document.createElement('div');
    var angle = (Math.random() - 0.5) * Math.PI * 0.9 + (isEntering ? -Math.PI/2 : Math.PI/2);
    var dist = 20 + Math.random() * 60 * Math.min(1, speed / 5);
    var sx = Math.cos(angle) * dist;
    var sy = Math.sin(angle) * dist - (isEntering ? 0 : 20);
    var size = 3 + Math.random() * 6;
    var lifetime = 0.6 + Math.random() * 0.8;
    
    particle.style.cssText =
      'position:absolute;left:' + (x - size/2) + 'px;top:' + (y - size/2) + 'px;'
      + 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;'
      + 'background:rgba(41,144,192,' + (0.5 + Math.random() * 0.4) + ');'
      + 'pointer-events:none;z-index:4;'
      + 'transition:transform ' + lifetime + 's ease-out,opacity ' + lifetime + 's ease-out;'
      + 'transform:translate(0,0) scale(1);opacity:0.9';
    
    inner.appendChild(particle);
    
    var forceReflow = particle.offsetHeight;
    
    particle.style.transform = 'translate(' + sx + 'px, ' + sy + 'px) scale(0.15)';
    particle.style.opacity = '0';
    
    var timeout = lifetime * 1000 + 200;
    setTimeout(function() { if (particle.parentElement) particle.remove(); }, timeout);
  }
}

function updateDuckPos(d) {
  d.el.style.left = (d.x - d.size/2) + 'px';
  d.el.style.top = (d.y - d.size/2) + 'px';
  d.el.style.transform = 'rotate(' + d.angle + 'rad)';
}

function geoLoop(W, H) {
  var waterY = geoWaterY;

  geoDucks.forEach(function(d) {
    if (geoMouse.drag === d) return;

    var wasAbove = d.y < waterY;

    // Buoyancy: ducks float when in water
    var submerged = Math.max(0, d.y - waterY);
    var subRatio = Math.min(1, submerged / d.size);

    if (submerged > 0) {
      // Smooth progressive buoyancy — ducks float at ~25% submerged equilibrium
      var eqDepth = d.size * 0.22;
      if (submerged > eqDepth) {
        d.vy -= (submerged - eqDepth) * 0.005;
      }
      d.vy -= subRatio * 0.07;
      d.vx *= 0.986;
      d.vy *= 0.986;
      d.av *= 0.965;
      d.vy += Math.sin(Date.now()/400 + d.x/40) * 0.025;
      d.av += (Math.random() - 0.5) * 0.003;
    } else {
      d.vy += 0.28;
      d.vx *= 0.997;
      d.vy *= 0.997;
      d.av *= 0.98;
    }

        d.x += d.vx;
    d.y += d.vy;
    d.angle += d.av;

    var r = d.size / 2;
    if (d.x - r < 0) { d.x = r; d.vx = Math.abs(d.vx) * 0.5; }
    if (d.x + r > W) { d.x = W - r; d.vx = -Math.abs(d.vx) * 0.5; }
    if (d.y - r < 0) { d.y = r; d.vy = Math.abs(d.vy) * 0.5; }
    if (d.y + r > H) { d.y = H - r; d.vy = -Math.abs(d.vy) * 0.35; d.vx *= 0.85; }

    // Water surface crossing — dampen + ripple + splash
    var isAbove = d.y < waterY;
    if (!wasAbove && isAbove && d.vy < -0.5) {
      var vBefore = d.vy;
      d.vy *= 0.55;
      var inner = document.querySelector('[data-geo] .geo-inner');
      if (inner) { spawnRipple(d.x, waterY, inner); spawnSplash(d.x, waterY, vBefore, inner); }
    }
    if (wasAbove && !isAbove && d.vy > 1.2) {
      var vBefore2 = d.vy;
      d.vy *= 0.55;
      var inner2 = document.querySelector('[data-geo] .geo-inner');
      if (inner2) { spawnRipple(d.x, waterY, inner2); spawnSplash(d.x, waterY, vBefore2, inner2); }
    }

    updateDuckPos(d);
  });

  // Collision between ducks
  for (var i = 0; i < geoDucks.length; i++) {
    for (var j = i + 1; j < geoDucks.length; j++) {
      var a = geoDucks[i], b = geoDucks[j];
      if (geoMouse.drag === a || geoMouse.drag === b) continue;
      var dx = b.x - a.x, dy = b.y - a.y;
      var dist = Math.sqrt(dx*dx + dy*dy);
      var minDist = (a.size + b.size) / 2;
      if (dist < minDist && dist > 0.01) {
        var nx = dx / dist, ny = dy / dist;
        var overlap = minDist - dist;
        var totalMass = a.mass + b.mass;
        a.x -= nx * overlap * (b.mass / totalMass);
        a.y -= ny * overlap * (b.mass / totalMass);
        b.x += nx * overlap * (a.mass / totalMass);
        b.y += ny * overlap * (a.mass / totalMass);
        var dvx = a.vx - b.vx, dvy = a.vy - b.vy;
        var dvn = dvx * nx + dvy * ny;
        if (dvn > 0) {
          var imp = 1.8 * dvn / totalMass;
          a.vx -= imp * b.mass * nx; a.vy -= imp * b.mass * ny;
          b.vx += imp * a.mass * nx; b.vy += imp * a.mass * ny;
          a.av += (b.vy - a.vy) * 0.015;
          b.av += (a.vy - b.vy) * 0.015;
        }
        updateDuckPos(a); updateDuckPos(b);
      }
    }
  }

  if (!document.hidden) { geoAnimId = requestAnimationFrame(function() { geoLoop(W, H); }); } else { setTimeout(function() { geoAnimId = requestAnimationFrame(function() { geoLoop(W, H); }); }, 200); }
}

document.addEventListener('mousedown', function(e) {
  var inner = document.querySelector('[data-geo] .geo-inner');
  if (!inner) return;
  var target = e.target.closest('.geo-duck');
  if (!target) return;
  e.preventDefault();
  var idx = parseInt(target.getAttribute('data-idx'));
  var duck = geoDucks[idx];
  if (!duck) return;
  var rect = inner.getBoundingClientRect();
  geoMouse.down = true;
  geoMouse.drag = duck;
  geoMouse.ox = e.clientX - rect.left - duck.x;
  geoMouse.oy = e.clientY - rect.top - duck.y;
  duck.el.style.zIndex = 10;
  duck.el.style.transition = 'none';
  inner.style.cursor = 'grabbing';
});

document.addEventListener('mousemove', function(e) {
  var inner = document.querySelector('[data-geo] .geo-inner');
  if (!inner) return;
  var rect = inner.getBoundingClientRect();
  if (geoMouse.drag && geoMouse.down) {
    var duck = geoMouse.drag;
    duck.vx = (e.clientX - rect.left - duck.x - geoMouse.ox) * 0.8;
    duck.vy = (e.clientY - rect.top - duck.y - geoMouse.oy) * 0.8;
    duck.x = e.clientX - rect.left - geoMouse.ox;
    duck.y = e.clientY - rect.top - geoMouse.oy;
    updateDuckPos(duck);
  }
});

document.addEventListener('mouseup', function(e) {
  var inner = document.querySelector('[data-geo] .geo-inner');
  if (!inner) return;
  if (geoMouse.drag && geoMouse.down) {
    var duck = geoMouse.drag;
    showGeoInfo(duck, inner);
    duck.el.style.zIndex = 4;
    duck.el.style.transition = 'transform 0.05s linear';
    inner.style.cursor = 'grab';
  }
  geoMouse.down = false;
  geoMouse.drag = null;
});

document.addEventListener('touchstart', function(e) {
  var inner = document.querySelector('[data-geo] .geo-inner');
  if (!inner) return;
  var target = e.target.closest('.geo-duck');
  if (!target) return;
  e.preventDefault();
  var idx = parseInt(target.getAttribute('data-idx'));
  var duck = geoDucks[idx];
  if (!duck) return;
  var rect = inner.getBoundingClientRect();
  var touch = e.touches[0];
  geoMouse.down = true;
  geoMouse.drag = duck;
  geoMouse.ox = touch.clientX - rect.left - duck.x;
  geoMouse.oy = touch.clientY - rect.top - duck.y;
  duck.el.style.zIndex = 10;
  duck.el.style.transition = 'none';
}, { passive: false });

document.addEventListener('touchmove', function(e) {
  if (geoMouse.drag && geoMouse.down) {
    e.preventDefault();
    var inner = document.querySelector('[data-geo] .geo-inner');
    if (!inner) return;
    var rect = inner.getBoundingClientRect();
    var touch = e.touches[0];
    var duck = geoMouse.drag;
    duck.vx = (touch.clientX - rect.left - duck.x - geoMouse.ox) * 0.8;
    duck.vy = (touch.clientY - rect.top - duck.y - geoMouse.oy) * 0.8;
    duck.x = touch.clientX - rect.left - geoMouse.ox;
    duck.y = touch.clientY - rect.top - geoMouse.oy;
    updateDuckPos(duck);
  }
}, { passive: false });

document.addEventListener('touchend', function(e) {
  if (geoMouse.drag && geoMouse.down) {
    var duck = geoMouse.drag;
    var inner = document.querySelector('[data-geo] .geo-inner');
    if (inner) showGeoInfo(duck, inner);
    duck.el.style.zIndex = 4;
    duck.el.style.transition = 'transform 0.05s linear';
  }
  geoMouse.down = false;
  geoMouse.drag = null;
});

function showGeoInfo(duck, inner) {
  var existing = document.querySelector('.geo-popup-on');
  if (existing) existing.parentElement.removeChild(existing);

  var c = duck.comment;
  var popup = document.createElement('div');
  popup.className = 'geo-popup-on';
  popup.innerHTML = '<button class="geo-popup-close" onclick="this.parentElement.remove()">&times;</button>'
    + '<strong style="color:' + duck.color + '">' + (c.name || 'anonymous') + '</strong>'
    + '<span style="font-size:0.7rem;color:#888;margin-left:0.5rem">' + (c.date || '') + '</span>'
    + '<p style="margin-top:0.6rem;line-height:1.7;color:#e0e4ec">' + (c.text || '').replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</p>';
  popup.style.cssText = 'position:absolute;width:240px;background:rgba(30,35,50,0.94);'
    + 'backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:14px;'
    + 'border:1px solid rgba(255,255,255,0.12);box-shadow:0 12px 40px rgba(0,0,0,0.3);'
    + 'padding:1.2rem;z-index:9999;font-size:0.85rem;pointer-events:auto';

  var rect = inner.getBoundingClientRect();
  var top = duck.y + duck.size/2 + 5;
  var left = Math.max(10, Math.min(rect.width - 260, duck.x - 120));
  var maxH = inner.clientHeight || 420;
  if (top + 150 > maxH) top = duck.y - 150;
  if (top < 0) top = 10;
  popup.style.top = top + 'px';
  popup.style.left = left + 'px';
  inner.appendChild(popup);
  setTimeout(function() { if (popup.parentElement) popup.remove(); }, 8000);
}


function addNewDuck(comment, inner) {
  if (!inner) inner = document.querySelector('[data-geo] .geo-inner');
  if (!inner) return;
  
  var color = DUCK_COLORS[Math.floor(Math.random() * DUCK_COLORS.length)];
  var size = 50 + Math.floor(Math.random() * 15);
  var W = inner.clientWidth || 680;
  var x = 30 + Math.random() * (W - 60);
  var y = -size;  // Start above the container

  var el = document.createElement('div');
  el.className = 'geo-duck';
  el.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;'
    + 'width:' + size + 'px;height:' + size + 'px;'
    + 'cursor:grab;user-select:none;z-index:2;';
  el.setAttribute('data-idx', geoDucks.length);
  el.innerHTML = createDuckSVG(color);
  el.addEventListener('click', function(e) {
    e.stopPropagation();
    showGeoInfo(geoDucks[parseInt(el.getAttribute('data-idx'))], inner);
  });
  inner.appendChild(el);

  geoDucks.push({
    el: el, color: color,
    x: x, y: y,
    vx: (Math.random() - 0.5) * 2,
    vy: 0,
    size: size,
    mass: 0.6 + Math.random() * 0.3,
    comment: comment,
    angle: Math.random() * 0.3 - 0.15,
    av: 0
  });
}
async function submitGuestbook(name, text) {
  var comment = { name: name, text: text, date: new Date().toISOString().slice(0, 10) };
  gbComments.unshift(comment);
  if (typeof window.submitDuckMessage === "function") { window.submitDuckMessage(name, text); }
  var msgEl = document.getElementById("gbMsg");
  if (msgEl) { msgEl.textContent = "🦆 鸭子已入水！"; msgEl.style.color = "#00d4aa"; }
}


function initGuestbook() {
  // duck-pool.js v5.0 自行管理留言加载与渲染
  var form = document.getElementById("guestbookForm");
  if (!form) return;
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    var name = document.getElementById("gbName").value.trim() || "匿名";
    var text = document.getElementById("gbText").value.trim();
    var msg = document.getElementById("gbMsg");
    if (!text) { msg.textContent = "请输入留言内容"; msg.style.color = "#c62828"; return; }
    submitGuestbook(name, text);
    form.reset();
    setTimeout(function() { msg.textContent = ""; }, 3000);
  });
}



function latteInitPage() {
  initBackToTop();
  highlightNav();
  initGuestbook();
  var hasHomeModules = document.querySelector('.about .container, .random-listen .container, .interest-grid, #homeBlogList');
  if (hasHomeModules) {
    var homePromise = renderHome();
    homePromise.then(function() { initFadeIn(); });
  }
  if (document.querySelector('.blog-list')) renderBlog();
  if (document.querySelector('.interest-page')) renderInterestPage();
  if (!hasHomeModules && !document.querySelector('.blog-list') && !document.querySelector('.interest-page')) initFadeIn();
}

window.LatteInitPage = latteInitPage;
document.addEventListener('DOMContentLoaded', latteInitPage);

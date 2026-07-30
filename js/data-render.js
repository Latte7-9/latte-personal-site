// ====== Latte v3.0 数据渲染适配器 ======

// 兴趣标签和书籍渲染（独立函数，支持回退）
function renderInterestsBooks(data) {
  var interestTags = document.getElementById('interestTags');
  if (interestTags && data.interests) {
    var tagsHTML = '';
    data.interests.forEach(function(item) {
      if (item.hobbies && item.hobbies.length > 0) {
        item.hobbies.forEach(function(hobby) {
          tagsHTML += '<span class="interest-tag">' + getHobbyEmoji(hobby) + ' ' + hobby + '</span>';
        });
      } else {
        var icon = getEmoji(item.icon);
        var url = item.page || '#';
        tagsHTML += '<a class="interest-tag" href="' + url + '">' + icon + ' ' + item.name + '</a>';
      }
    });
    interestTags.innerHTML = tagsHTML;
  }

  var bookMiniList = document.getElementById('bookMiniList');
  if (bookMiniList) {
    var allBooks = [];
    if (data.books) allBooks = allBooks.concat(data.books);
    if (data.interests) {
      data.interests.forEach(function(item) {
        if (item.read) allBooks = allBooks.concat(item.read);
        if (item.reading) allBooks = allBooks.concat(item.reading);
      });
    }
    var seen = {};
    allBooks = allBooks.filter(function(b) {
      if (seen[b.title]) return false;
      seen[b.title] = true;
      return true;
    });
    if (allBooks.length > 0) {
      var booksHTML = '';
      allBooks.forEach(function(b) {
        booksHTML += '<div class="book-mini-item">' +
          '<img class="book-mini-cover" src="' + b.cover + '" alt="' + b.title + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';" style="width:30px;height:42px;object-fit:cover;border-radius:3px;flex-shrink:0;background:linear-gradient(135deg,rgba(255,61,113,0.2),rgba(0,212,170,0.2));"><div class="book-mini-cover-fallback" style="display:none;width:30px;height:42px;border-radius:3px;flex-shrink:0;background:' + getBookGradient(b.title) + ';"></div>' +
          '<div><div class="book-mini-title">' + b.title + '</div>' +
          '<div class="book-mini-author">' + (b.author || '') + '</div></div></div>';
      });
      bookMiniList.innerHTML = booksHTML;
    }
  }
}

function renderInterestsBooksFallback() {
  var fb = {
    interests: [
      { name: '摄影', icon: 'camera', page: 'interests/photography.html' },
      { name: '书籍', icon: 'book', page: 'interests/books.html' },
      { name: '三分钟热度', icon: 'sparkle', page: 'interests/hobbies.html', hobbies: ['手冲咖啡','钩织','吉他','烹饪','动漫','徒步','想学攀岩'] },
      { name: '徒步', icon: 'mountain', page: 'interests/hiking.html' }
    ],
    books: [
      { title: '《我与地坛》', author: '史铁生' },
      { title: '《面纱》', author: '毛姆' },
      { title: '《罪与罚》', author: '陀思妥耶夫斯基' }
    ]
  };
  renderInterestsBooks(fb);
}


async function renderHome() {
  try {
    var data = await loadJSON('data/site.json');
    if (!data) { renderInterestsBooksFallback(); return; }

    // 关于我
    var aboutMeta = document.getElementById('aboutMeta');
    var aboutTagline = document.getElementById('aboutTagline');
    if (data.about && aboutMeta) {
      var parts = data.about.split('<br>');
      aboutMeta.textContent = parts[0].trim();
      aboutTagline.textContent = parts[1] ? parts[1].trim() : '三分钟热度，但足够热！';
    }

    renderInterestsBooks(data);

    // 联系方式
    var contactIcons = document.getElementById('contactIcons');
    if (contactIcons) {
      var iconsHTML = '';
      if (data.contact && data.contact.email) {
        iconsHTML += '<a class="contact-icon" href="mailto:' + data.contact.email + '" title="邮箱">📧</a>';
      }
      iconsHTML += '<a class="contact-icon" href="https://github.com/Latte7-9" target="_blank" rel="noopener" title="GitHub">🐙</a>';
      contactIcons.innerHTML = iconsHTML;
    }

    // 音乐板块
    loadMusicSongs();

    // 博客预览
    renderHomeBlogV3();

  } catch(e) {
    console.error('renderHome error:', e);
    renderInterestsBooksFallback();
    renderHomeBlogV3();
  }
}

// ====== 博客预览 (使用新 CSS 类) ======
async function renderHomeBlogV3() {
  var list = document.getElementById('homeBlogList');
  if (!list) return;
  try {
    var res = await fetch('data/blog.json?v=' + Date.now());
    if (!res.ok) throw new Error('fetch failed');
    var data = await res.json();
    if (!data.posts || !data.posts.length) {
      list.innerHTML = '<div style="color:#666;font-size:0.8rem;padding:1rem;">还没有博客文章 ✨</div>';
      return;
    }
    list.innerHTML = data.posts.slice(-3).reverse().map(function(p) {
      return '<a class="blog-card gradient-border-card tilt-card" href="blog/posts/' + p.file + '" style="text-decoration:none;color:inherit;">' +
        '<div class="blog-card-inner">' +
        '<div class="blog-card-date">' + p.date + '</div>' +
        '<div class="blog-card-title">' + p.title + '</div>' +
        '<div class="blog-card-excerpt">' + (p.summary || '').substring(0, 80) + '</div>' +
        '</div></a>';
    }).join('');
  } catch(e) {
    list.innerHTML = '<div style="color:#666;font-size:0.8rem;padding:1rem;">还没有博客文章 ✨</div>';
  }
}

// ====== 音乐加载 ======
async function loadMusicSongs() {
  var container = document.querySelector('.music-card');
  if (!container) return;

  var API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? '' : 'https://latte-site-production.up.railway.app';

  try {
    var resp = await fetch(API_BASE + '/api/netease/weekly');
    var ndata = await resp.json();
    if (ndata.songs && ndata.songs.length > 0) {
      var songsHTML = '<div class="music-label">🎵 耳机是精神输液管</div>';
      songsHTML += '<div class="music-song-list">';
      ndata.songs.slice(0, 5).forEach(function(song, i) {
        songsHTML += '<a class="music-song-item" href="' + song.url + '" target="_blank" rel="noopener">' +
          '<span class="music-song-rank">' + (i + 1) + '</span>' +
          '<span class="music-song-name">' + escHtml(song.name) + '</span>' +
          '<span class="music-song-artist">' + escHtml(song.artists) + '</span></a>';
      });
      songsHTML += '</div>';
      songsHTML += '<button class="btn-primary" id="musicRandomBtn">🎵 与我随心一听</button>';
      container.innerHTML = songsHTML;
      var btn = document.getElementById('musicRandomBtn');
      if (btn) {
        btn.addEventListener('click', async function() {
          btn.textContent = '🎵 正在挑选...'; btn.disabled = true;
          try {
            var r = await fetch(API_BASE + '/api/netease/random');
            var d = await r.json();
            if (d.song && d.song.url) window.open(d.song.url, '_blank', 'noopener');
          } catch(e2) {}
          btn.textContent = '🎵 与我随心一听'; btn.disabled = false;
        });
      }
      return;
    }
  } catch(e) { console.log('Music API unavailable'); }
  
  // 回退: site.json
  var siteData = await loadJSON('data/site.json').catch(function() { return null; });
  if (siteData && siteData.currently && siteData.currently.listening) {
    var listening = siteData.currently.listening;
    var m = listening.match(/《(.+?)》/);
    container.innerHTML = '<div class="music-label">🎵 耳机是精神输液管</div>' +
      '<div class="music-song-list"><div class="music-song-item">' +
      '<span class="music-song-rank">1</span>' +
      '<span class="music-song-name">' + (m ? '《' + m[1] + '》' : listening) + '</span>' +
      '<span class="music-song-artist">' + listening.replace(m ? '《' + m[1] + '》' : '', '').trim() + '</span>' +
      '</div></div>' +
      '<button class="btn-primary" disabled>🎵 离线模式</button>';
  }
}

function escHtml(s) {
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}

// ====== 工具 ======
function getEmoji(iconName) {
  var map = { camera: '📷', book: '📖', sparkle: '✨', mountain: '⛰️' };
  return map[iconName] || '';
}

function getHobbyEmoji(hobby) {
  var map = { '手冲咖啡': '☕', '钩织': '🧶', '吉他': '🎸', '烹饪': '🍳', '动漫': '🎬', '徒步': '🥾', '想学攀岩': '🧗' };
  return map[hobby] || '';
}

function getBookGradient(title) {
  var g = [
    'linear-gradient(135deg,rgba(255,61,113,0.3),rgba(0,212,170,0.2))',
    'linear-gradient(135deg,rgba(0,212,170,0.3),rgba(255,184,0,0.2))',
    'linear-gradient(135deg,rgba(255,184,0,0.3),rgba(255,61,113,0.2))',
    'linear-gradient(135deg,rgba(124,77,255,0.3),rgba(0,212,170,0.2))'
  ];
  var h = 0;
  for (var i = 0; i < title.length; i++) h = title.charCodeAt(i) + ((h << 5) - h);
  return g[Math.abs(h) % g.length];
}

// ====== 初始化 ======
var _initDone = false;
document.addEventListener('DOMContentLoaded', function() {
  if (_initDone) return;
  _initDone = true;
  if (typeof initIntro === 'function') initIntro();
  if (typeof initVinylPlayer === 'function') initVinylPlayer();
  renderHome();
  // 鸭子水池表单绑定
  var gbForm = document.getElementById('guestbookForm');
  if (gbForm) {
    gbForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var name = document.getElementById('gbName').value.trim() || '匿名';
      var text = document.getElementById('gbText').value.trim();
      var msgEl = document.getElementById('gbMsg');
      if (!text) { if (msgEl) { msgEl.textContent = '请输入留言内容'; msgEl.style.color = '#c62828'; } return; }
      if (typeof submitDuckMessage === 'function') submitDuckMessage(name, text);
      if (msgEl) { msgEl.textContent = '🦆 鸭子已投入水池！'; msgEl.style.color = '#00d4aa'; }
      gbForm.reset();
      setTimeout(function() { if (msgEl) msgEl.textContent = ''; }, 2500);
    });
  }
  if (typeof initBackToTop === 'function') initBackToTop();
  if (typeof initGridBackground === 'function') initGridBackground();
  setTimeout(function() {
    if (typeof initScrollAnimations === 'function') initScrollAnimations();
  }, 800);
});



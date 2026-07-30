// ====== 子页面渲染适配 v3.0 ======
// 覆盖 main.js 中的 renderBlog / renderInterestPage，使用新设计类

var _origRenderBlog = renderBlog;
renderBlog = async function() {
  var list = document.querySelector('.blog-list');
  if (!list) return _origRenderBlog();

  try {
    var res = await fetch('../data/blog.json?v=' + Date.now());
    if (!res.ok) throw new Error('fetch failed');
    var data = await res.json();
    if (!data.posts || !data.posts.length) {
      list.innerHTML = '<div style="padding:2rem;text-align:center;color:#666;">还没有文章 ✨</div>';
      return;
    }
    list.innerHTML = data.posts.reverse().map(function(p) {
      return '<a href="posts/' + p.file + '" class="blog-post-card gradient-border-card tilt-card" style="display:block;text-decoration:none;color:inherit;margin-bottom:1rem;">' +
        '<div style="padding:1.2rem 1.5rem;">' +
        '<div class="blog-card-date">' + p.date + '</div>' +
        '<h3 class="blog-card-title">' + p.title + '</h3>' +
        '<p class="blog-card-summary">' + (p.summary || '') + '</p>' +
        '<div class="blog-card-link">阅读文章 →</div>' +
        '</div></a>';
    }).join('');
  } catch(e) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:#666;">还没有文章 ✨</div>';
  }
};

var _origRenderInterestPage = renderInterestPage;
renderInterestPage = async function() {
  var pageName = window.location.pathname.split('/').pop().replace('.html','');
  var data = await loadJSON('../data/site.json');
  if (!data || !data.interests) { if (_origRenderInterestPage) return _origRenderInterestPage(); return; }

  var item = data.interests.find(function(i) { return i.page && i.page.indexOf(pageName) !== -1; });
  if (data.githubRepo) window._siteGithubRepo = data.githubRepo;
  if (!item) { if (_origRenderInterestPage) return _origRenderInterestPage(); return; }

  var hero = document.querySelector('.page-hero .container, .interest-page .container');
  if (hero) {
    var displayName = pageName === 'books' ? '书架' : item.name;
    hero.innerHTML = '<p class="motion-label">INTEREST MODULE</p><h1>' + displayName + '</h1>' +
      '<p style="font-size:1rem;color:var(--text-muted);margin-top:0.5rem;font-weight:300;">' + (item.description || '') + '</p>';
  }

  var content = document.querySelector('.interest-content-area');
  if (!content) return;

  switch(pageName) {
    case 'photography':
      renderPhotography(content, item); break;
    case 'books':
      renderBooks(content, item); break;
    case 'hiking':
      renderHiking(content, item); break;
    case 'hobbies':
      renderHobbies(content, item); break;
    default:
      content.innerHTML = '<div class="gradient-border-card" style="padding:2rem;text-align:center;color:var(--text-muted);">内容加载中...</div>';
  }
};

// ====== 图集系统：列表 + 灯箱详情 ======
var _albumList = [];
var _albumCurrentIdx = -1;
var _albumImgIdx = 0;
var _albumContainer = null;

var _imageBase = null;
function getImageBase() {
  if (_imageBase) return _imageBase;
  var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal) {
    _imageBase = '../';
  } else {
    _imageBase = '../';
  }
  return _imageBase;
}
function resolveImageUrl(imgPath) {
  if (!imgPath) return '';
  if (/^https?:\/\//i.test(imgPath)) return imgPath;
  var base = getImageBase();
  var parts = imgPath.split('/');
  var encoded = parts.map(function(p) { return encodeURIComponent(p); }).join('/');
  return base + encoded;
}

function renderHiking(container, item) {
  var html = '';

  if (item.journal) {
    html += '<div class="gradient-border-card" style="padding:1.2rem 1.5rem;margin-bottom:1rem;">' +
      '<div style="color:var(--text-body);font-size:0.9rem;line-height:2;">' + item.journal + '</div></div>';
  }

  if (item.climbed && item.climbed.length > 0) {
    html += '<h3 style="color:var(--neon-pink);font-weight:400;margin:1rem 0 0.6rem;">⛰️ 已走过</h3>';
    item.climbed.forEach(function(m) {
      html += '<div class="gradient-border-card tilt-card" style="margin-bottom:0.6rem;padding:0.8rem 1.2rem;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="color:var(--text-primary);font-size:0.9rem;">' + m.name + '</span>' +
        '<span style="color:var(--text-dim);font-size:0.7rem;">' + m.date + '</span></div>' +
        (m.note ? '<div style="color:var(--text-muted);font-size:0.75rem;margin-top:0.3rem;line-height:1.6;">' + m.note + '</div>' : '') +
        '</div>';
    });
  }

  if (item.wantToClimb && item.wantToClimb.length > 0) {
    html += '<h3 style="color:var(--neon-cyan);font-weight:400;margin:1rem 0 0.6rem;">🗻 想去</h3>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">';
    item.wantToClimb.forEach(function(m) {
      html += '<span class="gradient-border-card" style="padding:0.5rem 1rem;font-size:0.8rem;color:var(--text-body);">' +
        m.name + (m.reason ? ' <span style="color:var(--text-dim);font-size:0.7rem;">— ' + m.reason + '</span>' : '') +
        '</span>';
    });
    html += '</div>';
  }

  container.innerHTML = html || '<div style="color:var(--text-dim);text-align:center;padding:2rem;">暂无徒步记录</div>';
}

function renderHobbies(container, item) {
  if (!item.hobbies) return;
  var html = '<div style="display:flex;flex-wrap:wrap;gap:0.8rem;justify-content:center;">';
  item.hobbies.forEach(function(h, i) {
    var colors = ['#ff3d71','#00d4aa','#ffb800','#2990c0','#7c4dff','#ff6d3a','#3ad4ff'];
    var c = colors[i % colors.length];
    html += '<div class="gradient-border-card tilt-card" style="width:140px;padding:1.5rem 1rem;text-align:center;">' +
      '<div style="font-size:2.5rem;margin-bottom:0.5rem;">' + getHobbyEmoji(h) + '</div>' +
      '<div style="color:var(--text-primary);font-size:0.85rem;">' + h + '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function getEmoji(iconName) {
  var m = { camera:'📷', book:'📉', sparkle:'✨', mountain:'⛰️' };
  return m[iconName] || '';
}
function getHobbyEmoji(h) {
  var m = { '手冲咖啡':'☕', '钩织':'🧶', '吉他':'🎸', '烹饪':'🍳', '动漫':'🎬', '徒步':'🥾', '想学攀岩':'🧗' };
  return m[h] || '🎯';
}

// ====== 自动初始化 ======
document.addEventListener('DOMContentLoaded', function() {
  if (document.querySelector('.interest-page') || document.querySelector('.interest-content-area')) {
    if (typeof renderInterestPage === 'function') renderInterestPage();
  }
  if (document.querySelector('.blog-list')) {
    if (typeof renderBlog === 'function') renderBlog();
  }
  setTimeout(function() {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      gsap.utils.toArray('.fade-in, .gradient-border-card, .blog-post-card').forEach(function(el, i) {
        gsap.fromTo(el, { opacity: 0, y: 24 }, {
          opacity: 1, y: 0, duration: 0.6, delay: i * 0.08, ease: 'power2.out'
        });
      });
    }
  }, 400);
});

function escSub(value) {
  return String(value || '').replace(/[&<>"']/g, function(ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

function openAlbumImage(albumIdx, imageIdx) {
  _albumCurrentIdx = albumIdx;
  _albumImgIdx = imageIdx || 0;
  showAlbumLightbox();
}

window.openAlbumImage = openAlbumImage;
window.closeAlbum = closeAlbum;

if (!window._lattePhotoLightboxCaptureBound) {
  window._lattePhotoLightboxCaptureBound = true;
  document.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('.photo-thumb');
    if (!btn) return;
    var albumIdx = Number(btn.getAttribute('data-album-idx'));
    var imageIdx = Number(btn.getAttribute('data-image-idx'));
    if (!Number.isFinite(albumIdx) || !Number.isFinite(imageIdx)) return;
    e.preventDefault();
    openAlbumImage(albumIdx, imageIdx);
  }, true);
}

function closeAlbum() {
  var lb = document.getElementById('albumLightbox');
  if (lb) lb.remove();
  document.onkeydown = null;
  _albumCurrentIdx = -1;
}

function showAlbumLightbox() {
  closeAlbum();
  var album = _albumList[_albumCurrentIdx];
  if (!album || !album.images || !album.images.length) return;

  var images = album.images;
  var startX = 0;
  var lb = document.createElement('div');
  lb.id = 'albumLightbox';
  lb.className = 'album-lightbox-modern';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');

  var top = document.createElement('div');
  top.className = 'album-lightbox-top';
  var title = document.createElement('strong');
  title.textContent = album.name || '\u56fe\u96c6';
  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '\u5173\u95ed';
  top.appendChild(title);
  top.appendChild(closeBtn);

  var prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'album-lightbox-nav album-lightbox-prev';
  prevBtn.textContent = '<';
  prevBtn.setAttribute('aria-label', '\u4e0a\u4e00\u5f20');

  var img = document.createElement('img');
  img.alt = album.name || '\u6444\u5f71\u7167\u7247';

  var nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'album-lightbox-nav album-lightbox-next';
  nextBtn.textContent = '>';
  nextBtn.setAttribute('aria-label', '\u4e0b\u4e00\u5f20');

  var bottom = document.createElement('div');
  bottom.className = 'album-lightbox-bottom';
  var count = document.createElement('span');
  var hint = document.createElement('span');
  hint.textContent = '\u952e\u76d8\u0020\u2190\u0020\u002f\u0020\u2192\u0020\u6216\u6ed1\u52a8\u5207\u6362';
  bottom.appendChild(count);
  bottom.appendChild(hint);

  lb.appendChild(top);
  lb.appendChild(prevBtn);
  lb.appendChild(img);
  lb.appendChild(nextBtn);
  lb.appendChild(bottom);
  document.body.appendChild(lb);

  function update() {
    img.src = resolveImageUrl(images[_albumImgIdx]);
    count.textContent = (_albumImgIdx + 1) + ' / ' + images.length;
    prevBtn.style.display = images.length > 1 ? '' : 'none';
    nextBtn.style.display = images.length > 1 ? '' : 'none';
  }

  function step(delta) {
    _albumImgIdx = (_albumImgIdx + delta + images.length) % images.length;
    update();
  }

  closeBtn.addEventListener('click', closeAlbum);
  prevBtn.addEventListener('click', function(e) { e.stopPropagation(); step(-1); });
  nextBtn.addEventListener('click', function(e) { e.stopPropagation(); step(1); });
  lb.addEventListener('click', function(e) { if (e.target === lb) closeAlbum(); });
  lb.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function(e) {
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 42) step(dx > 0 ? -1 : 1);
  }, { passive: true });

  document.onkeydown = function(e) {
    if (!document.getElementById('albumLightbox')) return;
    if (e.key === 'Escape') closeAlbum();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  };

  update();
}

function renderPhotography(container, item) {
  if (!item.albums || !item.albums.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">\u6682\u65e0\u56fe\u96c6</p>';
    return;
  }

  _albumList = item.albums;
  container.innerHTML = item.albums.map(function(album, albumIdx) {
    var images = album.images || [];
    return '<article class="gradient-border-card photo-album-card">' +
      '<div class="photo-album-head">' +
        '<h3>' + escSub(album.name || ('\u56fe\u96c6 ' + (albumIdx + 1))) + '</h3>' +
        '<p>' + escSub(album.description || album.journal || '') + '</p>' +
      '</div>' +
      '<div class="photo-thumb-grid">' +
        images.map(function(imgPath, imgIdx) {
          var src = resolveImageUrl(imgPath);
          return '<button class="photo-thumb" type="button" aria-label="\u6253\u5f00\u7167\u7247" data-album-idx="' + albumIdx + '" data-image-idx="' + imgIdx + '">' +
            '<img src="' + src + '" alt="" loading="lazy">' +
          '</button>';
        }).join('') +
      '</div>' +
    '</article>';
  }).join('');
}

window.openAlbumImage = openAlbumImage;
window.closeAlbum = closeAlbum;

function bookExcerpts(book) {
  var raw = book.excerpts || book.quotes || book.extracts;
  if (Array.isArray(raw) && raw.length) return raw;
  if (typeof raw === 'string' && raw.trim()) return raw.split(/\r?\n/).map(function(line) { return line.trim(); }).filter(Boolean);
  return [];
}

function renderBookCard(book, status, idx) {
  var quotes = bookExcerpts(book);
  var quoteHtml = quotes.length
    ? quotes.map(function(q) { return '<li>' + escSub(q) + '</li>'; }).join('')
    : '<li class="reading-empty-note">还没有摘抄，等下一次翻页时再补。</li>';
  return '<article class="gradient-border-card reading-book-card" data-book-card>' +
    '<div class="reading-book-head">' +
      '<div class="reading-book-main">' +
        '<img class="book-cover-img" src="" data-book-cover="' + escSub(book.cover || '') + '" alt="' + escSub(book.title || '') + '">' +
        '<div>' +
          '<h3>' + escSub(book.title || '未命名书籍') + '</h3>' +
          '<p>' + escSub(book.author || '') + '</p>' +
          '<span class="reading-status">' + status + ' · 点击展开记录</span>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="reading-notes-panel">' +
      '<section class="reading-note-box"><h4>个人随笔</h4><p>' + escSub(book.review || book.note || '这本书的感受还在路上。') + '</p></section>' +
      '<section class="reading-note-box"><h4>语句摘抄</h4><ul class="reading-quote-list">' +
        quoteHtml +
      '</ul></section>' +
    '</div>' +
  '</article>';
}

function renderBooks(container, item) {
  var html = '';
  var read = item.read || [];
  var reading = item.reading || [];
  var want = item.wantToRead || [];
  if (read.length) {
    html += '<h3 style="color:var(--neon-pink);font-weight:600;margin:0 0 0.8rem;">已读</h3>';
    html += read.map(function(book, idx) { return renderBookCard(book, '已读', idx); }).join('');
  }
  if (reading.length) {
    html += '<h3 style="color:var(--neon-cyan);font-weight:600;margin:1.4rem 0 0.8rem;">在读</h3>';
    html += reading.map(function(book, idx) { return renderBookCard(book, '在读', idx); }).join('');
  }
  if (want.length) {
    html += '<h3 style="color:var(--text-dim);font-weight:600;margin:1.4rem 0 0.8rem;">想读</h3>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">' + want.map(function(book) {
      return '<span style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:20px;padding:0.3rem 0.8rem;font-size:0.78rem;color:var(--text-muted);">' + escSub(book.title || '') + ' ' + escSub(book.author || '') + '</span>';
    }).join('') + '</div>';
  }
  container.innerHTML = html || '<div style="color:var(--text-dim);text-align:center;padding:2rem;">暂无书籍记录</div>';
  container.querySelectorAll('[data-book-cover]').forEach(function(img) {
    var coverPath = img.getAttribute('data-book-cover');
    if (coverPath) img.src = resolveImageUrl(coverPath);
  });
  container.querySelectorAll('[data-book-card]').forEach(function(card) {
    card.addEventListener('click', function() {
      card.classList.toggle('is-open');
    });
  });
}

function latteSubRenderInit() {
  if (document.querySelector('.interest-page') || document.querySelector('.interest-content-area')) {
    if (typeof renderInterestPage === 'function') renderInterestPage();
  }
  if (document.querySelector('.blog-list')) {
    if (typeof renderBlog === 'function') renderBlog();
  }
}

window.LatteSubRenderInit = latteSubRenderInit;

// ====== Latte books module: calm editorial shelf ======
var latteBookLayer = null;
var latteBookTimeline = null;
var latteBookEnterEnd = 0;
var latteBookKeydownBound = false;

function latteBookEscape(value) {
  if (typeof escSub === 'function') return escSub(value);
  return String(value || '').replace(/[&<>"']/g, function(ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

function latteBookGetExcerpts(book) {
  var raw = book.excerpts || book.quotes || book.extracts;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/\r?\n/).map(function(line) { return line.trim(); }).filter(Boolean);
  }
  return [];
}

function latteBookFlatten(item) {
  var groups = [
    { key: 'reading', label: '在读', books: item.reading || [] },
    { key: 'read', label: '已读', books: item.read || [] },
    { key: 'want', label: '想读', books: item.wantToRead || [] }
  ];
  var tones = ['ochre', 'rose', 'blue', 'olive', 'paper', 'mauve'];
  var books = [];
  groups.forEach(function(group) {
    group.books.forEach(function(book) {
      books.push({
        key: group.key,
        status: group.label,
        tone: tones[books.length % tones.length],
        title: book.title || '未命名书籍',
        author: book.author || '未知作者',
        review: book.review || book.note || '这本书的感受还在路上，等下一次翻页时再补。',
        info: book.info || (group.label + ' / 私人书架记录'),
        excerpts: latteBookGetExcerpts(book)
      });
    });
  });
  return books;
}

function latteBookCardMarkup(book, index, focus) {
  return '<button class="book-cover-card' + (focus ? ' book-cover-card--focus' : '') + '" type="button" data-book-index="' + index + '" data-book-key="' + latteBookEscape(book.key) + '" data-tone="' + latteBookEscape(book.tone) + '" aria-label="查看 ' + latteBookEscape(book.title) + '">' +
    '<span class="book-cover-top">' +
      '<span class="book-status">' + latteBookEscape(book.status) + '</span>' +
      '<span class="book-cover-title">' + latteBookEscape(book.title) + '</span>' +
      '<span class="book-cover-author">' + latteBookEscape(book.author) + '</span>' +
    '</span>' +
    '<span class="book-cover-bottom"><span class="book-cover-mark"></span></span>' +
  '</button>';
}

function latteBookDetailMarkup(book) {
  var excerpts = book.excerpts && book.excerpts.length
    ? book.excerpts.map(function(line) { return '<li>' + latteBookEscape(line) + '</li>'; }).join('')
    : '<li>摘抄还没有写下，先给这本书留一页空白。</li>';
  return '<aside class="book-detail-panel" role="dialog" aria-modal="true" aria-label="书籍详情">' +
    '<button class="book-detail-close" type="button" data-close-book aria-label="关闭">×</button>' +
    '<span class="book-detail-status">' + latteBookEscape(book.status) + '</span>' +
    '<h3>' + latteBookEscape(book.title) + '</h3>' +
    '<p class="book-detail-author">' + latteBookEscape(book.author) + '</p>' +
    '<section class="book-detail-section"><h4>随笔</h4><p>' + latteBookEscape(book.review) + '</p></section>' +
    '<section class="book-detail-section"><h4>摘抄</h4><ul class="book-quote-list">' + excerpts + '</ul></section>' +
    '<section class="book-detail-section"><h4>书籍信息</h4><div class="book-info-row">' +
      latteBookEscape(book.info).split('/').map(function(part) { return '<span class="book-info-pill">' + latteBookEscape(part.trim()) + '</span>'; }).join('') +
    '</div></section>' +
  '</aside>';
}

function latteCloseBookDetail(immediate) {
  if (!latteBookLayer) return;
  var layer = latteBookLayer;
  var module = document.querySelector('[data-book-module]');

  function cleanup() {
    if (latteBookTimeline) {
      latteBookTimeline.kill();
      latteBookTimeline = null;
    }
    if (layer.parentElement) layer.remove();
    if (module) module.classList.remove('is-detail-open');
    document.body.classList.remove('book-focus-lock');
    latteBookLayer = null;
    latteBookEnterEnd = 0;
  }

  if (immediate || typeof gsap === 'undefined') {
    cleanup();
    return;
  }

  if (!latteBookTimeline) {
    cleanup();
    return;
  }

  latteBookTimeline.eventCallback('onReverseComplete', cleanup);
  latteBookTimeline.eventCallback('onComplete', cleanup);

  if (latteBookTimeline.time() < latteBookEnterEnd) {
    if (latteBookTimeline.time() <= 0.02) {
      cleanup();
    } else {
      latteBookTimeline.timeScale(1.35).reverse();
    }
  } else {
    latteBookTimeline.timeScale(1).play();
  }
}

function latteOpenBookDetail(card, books, index) {
  var book = books[index];
  if (!book) return;
  latteCloseBookDetail(true);

  var module = document.querySelector('[data-book-module]');
  var layer = document.createElement('div');
  layer.className = 'book-focus-layer';
  layer.innerHTML = '<button class="book-focus-backdrop" type="button" data-close-book aria-label="关闭书籍详情"></button>' +
    '<div class="book-selected-stage" aria-hidden="true"></div>' +
    latteBookDetailMarkup(book);
  document.body.appendChild(layer);
  latteBookLayer = layer;
  document.body.classList.add('book-focus-lock');
  if (module) module.classList.add('is-detail-open');

  var stage = layer.querySelector('.book-selected-stage');
  stage.innerHTML = latteBookCardMarkup(book, index, true);
  var focusCard = stage.querySelector('.book-cover-card--focus');
  var panel = layer.querySelector('.book-detail-panel');
  var backdrop = layer.querySelector('.book-focus-backdrop');

  var sourceRect = card.getBoundingClientRect();
  var targetRect = stage.getBoundingClientRect();
  focusCard.style.position = 'fixed';
  focusCard.style.left = sourceRect.left + 'px';
  focusCard.style.top = sourceRect.top + 'px';
  focusCard.style.width = sourceRect.width + 'px';
  focusCard.style.height = sourceRect.height + 'px';
  focusCard.style.zIndex = '2';

  layer.addEventListener('click', function(e) {
    if (e.target.closest('[data-close-book]')) latteCloseBookDetail(false);
  });

  if (!latteBookKeydownBound) {
    latteBookKeydownBound = true;
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') latteCloseBookDetail(false);
    });
  }

  if (typeof gsap === 'undefined') {
    focusCard.style.left = targetRect.left + 'px';
    focusCard.style.top = targetRect.top + 'px';
    focusCard.style.width = targetRect.width + 'px';
    focusCard.style.height = targetRect.height + 'px';
    return;
  }

  gsap.set(backdrop, { autoAlpha: 0 });
  gsap.set(panel, { xPercent: 16, y: 20, scale: 0.985, autoAlpha: 0 });
  gsap.set(focusCard, { scale: 1, autoAlpha: 1 });

  function cleanup() {
    if (layer.parentElement) layer.remove();
    if (module) module.classList.remove('is-detail-open');
    document.body.classList.remove('book-focus-lock');
    if (latteBookLayer === layer) latteBookLayer = null;
    latteBookTimeline = null;
    latteBookEnterEnd = 0;
  }

  latteBookTimeline = gsap.timeline({
    paused: true,
    defaults: { overwrite: 'auto' },
    onReverseComplete: cleanup
  });
  latteBookTimeline
    .to(backdrop, { autoAlpha: 1, duration: 0.34, ease: 'power2.out' }, 0)
    .to(focusCard, {
      left: targetRect.left,
      top: targetRect.top,
      width: targetRect.width,
      height: targetRect.height,
      scale: 1.05,
      duration: 0.62,
      ease: 'power2.out'
    }, 0.04)
    .to(panel, { xPercent: 0, y: 0, scale: 1, autoAlpha: 1, duration: 0.56, ease: 'power3.out' }, 0.14)
    .to(focusCard, { scale: 1, duration: 0.22, ease: 'power2.out' }, '>-0.08')
    .addPause();

  latteBookEnterEnd = latteBookTimeline.duration();

  latteBookTimeline
    .addLabel('bookExit', latteBookEnterEnd)
    .to(panel, { xPercent: 16, y: 18, scale: 0.985, autoAlpha: 0, duration: 0.34, ease: 'power3.in' }, 'bookExit')
    .to(focusCard, { y: 34, scale: 0.96, autoAlpha: 0, duration: 0.34, ease: 'power2.in' }, 'bookExit')
    .to(backdrop, { autoAlpha: 0, duration: 0.28, ease: 'power2.in' }, 'bookExit+=0.04')
    .call(cleanup);

  latteBookTimeline.play(0);
}

function renderBooks(container, item) {
  var books = latteBookFlatten(item || {});
  if (!books.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">暂无书籍记录</p>';
    return;
  }
  var counts = books.reduce(function(acc, book) {
    acc[book.key] = (acc[book.key] || 0) + 1;
    return acc;
  }, {});
  container.innerHTML = '<section class="book-shelf-module" data-book-module data-active-filter="all">' +
    '<div class="book-shelf-header">' +
      '<div class="book-filter-dock" aria-label="书籍筛选">' +
        '<button class="book-filter-btn is-active" type="button" data-book-filter="all" aria-pressed="true">全部 <strong>' + books.length + '</strong></button>' +
        '<button class="book-filter-btn" type="button" data-book-filter="reading" aria-pressed="false">在读 <strong>' + (counts.reading || 0) + '</strong></button>' +
        '<button class="book-filter-btn" type="button" data-book-filter="read" aria-pressed="false">已读 <strong>' + (counts.read || 0) + '</strong></button>' +
        '<button class="book-filter-btn" type="button" data-book-filter="want" aria-pressed="false">想读 <strong>' + (counts.want || 0) + '</strong></button>' +
      '</div>' +
    '</div>' +
    '<div class="book-rail-wrap"><div class="book-rail" role="list">' +
      books.map(function(book, index) { return latteBookCardMarkup(book, index, false); }).join('') +
    '</div></div>' +
    '<p class="book-shelf-note">点击一本书，把它从书架上轻轻抽出来。</p>' +
  '</section>';

  container.querySelectorAll('.book-filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var filter = btn.getAttribute('data-book-filter') || 'all';
      var module = container.querySelector('[data-book-module]');
      if (module) module.setAttribute('data-active-filter', filter);
      container.querySelectorAll('.book-filter-btn').forEach(function(item) {
        var active = item === btn;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      container.querySelectorAll('.book-cover-card').forEach(function(card) {
        if (card.classList.contains('book-cover-card--focus')) return;
        var key = card.getAttribute('data-book-key');
        card.classList.toggle('is-filtered-out', filter !== 'all' && key !== filter);
      });
    });
  });

  container.querySelectorAll('.book-cover-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var index = Number(card.getAttribute('data-book-index'));
      latteOpenBookDetail(card, books, index);
    });
  });
}

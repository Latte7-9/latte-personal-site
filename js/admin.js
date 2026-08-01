// Latte 独立内容管理后台
var Admin = (function() {
  var defaultRepo = 'Latte7-9/latte-personal-site';
  var repo = '';
  var token = '';
  var site = null;
  var blog = { posts: [] };
  var comments = [];
  var images = [];
  var currently = { netease: { songs: [], status: '', updatedAt: '' } };
  var tarot = { spreads: {}, cards: [] };
  var personality = {};
  var tarotGuide = {};
  var answerBook = [];
  var editingBlogIndex = null;
  var pendingImageTarget = '';
  var apiBase = 'https://latte-site-production.up.railway.app';

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(value == null ? '' : String(value)));
    return div.innerHTML;
  }

  function b64e(value) {
    return btoa(unescape(encodeURIComponent(value)));
  }

  function b64d(value) {
    var text = decodeURIComponent(escape(atob(String(value || '').replace(/\s/g, ''))));
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  }

  function setStatus(id, type, text) {
    var el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'status-line';
    if (text) el.className += ' status-' + type;
  }

  function gh(method, path, sha, body) {
    var headers = {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json'
    };
    var opts = { method: method, headers: headers };
    if (body) {
      headers['Content-Type'] = 'application/json';
      var payload = Object.assign({}, body);
      if (sha) payload.sha = sha;
      opts.body = JSON.stringify(payload);
    }

    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, 20000);
    opts.signal = ctrl.signal;

    return fetch('https://api.github.com/repos/' + repo + '/contents/' + path, opts)
      .then(function(res) {
        clearTimeout(timer);
        if (!res.ok) {
          return res.text().then(function(text) {
            var msg = res.status + ': ' + res.statusText;
            if (text) msg += ' - ' + text.slice(0, 160);
            var error = new Error(msg);
            error.status = res.status;
            throw error;
          });
        }
        return res.json();
      })
      .catch(function(err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') throw new Error('请求超时，请检查网络或 GitHub 连接');
        throw err;
      });
  }

  function ghGet(path) { return gh('GET', path); }

  function ghPut(path, content, sha, message) {
    return gh('PUT', path, sha, {
      message: message || ('Update ' + path),
      content: b64e(content)
    });
  }

  function readJson(path, fallback) {
    return ghGet(path).then(function(res) {
      return JSON.parse(b64d(res.content));
    }).catch(function(err) {
      if (err && err.status === 404) return fallback;
      throw err;
    });
  }

  function putJson(path, value, message) {
    return ghGet(path)
      .then(function(current) {
        return ghPut(path, JSON.stringify(value, null, 2), current.sha, message);
      });
  }

  function saveJson(path, value, statusId, message) {
    setStatus(statusId, 'info', '保存中...');
    return putJson(path, value, message)
      .then(function() {
        setStatus(statusId, 'ok', '已保存');
        return true;
      })
      .catch(function(err) {
        setStatus(statusId, 'err', '保存失败：' + friendlyError(err));
        return false;
      });
  }

  function friendlyError(err) {
    var msg = err && err.message ? err.message : String(err);
    if (msg.indexOf('401') !== -1) return 'Token 无效或已过期';
    if (msg.indexOf('403') !== -1) return 'Token 权限不足，需要 contents 写入权限';
    if (msg.indexOf('404') !== -1) return '仓库或文件不存在';
    if (msg.indexOf('409') !== -1) return '线上内容已变化，请刷新后台后重试';
    return msg;
  }

  function iconLabel(icon) {
    var map = { camera: '摄影', book: '书籍', sparkle: '爱好', mountain: '徒步' };
    return map[icon] || icon || '未命名';
  }

  function ensureDataShape() {
    if (!site) site = {};
    if (!site.contact) site.contact = {};
    if (!Array.isArray(site.interests)) site.interests = [];
    if (!blog || !Array.isArray(blog.posts)) blog = { posts: [] };
    if (!Array.isArray(comments)) comments = [];
    if (!currently || typeof currently !== 'object') currently = {};
    if (!currently.netease) currently.netease = {};
    if (!Array.isArray(currently.netease.songs)) currently.netease.songs = [];
    if (!tarot || typeof tarot !== 'object') tarot = { spreads: {}, cards: [] };
    if (!tarot.spreads) tarot.spreads = {};
    if (!Array.isArray(tarot.cards)) tarot.cards = [];
    if (!personality || typeof personality !== 'object') personality = {};
    if (!tarotGuide || typeof tarotGuide !== 'object') tarotGuide = {};
    if (!Array.isArray(answerBook)) answerBook = [];
  }

  function matchInterest(item, kind) {
    var page = String(item.page || '').toLowerCase();
    var icon = String(item.icon || '').toLowerCase();
    var name = String(item.name || '').toLowerCase();
    if (kind === 'photography') return page.indexOf('photography') !== -1 || icon === 'camera' || name.indexOf('摄影') !== -1 || name.indexOf('鎽勫奖') !== -1;
    if (kind === 'books') return page.indexOf('books') !== -1 || icon === 'book' || name.indexOf('书') !== -1 || name.indexOf('涔') !== -1;
    if (kind === 'hobbies') return page.indexOf('hobbies') !== -1 || icon === 'sparkle' || name.indexOf('热度') !== -1 || name.indexOf('鐑') !== -1;
    if (kind === 'hiking') return page.indexOf('hiking') !== -1 || icon === 'mountain' || name.indexOf('徒步') !== -1 || name.indexOf('鐧') !== -1;
    return false;
  }

  function getInterest(kind, defaults) {
    ensureDataShape();
    var item = site.interests.find(function(it) { return matchInterest(it, kind); });
    if (!item) {
      item = Object.assign({}, defaults);
      site.interests.push(item);
    }
    return item;
  }

  function getPhotoInterest() {
    var item = getInterest('photography', {
      name: '摄影',
      icon: 'camera',
      page: 'interests/photography.html',
      description: '',
      albums: []
    });
    if (!Array.isArray(item.albums)) item.albums = [];
    return item;
  }

  function getBooksInterest() {
    var item = getInterest('books', {
      name: '书籍',
      icon: 'book',
      page: 'interests/books.html',
      description: '',
      read: [],
      reading: [],
      wantToRead: []
    });
    ['read', 'reading', 'wantToRead'].forEach(function(key) {
      if (!Array.isArray(item[key])) item[key] = [];
    });
    return item;
  }

  function getHikingInterest() {
    var item = getInterest('hiking', {
      name: '徒步',
      icon: 'mountain',
      page: 'interests/hiking.html',
      description: '',
      climbed: [],
      wantToClimb: [],
      journal: ''
    });
    if (!Array.isArray(item.climbed)) item.climbed = [];
    if (!Array.isArray(item.wantToClimb)) item.wantToClimb = [];
    return item;
  }

  function login() {
    repo = $('repoInput').value.trim();
    token = $('tokenInput').value.trim();
    if (!repo || !token) {
      setStatus('loginMsg', 'err', '请填写仓库和 GitHub Token');
      return;
    }

    $('loginBtn').disabled = true;
    $('loginBtn').textContent = '连接中...';
    $('mainPanel').hidden = true;
    $('loginPanel').hidden = false;
    $('connStatus').textContent = '未连接';
    $('connStatus').className = 'status-badge status-err';
    setStatus('loginMsg', 'info', '正在读取仓库内容...');

    Promise.all([
      readJson('data/site.json', {}),
      readJson('data/blog.json', { posts: [] }),
      readJson('data/comments.json', []),
      readJson('data/currently.json', { netease: { songs: [] } }),
      readJson('data/tarot-cards.json', { spreads: {}, cards: [] }),
      readJson('data/latte-personality-layer.json', {}),
      readJson('data/tarot-conversation-guide.json', {}),
      readAnswerBook()
    ]).then(function(values) {
      site = values[0];
      blog = values[1];
      comments = values[2];
      currently = values[3];
      tarot = values[4];
      personality = values[5];
      tarotGuide = values[6];
      answerBook = values[7];
      ensureDataShape();
      $('connStatus').textContent = '已连接：' + repo;
      $('connStatus').className = 'status-badge status-ok';
      sessionStorage.setItem('latte_admin_session', JSON.stringify({ repo: repo, token: token }));
      $('loginPanel').hidden = true;
      $('mainPanel').hidden = false;
      renderAll();
      setStatus('loginMsg', 'ok', '');
      loadImages();
    }).catch(function(err) {
      $('mainPanel').hidden = true;
      $('loginPanel').hidden = false;
      setStatus('loginMsg', 'err', '连接失败：' + friendlyError(err));
    }).finally(function() {
      $('loginBtn').disabled = false;
      $('loginBtn').textContent = '连接后台';
    });
  }

  function renderAll() {
    renderSite();
    renderInterests();
    renderBlog();
    renderComments();
    renderPhoto();
    renderBooks();
    renderHiking();
    renderCurrently();
    renderTarot();
    renderAnswerBook();
    renderPersonality();
    renderImageTargets();
    loadMusicStatus();
  }

  function switchTab(name) {
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.tab-content').forEach(function(panel) {
      panel.classList.toggle('active', panel.id === 'tab-' + name);
    });
    if (name === 'images') {
      renderImageTargets();
      loadImages();
    }
    if (name === 'music') loadMusicStatus();
  }

  function renderSite() {
    $('siteName').value = site.name || '';
    $('siteTagline').value = site.tagline || '';
    $('siteAbout').value = site.about || '';
    $('siteEmail').value = site.contact && site.contact.email ? site.contact.email : (site.email || '');
  }

  function collectSiteBase() {
    site.name = $('siteName').value.trim();
    site.tagline = $('siteTagline').value.trim();
    site.about = $('siteAbout').value;
    if (!site.contact) site.contact = {};
    site.contact.email = $('siteEmail').value.trim();
  }

  function saveSite() {
    collectSiteBase();
    return saveJson('data/site.json', site, 'siteMsg', 'Update site content');
  }

  function renderInterests() {
    var list = $('interestList');
    if (!site.interests.length) {
      list.innerHTML = '<div class="empty-state">暂无兴趣入口</div>';
      return;
    }
    list.innerHTML = site.interests.map(function(item, index) {
      return '<article class="item-card" data-interest-index="' + index + '">' +
        '<div class="item-header">' +
          '<div><div class="item-title">' + esc(item.name || iconLabel(item.icon)) + '</div>' +
          '<div class="item-meta">' + esc(item.page || '') + '</div></div>' +
          '<button class="btn btn-danger btn-sm" type="button" data-action="delete-interest" data-index="' + index + '">删除</button>' +
        '</div>' +
        '<div class="row-grid">' +
          field('名称', 'int-name', item.name) +
          field('图标', 'int-icon', item.icon, 'camera/book/sparkle/mountain') +
          field('链接', 'int-page', item.page, 'interests/books.html', 'span-2') +
          textareaField('描述', 'int-desc', item.description, 2, 'span-4') +
        '</div>' +
      '</article>';
    }).join('');
  }

  function collectInterests() {
    document.querySelectorAll('[data-interest-index]').forEach(function(card) {
      var index = Number(card.getAttribute('data-interest-index'));
      var item = site.interests[index];
      if (!item) return;
      item.name = card.querySelector('.int-name').value.trim();
      item.icon = card.querySelector('.int-icon').value.trim();
      item.page = card.querySelector('.int-page').value.trim();
      item.description = card.querySelector('.int-desc').value;
    });
  }

  function newInterest() {
    site.interests.push({ name: '', icon: '', page: '', description: '' });
    renderInterests();
    renderImageTargets();
  }

  function deleteInterest(index) {
    if (!confirm('确定删除这个兴趣入口？关联的专属数据也会从 site.json 中移除。')) return;
    site.interests.splice(index, 1);
    renderInterests();
    renderPhoto();
    renderBooks();
    renderHiking();
    renderImageTargets();
  }

  function saveInterests() {
    collectInterests();
    return saveJson('data/site.json', site, 'interestMsg', 'Update interests');
  }

  function renderBlog() {
    var list = $('blogList');
    if (!blog.posts.length) {
      list.innerHTML = '<div class="empty-state">暂无博客文章</div>';
      return;
    }
    list.innerHTML = blog.posts.map(function(post, index) {
      if (editingBlogIndex === index) return renderBlogEditor(post, index);
      return '<article class="item-card">' +
        '<div class="item-header">' +
          '<div><div class="item-title">' + esc(post.title || '未命名文章') + '</div>' +
          '<div class="item-meta">' + esc(post.date || '') + ' · ' + esc(post.file || post.slug || '') + '</div></div>' +
          '<div class="button-row">' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="edit-blog" data-index="' + index + '">编辑</button>' +
            '<button class="btn btn-danger btn-sm" type="button" data-action="delete-blog" data-index="' + index + '">删除</button>' +
          '</div>' +
        '</div>' +
        '<div class="plain-text">' + esc(post.summary || post.excerpt || '') + '</div>' +
      '</article>';
    }).join('');
  }

  function renderBlogEditor(post, index) {
    return '<article class="item-card" data-blog-editor="' + index + '">' +
      '<div class="item-header"><div class="item-title">编辑文章</div><button class="btn btn-ghost btn-sm" type="button" data-action="cancel-blog">取消</button></div>' +
      '<div class="row-grid">' +
        field('标题', 'blog-title', post.title, '', 'span-2') +
        field('日期', 'blog-date', post.date, 'YYYY-MM-DD') +
        field('页面文件名', 'blog-file', post.file || post.slug || '', 'my-post.html') +
        textareaField('摘要', 'blog-summary', post.summary || post.excerpt || '', 3, 'span-4') +
        textareaField('正文 HTML', 'blog-content', post.content || '', 12, 'span-4', true) +
      '</div>' +
      '<div class="button-row"><button class="btn btn-primary" type="button" data-action="save-blog-editor" data-index="' + index + '">保存文章</button></div>' +
    '</article>';
  }

  function newBlogPost() {
    var today = new Date().toISOString().slice(0, 10);
    blog.posts.unshift({
      title: '新文章',
      date: today,
      summary: '',
      content: '',
      file: 'post-' + today + '.html'
    });
    editingBlogIndex = 0;
    renderBlog();
  }

  function saveBlogEditor(index) {
    var card = document.querySelector('[data-blog-editor="' + index + '"]');
    if (!card) return;
    var post = blog.posts[index];
    post.title = card.querySelector('.blog-title').value.trim();
    post.date = card.querySelector('.blog-date').value.trim();
    post.summary = card.querySelector('.blog-summary').value;
    post.excerpt = post.summary;
    post.content = card.querySelector('.blog-content').value;
    post.file = normalizeHtmlFile(card.querySelector('.blog-file').value.trim() || slugify(post.title) + '.html');
    editingBlogIndex = null;
    saveBlog(index);
  }

  function normalizeHtmlFile(value) {
    return /\.html$/i.test(value) ? value : value + '.html';
  }

  function slugify(value) {
    var text = String(value || 'post').trim().toLowerCase();
    text = text.replace(/[^\w\u4e00-\u9fa5-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return text || ('post-' + Date.now());
  }

  function deleteBlog(index) {
    if (!confirm('确定删除这篇文章？这里只会移除博客索引，不会删除已生成的历史 HTML 文件。')) return;
    blog.posts.splice(index, 1);
    editingBlogIndex = null;
    saveBlog();
  }

  function saveBlog(editedIndex) {
    setStatus('blogMsg', 'info', '保存博客索引中...');
    return ghGet('data/blog.json')
      .then(function(current) {
        return ghPut('data/blog.json', JSON.stringify(blog, null, 2), current.sha, 'Update blog data');
      })
      .then(function() {
        if (editedIndex == null || editedIndex < 0) return null;
        var post = blog.posts[editedIndex];
        if (!post || !post.file) return null;
        return saveBlogHtml(post);
      })
      .then(function() {
        setStatus('blogMsg', 'ok', '博客已保存');
        renderBlog();
      })
      .catch(function(err) {
        setStatus('blogMsg', 'err', '保存失败：' + friendlyError(err));
      });
  }

  function saveBlogHtml(post) {
    var path = 'blog/posts/' + post.file;
    var html = buildBlogHtml(post);
    return ghGet(path)
      .then(function(existing) {
        return ghPut(path, html, existing.sha, 'Update blog post ' + post.file);
      })
      .catch(function() {
        return ghPut(path, html, null, 'Create blog post ' + post.file);
      });
  }

  function buildBlogHtml(post) {
    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + esc(post.title) + ' - Latte</title>\n<link rel="stylesheet" href="../../css/tokens.css">\n<link rel="stylesheet" href="../../css/base.css">\n<link rel="stylesheet" href="../../css/nav.css">\n<link rel="stylesheet" href="../../css/contact-footer.css">\n<link rel="stylesheet" href="../../css/blog.css">\n<link rel="stylesheet" href="../../css/blog-comments.css">\n</head>\n<body>\n<div id="reading-progress"></div>\n<nav class="site-nav"><div class="nav-glass"><a class="nav-brand" href="../../index.html">Latte</a><div class="nav-links"><a href="../../index.html" class="nav-link">首页</a><a href="../index.html" class="nav-link">博客</a><a href="../../index.html#message" class="nav-link">留言池</a></div></div></nav>\n<article class="blog-article">\n<div class="gradient-border-card blog-article-card">\n<div class="blog-article-date">' + esc(post.date) + '</div>\n<h1 class="blog-article-title">' + esc(post.title) + '</h1>\n<div class="blog-article-body">' + (post.content || '') + '</div>\n<div style="margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border-subtle);"><a href="../index.html" class="blog-article-back">返回博客</a></div>\n</div>\n</article>\n<footer><div class="footer-inner" style="max-width:900px;margin:0 auto;padding:0 1.5rem;"><span>&copy; 2026 Latte · 用 Codex 搭建</span></div></footer>\n<script src="../../js/gsap.min.js"></' + 'script>\n<script src="../../js/ScrollTrigger.min.js"></' + 'script>\n<script src="../../js/cursor.js"></' + 'script>\n<script src="../../js/blog-comments.js"></' + 'script>\n</body>\n</html>\n';
  }

  function renderComments() {
    var list = $('commentList');
    if (!comments.length) {
      list.innerHTML = '<div class="empty-state">暂无留言</div>';
      return;
    }
    list.innerHTML = comments.map(function(comment, index) {
      return '<article class="item-card">' +
        '<div class="item-header">' +
          '<div><div class="item-title">' + esc(comment.name || '匿名') + '</div><div class="item-meta">' + esc(comment.date || '') + '</div></div>' +
          '<button class="btn btn-danger btn-sm" type="button" data-action="delete-comment" data-index="' + index + '">删除</button>' +
        '</div>' +
        '<div class="plain-text">' + esc(comment.text || '') + '</div>' +
      '</article>';
    }).join('');
  }

  function deleteComment(index) {
    if (!confirm('确定删除这条留言？')) return;
    comments.splice(index, 1);
    renderComments();
    saveComments();
  }

  function saveComments() {
    return saveJson('data/comments.json', comments, 'commentMsg', 'Update comments');
  }

  function renderPhoto() {
    var photo = getPhotoInterest();
    var list = $('photoList');
    if (!photo.albums.length) {
      list.innerHTML = '<div class="empty-state">暂无摄影图集</div>';
      return;
    }
    list.innerHTML = photo.albums.map(function(album, index) {
      return '<article class="item-card" data-album-index="' + index + '">' +
        '<div class="item-header">' +
          '<div><div class="item-title">' + esc(album.name || ('图集 ' + (index + 1))) + '</div><div class="item-meta">' + ((album.images || []).length) + ' 张图片</div></div>' +
          '<button class="btn btn-danger btn-sm" type="button" data-action="delete-album" data-index="' + index + '">删除</button>' +
        '</div>' +
        '<div class="row-grid">' +
          field('图集名称', 'album-name', album.name, '', 'span-2') +
          field('封面路径', 'album-cover', album.cover, 'images/photo.jpg', 'span-2') +
          textareaField('描述', 'album-desc', album.description, 2, 'span-4') +
          textareaField('图片路径（一行一张）', 'album-images', (album.images || []).join('\n'), 5, 'span-4') +
          textareaField('图集记录 HTML', 'album-journal', album.journal, 4, 'span-4', true) +
        '</div>' +
        '<div class="button-row">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="upload-album-cover" data-index="' + index + '">上传封面</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="upload-album-image" data-index="' + index + '">上传到图集</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function collectPhoto() {
    var photo = getPhotoInterest();
    photo.albums = Array.from(document.querySelectorAll('[data-album-index]')).map(function(card) {
      return {
        name: card.querySelector('.album-name').value.trim(),
        description: card.querySelector('.album-desc').value,
        cover: card.querySelector('.album-cover').value.trim(),
        images: lines(card.querySelector('.album-images').value),
        journal: card.querySelector('.album-journal').value
      };
    });
  }

  function newAlbum() {
    getPhotoInterest().albums.push({ name: '', description: '', cover: '', images: [], journal: '' });
    renderPhoto();
    renderImageTargets();
  }

  function deleteAlbum(index) {
    if (!confirm('确定删除这个图集？图片文件不会被删除。')) return;
    getPhotoInterest().albums.splice(index, 1);
    renderPhoto();
    renderImageTargets();
  }

  function savePhoto() {
    collectPhoto();
    renderImageTargets();
    return saveJson('data/site.json', site, 'photoMsg', 'Update photography');
  }

  function renderBooks() {
    var books = getBooksInterest();
    var sections = [
      { key: 'reading', label: '在读' },
      { key: 'read', label: '已读' },
      { key: 'wantToRead', label: '想读' }
    ];
    $('booksList').innerHTML = sections.map(function(section) {
      var rows = books[section.key] || [];
      return '<section class="section-group" data-book-section="' + section.key + '">' +
        '<div class="section-title"><span>' + section.label + '</span>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="new-book" data-key="' + section.key + '">新增书籍</button></div>' +
        (rows.length ? rows.map(function(book, index) { return renderBookEditor(section.key, book, index); }).join('') : '<div class="empty-state">暂无记录</div>') +
      '</section>';
    }).join('');
  }

  function renderBookEditor(key, book, index) {
    if (!Array.isArray(book.excerpts)) {
      if (Array.isArray(book.quotes)) book.excerpts = book.quotes;
      else if (Array.isArray(book.extracts)) book.excerpts = book.extracts;
      else book.excerpts = [];
    }
    return '<article class="item-card" data-book-key="' + key + '" data-book-index="' + index + '">' +
      '<div class="item-header">' +
        '<div><div class="item-title">' + esc(book.title || '未命名书籍') + '</div><div class="item-meta">' + esc(book.author || '') + '</div></div>' +
        '<button class="btn btn-danger btn-sm" type="button" data-action="delete-book" data-key="' + key + '" data-index="' + index + '">删除</button>' +
      '</div>' +
      '<div class="row-grid">' +
        field('书名', 'book-title', book.title, '', 'span-2') +
        field('作者', 'book-author', book.author, '', 'span-2') +
        field('封面路径', 'book-cover', book.cover, 'images/book.jpg', 'span-4') +
        textareaField('书评 HTML', 'book-review', book.review || book.note || '', 4, 'span-4', true) +
        textareaField('摘抄（一行一条）', 'book-excerpts', book.excerpts.join('\n'), 5, 'span-4') +
      '</div>' +
      '<div class="button-row"><button class="btn btn-ghost btn-sm" type="button" data-action="upload-book-cover" data-key="' + key + '" data-index="' + index + '">上传封面</button></div>' +
    '</article>';
  }

  function collectBooks() {
    var books = getBooksInterest();
    var originals = {
      reading: (books.reading || []).slice(),
      read: (books.read || []).slice(),
      wantToRead: (books.wantToRead || []).slice()
    };
    ['reading', 'read', 'wantToRead'].forEach(function(key) { books[key] = []; });
    document.querySelectorAll('[data-book-key]').forEach(function(card) {
      var key = card.getAttribute('data-book-key');
      var index = Number(card.getAttribute('data-book-index'));
      books[key].push(Object.assign({}, originals[key][index] || {}, {
        title: card.querySelector('.book-title').value.trim(),
        author: card.querySelector('.book-author').value.trim(),
        cover: card.querySelector('.book-cover').value.trim(),
        review: card.querySelector('.book-review').value,
        excerpts: lines(card.querySelector('.book-excerpts').value)
      }));
    });
  }

  function newBook(key) {
    getBooksInterest()[key].push({ title: '', author: '', cover: '', review: '', excerpts: [] });
    renderBooks();
    renderImageTargets();
  }

  function deleteBook(key, index) {
    if (!confirm('确定删除这本书？')) return;
    getBooksInterest()[key].splice(index, 1);
    renderBooks();
    renderImageTargets();
  }

  function saveBooks() {
    collectBooks();
    renderImageTargets();
    return saveJson('data/site.json', site, 'booksMsg', 'Update books');
  }

  function renderHiking() {
    var hiking = getHikingInterest();
    $('hikingList').innerHTML =
      '<section class="section-group">' +
        '<div class="section-title"><span>徒步日志</span></div>' +
        '<textarea class="inline-input" id="hikingJournal" rows="5" data-rich>' + esc(hiking.journal || '') + '</textarea>' +
      '</section>' +
      '<section class="section-group" id="climbedGroup">' +
        '<div class="section-title"><span>已走过</span><button class="btn btn-ghost btn-sm" type="button" data-action="new-climbed">新增</button></div>' +
        (hiking.climbed.length ? hiking.climbed.map(renderClimbed).join('') : '<div class="empty-state">暂无记录</div>') +
      '</section>' +
      '<section class="section-group" id="wantClimbGroup">' +
        '<div class="section-title"><span>想去</span><button class="btn btn-ghost btn-sm" type="button" data-action="new-want-climb">新增</button></div>' +
        (hiking.wantToClimb.length ? hiking.wantToClimb.map(renderWantClimb).join('') : '<div class="empty-state">暂无记录</div>') +
      '</section>';
  }

  function renderClimbed(item, index) {
    return '<article class="item-card" data-climbed-index="' + index + '">' +
      '<div class="item-header"><div class="item-title">' + esc(item.name || '未命名山峰') + '</div>' +
      '<button class="btn btn-danger btn-sm" type="button" data-action="delete-climbed" data-index="' + index + '">删除</button></div>' +
      '<div class="row-grid">' + field('山名', 'climbed-name', item.name, '', 'span-2') + field('日期', 'climbed-date', item.date, '2026-05', 'span-2') + textareaField('备注', 'climbed-note', item.note, 2, 'span-4') + '</div>' +
    '</article>';
  }

  function renderWantClimb(item, index) {
    return '<article class="item-card" data-want-climb-index="' + index + '">' +
      '<div class="item-header"><div class="item-title">' + esc(item.name || '未命名目的地') + '</div>' +
      '<button class="btn btn-danger btn-sm" type="button" data-action="delete-want-climb" data-index="' + index + '">删除</button></div>' +
      '<div class="row-grid">' + field('山名', 'want-name', item.name, '', 'span-2') + field('理由', 'want-reason', item.reason, '', 'span-2') + '</div>' +
    '</article>';
  }

  function collectHiking() {
    var hiking = getHikingInterest();
    hiking.journal = $('hikingJournal').value;
    hiking.climbed = Array.from(document.querySelectorAll('[data-climbed-index]')).map(function(card) {
      return {
        name: card.querySelector('.climbed-name').value.trim(),
        date: card.querySelector('.climbed-date').value.trim(),
        note: card.querySelector('.climbed-note').value
      };
    });
    hiking.wantToClimb = Array.from(document.querySelectorAll('[data-want-climb-index]')).map(function(card) {
      return {
        name: card.querySelector('.want-name').value.trim(),
        reason: card.querySelector('.want-reason').value.trim()
      };
    });
  }

  function newClimbed() {
    getHikingInterest().climbed.push({ name: '', date: '', note: '' });
    renderHiking();
  }

  function newWantClimb() {
    getHikingInterest().wantToClimb.push({ name: '', reason: '' });
    renderHiking();
  }

  function deleteClimbed(index) {
    if (!confirm('确定删除这条已走过记录？')) return;
    getHikingInterest().climbed.splice(index, 1);
    renderHiking();
  }

  function deleteWantClimb(index) {
    if (!confirm('确定删除这条想去记录？')) return;
    getHikingInterest().wantToClimb.splice(index, 1);
    renderHiking();
  }

  function saveHiking() {
    collectHiking();
    return saveJson('data/site.json', site, 'hikingMsg', 'Update hiking');
  }

  function lines(value) {
    return String(value || '').split(/\r?\n/).map(function(line) { return line.trim(); }).filter(Boolean);
  }

  function readAnswerBook() {
    return ghGet('js/answer-book.js').then(function(res) {
      var source = b64d(res.content);
      var match = source.match(/var answers = \[([\s\S]*?)\];/);
      if (!match) return [];
      var values = [];
      var regex = /'((?:\\.|[^'])*)'/g;
      var item;
      while ((item = regex.exec(match[1]))) {
        values.push(item[1].replace(/\\'/g, "'").replace(/\\n/g, '\n'));
      }
      return values;
    }).catch(function(err) {
      if (err && err.status === 404) return [];
      throw err;
    });
  }

  function renderCurrently() {
    var data = currently.netease || {};
    $('currentlyStatus').value = data.status || '';
    $('currentlyUpdatedAt').value = data.updatedAt || '';
    $('songList').innerHTML = (data.songs || []).map(function(song, index) {
      return '<article class="item-card data-row" data-song-index="' + index + '">' +
        '<div class="item-header"><div class="item-title">' + esc(song.name || '未命名歌曲') + '</div><button class="btn btn-danger btn-sm" type="button" data-action="delete-song" data-index="' + index + '">删除</button></div>' +
        '<div class="row-grid">' + field('歌曲名', 'song-name', song.name, '', 'span-2') + field('歌手', 'song-artists', song.artists, '', 'span-2') + field('歌曲 ID', 'song-id', song.id, '', 'span-2') + field('播放次数', 'song-play-count', song.playCount, '0', 'span-2') + field('封面地址', 'song-cover', song.cover, '', 'span-2') + field('歌曲链接', 'song-url', song.url, '', 'span-2') + '</div></article>';
    }).join('') || '<div class="empty-state">暂无歌曲缓存</div>';
  }

  function collectCurrently() {
    if (!currently.netease) currently.netease = {};
    currently.netease.status = $('currentlyStatus').value.trim();
    currently.netease.updatedAt = $('currentlyUpdatedAt').value.trim();
    currently.netease.songs = Array.from(document.querySelectorAll('[data-song-index]')).map(function(card) {
      return { id: Number(card.querySelector('.song-id').value) || 0, name: card.querySelector('.song-name').value.trim(), artists: card.querySelector('.song-artists').value.trim(), cover: card.querySelector('.song-cover').value.trim(), playCount: Number(card.querySelector('.song-play-count').value) || 0, url: card.querySelector('.song-url').value.trim() };
    });
  }

  function newSong() {
    currently.netease.songs.push({ id: 0, name: '', artists: '', cover: '', playCount: 0, url: '' });
    renderCurrently();
  }

  function deleteSong(index) {
    if (!confirm('确定删除这首歌曲缓存？')) return;
    currently.netease.songs.splice(index, 1);
    renderCurrently();
  }

  function saveCurrently() {
    collectCurrently();
    return saveJson('data/currently.json', currently, 'currentlyMsg', 'Update currently cache');
  }

  function renderTarot() {
    var spreadEntries = Object.keys(tarot.spreads || {});
    $('spreadList').innerHTML = spreadEntries.map(function(key) {
      var spread = tarot.spreads[key] || {};
      return '<article class="item-card" data-spread-key="' + esc(key) + '"><div class="item-header"><div class="item-title">' + esc(spread.name || key) + '</div><button class="btn btn-danger btn-sm" type="button" data-action="delete-spread" data-key="' + esc(key) + '">删除</button></div><div class="row-grid">' + field('标识', 'spread-id', key, '', 'span-2') + field('名称', 'spread-name', spread.name, '', 'span-2') + textareaField('描述', 'spread-description', spread.description, 3, 'span-4') + textareaField('牌位（一行一条）', 'spread-positions', (spread.positions || []).join('\n'), 3, 'span-4') + '</div></article>';
    }).join('') || '<div class="empty-state">暂无牌阵</div>';
    $('cardList').innerHTML = tarot.cards.map(function(card, index) {
      return '<article class="item-card" data-card-index="' + index + '"><div class="item-header"><div class="item-title">' + esc(card.name || '未命名牌') + '</div></div><div class="row-grid">' + field('名称', 'card-name', card.name, '', 'span-2') + field('类型', 'card-arcana', card.arcana, 'major/minor', 'span-2') + field('元素', 'card-element', card.element, '', 'span-2') + field('图片路径', 'card-image', card.image, '', 'span-2') + textareaField('关键词（一行一条）', 'card-keywords', (card.keywords || []).join('\n'), 3, 'span-4') + textareaField('正位解释', 'card-upright', card.upright, 4, 'span-4', true) + textareaField('逆位解释', 'card-reversed', card.reversed, 4, 'span-4', true) + '</div></article>';
    }).join('') || '<div class="empty-state">暂无牌库</div>';
  }

  function collectTarot() {
    var spreads = {};
    document.querySelectorAll('[data-spread-key]').forEach(function(card) {
      var key = card.querySelector('.spread-id').value.trim();
      if (!key) return;
      spreads[key] = { name: card.querySelector('.spread-name').value.trim(), description: card.querySelector('.spread-description').value, positions: lines(card.querySelector('.spread-positions').value) };
    });
    tarot.spreads = spreads;
    tarot.cards = Array.from(document.querySelectorAll('[data-card-index]')).map(function(card) {
      return { name: card.querySelector('.card-name').value.trim(), arcana: card.querySelector('.card-arcana').value.trim(), element: card.querySelector('.card-element').value.trim(), keywords: lines(card.querySelector('.card-keywords').value), upright: card.querySelector('.card-upright').value, reversed: card.querySelector('.card-reversed').value, image: card.querySelector('.card-image').value.trim() };
    });
  }

  function newSpread() {
    var key = 'spread-' + Date.now();
    tarot.spreads[key] = { name: '新牌阵', description: '', positions: [] };
    renderTarot();
  }

  function deleteSpread(key) {
    if (!confirm('确定删除这个牌阵？')) return;
    delete tarot.spreads[key];
    renderTarot();
  }

  function saveTarot() {
    collectTarot();
    return saveJson('data/tarot-cards.json', tarot, 'tarotMsg', 'Update tarot cards');
  }

  function renderAnswerBook() {
    $('answerList').value = answerBook.join('\n');
  }

  function jsString(value) {
    return "'" + String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n') + "'";
  }

  function saveAnswerBook() {
    answerBook = lines($('answerList').value);
    return ghGet('js/answer-book.js').then(function(res) {
      var source = b64d(res.content);
      var replacement = 'var answers = [\n' + answerBook.map(function(item) { return '    ' + jsString(item) + ','; }).join('\n') + '\n  ];';
      var next = source.replace(/var answers = \[[\s\S]*?\];/, replacement);
      return ghPut('js/answer-book.js', next, res.sha, 'Update answer book answers');
    }).then(function() { setStatus('answerBookMsg', 'ok', '答案之书已保存'); }).catch(function(err) { setStatus('answerBookMsg', 'err', '保存失败：' + friendlyError(err)); });
  }

  function renderPersonality() {
    $('personalityJson').value = JSON.stringify(personality, null, 2);
    $('guideJson').value = JSON.stringify(tarotGuide, null, 2);
  }

  function savePersonality() {
    try {
      personality = JSON.parse($('personalityJson').value);
      tarotGuide = JSON.parse($('guideJson').value);
    } catch (err) {
      setStatus('personalityMsg', 'err', 'JSON 格式有误，请检查逗号和引号');
      return Promise.resolve(false);
    }
    setStatus('personalityMsg', 'info', '保存中...');
    return Promise.all([
      putJson('data/latte-personality-layer.json', personality, 'Update personality layer'),
      putJson('data/tarot-conversation-guide.json', tarotGuide, 'Update tarot conversation guide')
    ]).then(function() {
      setStatus('personalityMsg', 'ok', '人格层与会话指南已保存');
      return true;
    }).catch(function(err) {
      setStatus('personalityMsg', 'err', '保存失败：' + friendlyError(err));
      return false;
    });
  }

  function field(label, className, value, placeholder, extraClass) {
    return '<div class="form-group ' + (extraClass || '') + '"><label>' + label + '</label><input class="' + className + '" value="' + esc(value || '') + '" placeholder="' + esc(placeholder || '') + '"></div>';
  }

  function textareaField(label, className, value, rows, extraClass, rich) {
    return '<div class="form-group ' + (extraClass || '') + '"><label>' + label + '</label><textarea class="' + className + '" rows="' + (rows || 3) + '"' + (rich ? ' data-rich' : '') + '>' + esc(value || '') + '</textarea></div>';
  }

  function renderImageTargets() {
    var sel = $('imageTarget');
    if (!sel) return;
    var previous = sel.value || pendingImageTarget;
    var options = [{ value: '', label: '仅上传到 images 目录' }];
    getPhotoInterest().albums.forEach(function(album, index) {
      options.push({ value: 'photo-cover:' + index, label: '摄影图集封面：' + (album.name || ('图集 ' + (index + 1))) });
      options.push({ value: 'photo-image:' + index, label: '加入摄影图集：' + (album.name || ('图集 ' + (index + 1))) });
    });
    var books = getBooksInterest();
    [
      { key: 'reading', label: '在读' },
      { key: 'read', label: '已读' },
      { key: 'wantToRead', label: '想读' }
    ].forEach(function(section) {
      (books[section.key] || []).forEach(function(book, index) {
        options.push({ value: 'book-cover:' + section.key + ':' + index, label: '书籍封面：' + section.label + ' / ' + (book.title || ('第 ' + (index + 1) + ' 本')) });
      });
    });
    sel.innerHTML = options.map(function(opt) {
      return '<option value="' + esc(opt.value) + '">' + esc(opt.label) + '</option>';
    }).join('');
    sel.value = options.some(function(opt) { return opt.value === previous; }) ? previous : '';
  }

  function pickImage(target) {
    pendingImageTarget = target || $('imageTarget').value || '';
    $('imgFileInput').click();
  }

  function uploadImage(file) {
    if (!file) return;
    var path = 'images/' + file.name;
    var reader = new FileReader();
    setStatus('imgMsg', 'info', '上传中：' + file.name);
    reader.onload = function(event) {
      var content = String(event.target.result || '').split(',')[1];
      ghGet(path)
        .then(function(existing) {
          return gh('PUT', path, existing.sha, { message: 'Upload ' + file.name, content: content });
        })
        .catch(function() {
          return gh('PUT', path, null, { message: 'Upload ' + file.name, content: content });
        })
        .then(function() {
          applyImagePath(pendingImageTarget || $('imageTarget').value || '', path);
          setStatus('imgMsg', 'ok', '已上传：' + path);
          $('imgFileInput').value = '';
          pendingImageTarget = '';
          loadImages();
        })
        .catch(function(err) {
          setStatus('imgMsg', 'err', '上传失败：' + friendlyError(err));
        });
    };
    reader.readAsDataURL(file);
  }

  function applyImagePath(target, path) {
    if (!target) return;
    var parts = target.split(':');
    if (parts[0] === 'photo-cover') {
      var coverInput = document.querySelector('[data-album-index="' + parts[1] + '"] .album-cover');
      if (coverInput) coverInput.value = path;
    }
    if (parts[0] === 'photo-image') {
      var imageArea = document.querySelector('[data-album-index="' + parts[1] + '"] .album-images');
      if (imageArea) imageArea.value = imageArea.value.trim() ? imageArea.value.trim() + '\n' + path : path;
    }
    if (parts[0] === 'book-cover') {
      var card = document.querySelector('[data-book-key="' + parts[1] + '"][data-book-index="' + parts[2] + '"]');
      var bookInput = card && card.querySelector('.book-cover');
      if (bookInput) bookInput.value = path;
    }
  }

  function loadImages() {
    if (!repo || !token) return;
    return fetch('https://api.github.com/repos/' + repo + '/contents/images', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }
    }).then(function(res) {
      if (!res.ok) throw new Error(res.status + ': ' + res.statusText);
      return res.json();
    }).then(function(files) {
      images = files.filter(function(file) {
        return file.type === 'file' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
      });
      renderImages();
    }).catch(function(err) {
      $('imgGrid').innerHTML = '<div class="empty-state">图片列表加载失败：' + esc(friendlyError(err)) + '</div>';
    });
  }

  function renderImages() {
    var grid = $('imgGrid');
    if (!images.length) {
      grid.innerHTML = '<div class="empty-state">暂无已上传图片</div>';
      return;
    }
    grid.innerHTML = images.map(function(file) {
      var path = 'images/' + file.name;
      return '<article class="img-card">' +
        '<img src="' + esc(file.download_url) + '" alt="' + esc(file.name) + '" loading="lazy">' +
        '<div class="img-card-body">' +
          '<div class="img-name" title="' + esc(path) + '">' + esc(file.name) + '</div>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="copy-image-path" data-path="' + esc(path) + '">复制路径</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="use-image-path" data-path="' + esc(path) + '">填入当前目标</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function copyPath(path) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(path).then(function() {
        setStatus('imgMsg', 'ok', '已复制：' + path);
      }).catch(function() {
        window.prompt('复制图片路径', path);
      });
    } else {
      window.prompt('复制图片路径', path);
    }
  }

  function loadMusicStatus() {
    if (!$('musicStatus')) return;
    fetch(apiBase + '/api/netease/status')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        $('musicStatus').textContent = '当前缓存：' + (data.songCount || 0) + ' 首；更新时间：' + (data.cachedAt ? new Date(data.cachedAt).toLocaleString('zh-CN', { hour12: false }) : '暂无');
      })
      .catch(function() {
        $('musicStatus').textContent = '无法连接音乐服务';
      });
  }

  function syncMusic() {
    setStatus('musicMsg', 'info', '同步中...');
    fetch(apiBase + '/api/netease/sync', { method: 'POST' })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        setStatus('musicMsg', 'ok', '同步完成，共 ' + (data.songCount || 0) + ' 首');
        loadMusicStatus();
      })
      .catch(function(err) {
        setStatus('musicMsg', 'err', '同步失败：' + friendlyError(err));
      });
  }

  function initRichToolbar() {
    var toolbar = $('richToolbar');
    var active = null;

    document.addEventListener('focusin', function(event) {
      if (event.target.tagName !== 'TEXTAREA' || !event.target.hasAttribute('data-rich')) return;
      active = event.target;
      var rect = active.getBoundingClientRect();
      toolbar.hidden = false;
      toolbar.style.left = Math.max(8, rect.left) + 'px';
      toolbar.style.top = Math.max(8, rect.top + window.scrollY - 44) + 'px';
    });

    document.addEventListener('click', function(event) {
      if (event.target.closest('[data-rich]') || event.target.closest('#richToolbar')) return;
      toolbar.hidden = true;
      active = null;
    });

    toolbar.addEventListener('click', function(event) {
      var btn = event.target.closest('button');
      if (!btn || !active) return;
      event.preventDefault();
      insertRichTag(active, btn.getAttribute('data-tag'));
    });
  }

  function insertRichTag(textarea, tag) {
    var start = textarea.selectionStart;
    var end = textarea.selectionEnd;
    var value = textarea.value;
    var selected = value.slice(start, end);
    var before = '';
    var after = '';

    if (tag === 'strong') { before = '<strong>'; after = '</strong>'; }
    if (tag === 'em') { before = '<em>'; after = '</em>'; }
    if (tag === 'h3') { before = '<h3>'; after = '</h3>'; }
    if (tag === 'blockquote') { before = '<blockquote><p>'; after = '</p></blockquote>'; }
    if (tag === 'br') { selected = ''; after = '<br>'; }
    if (tag === 'a') {
      var url = window.prompt('链接地址', 'https://');
      if (!url) return;
      before = '<a href="' + esc(url) + '" target="_blank" rel="noopener">';
      after = '</a>';
    }

    var next = before + selected + after;
    textarea.value = value.slice(0, start) + next + value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start + before.length + selected.length, start + before.length + selected.length);
  }

  function handleAction(event) {
    var btn = event.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var index = Number(btn.getAttribute('data-index'));
    var key = btn.getAttribute('data-key');
    var path = btn.getAttribute('data-path');

    if (action === 'save-site') saveSite();
    if (action === 'new-interest') newInterest();
    if (action === 'save-interests') saveInterests();
    if (action === 'delete-interest') deleteInterest(index);
    if (action === 'new-blog') newBlogPost();
    if (action === 'edit-blog') { editingBlogIndex = index; renderBlog(); }
    if (action === 'cancel-blog') { editingBlogIndex = null; renderBlog(); }
    if (action === 'save-blog-editor') saveBlogEditor(index);
    if (action === 'delete-blog') deleteBlog(index);
    if (action === 'delete-comment') deleteComment(index);
    if (action === 'save-comments') saveComments();
    if (action === 'new-album') newAlbum();
    if (action === 'delete-album') deleteAlbum(index);
    if (action === 'save-photo') savePhoto();
    if (action === 'upload-album-cover') pickImage('photo-cover:' + index);
    if (action === 'upload-album-image') pickImage('photo-image:' + index);
    if (action === 'new-book') newBook(key);
    if (action === 'delete-book') deleteBook(key, index);
    if (action === 'save-books') saveBooks();
    if (action === 'upload-book-cover') pickImage('book-cover:' + key + ':' + index);
    if (action === 'new-climbed') newClimbed();
    if (action === 'new-want-climb') newWantClimb();
    if (action === 'delete-climbed') deleteClimbed(index);
    if (action === 'delete-want-climb') deleteWantClimb(index);
    if (action === 'save-hiking') saveHiking();
    if (action === 'pick-image') pickImage();
    if (action === 'copy-image-path') copyPath(path);
    if (action === 'use-image-path') {
      applyImagePath($('imageTarget').value, path);
      setStatus('imgMsg', 'ok', '已填入：' + path);
    }
    if (action === 'sync-music') syncMusic();
    if (action === 'save-currently') saveCurrently();
    if (action === 'new-song') newSong();
    if (action === 'delete-song') deleteSong(index);
    if (action === 'save-tarot') saveTarot();
    if (action === 'new-spread') newSpread();
    if (action === 'delete-spread') deleteSpread(key);
    if (action === 'save-answer-book') saveAnswerBook();
    if (action === 'save-personality') savePersonality();
  }

  function init() {
    $('loginBtn').addEventListener('click', login);
    $('tabBar').addEventListener('click', function(event) {
      var btn = event.target.closest('.tab-btn');
      if (btn) switchTab(btn.getAttribute('data-tab'));
    });
    document.addEventListener('click', handleAction);
    $('imgFileInput').addEventListener('change', function(event) {
      uploadImage(event.target.files && event.target.files[0]);
    });
    initRichToolbar();

    var saved = sessionStorage.getItem('latte_admin_session');
    if (saved) {
      try {
        var parsed = JSON.parse(saved);
        if (parsed.repo && parsed.repo !== 'Latte7-9/latte-site') $('repoInput').value = parsed.repo;
        else $('repoInput').value = defaultRepo;
        if (parsed.token) $('tokenInput').value = parsed.token;
      } catch (err) {}
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    login: login,
    saveSite: saveSite,
    saveInterests: saveInterests,
    saveBlog: saveBlog,
    saveComments: saveComments,
    savePhoto: savePhoto,
    saveBooks: saveBooks,
    saveHiking: saveHiking,
    loadImages: loadImages,
    syncMusic: syncMusic
  };
})();

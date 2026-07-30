(function () {
  function escapeHTML(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function storageKey() {
    return 'latte_blog_comments:' + location.pathname.replace(/\/index\.html$/, '/');
  }

  function loadComments() {
    try {
      return JSON.parse(localStorage.getItem(storageKey()) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveComments(comments) {
    localStorage.setItem(storageKey(), JSON.stringify(comments));
  }

  function renderList(root) {
    var list = root.querySelector('.latte-comment-list');
    var comments = loadComments();
    if (!comments.length) {
      list.innerHTML = '<p>还没有评论，先把一枚念头放在这里。</p>';
      return;
    }
    list.innerHTML = comments.map(function (comment) {
      return '<article class="latte-comment-card">' +
        '<strong>' + escapeHTML(comment.name || '匿名访客') + '</strong>' +
        '<time>' + escapeHTML(comment.date || '') + '</time>' +
        '<p>' + escapeHTML(comment.text || '').replace(/\n/g, '<br>') + '</p>' +
      '</article>';
    }).join('');
  }

  function init() {
    if (!/\/blog\/posts\//.test(location.pathname)) return;
    if (document.querySelector('.latte-comments')) {
      renderList(document.querySelector('.latte-comments'));
      return;
    }
    var article = document.querySelector('.blog-article, body > article');
    if (!article) return;
    var root = document.createElement('section');
    root.className = 'latte-comments';
    root.innerHTML =
      '<p class="motion-label">COMMENTS</p>' +
      '<h2>评论池</h2>' +
      '<form class="latte-comment-form">' +
        '<input name="name" maxlength="24" placeholder="名字">' +
        '<input name="text" maxlength="240" placeholder="写点什么">' +
        '<button type="submit">发表评论</button>' +
      '</form>' +
      '<div class="latte-comment-list"></div>';
    article.insertAdjacentElement('afterend', root);
    root.querySelector('form').addEventListener('submit', function (event) {
      event.preventDefault();
      var name = root.querySelector('[name="name"]').value.trim() || '匿名访客';
      var text = root.querySelector('[name="text"]').value.trim();
      if (!text) return;
      var comments = loadComments();
      comments.unshift({
        name: name,
        text: text,
        date: new Date().toLocaleString('zh-CN', { hour12: false })
      });
      saveComments(comments);
      event.currentTarget.reset();
      renderList(root);
    });
    renderList(root);
  }

  window.LatteBlogComments = { init: init };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

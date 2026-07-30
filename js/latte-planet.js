(function () {
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = document.querySelector('.planet-nav');
  var navToggle = document.getElementById('navToggle');
  var links = document.getElementById('planetLinks');
  var loader = document.getElementById('motionLoader');
  var loaderItems = document.querySelectorAll('.loader-item');
  var soundButton = document.getElementById('soundButton');
  var vinylDock = document.getElementById('vinylDock');
  var vinylDisc = document.getElementById('vinylDisc');
  var vinylInfo = vinylDock ? vinylDock.querySelector('.vinyl-info') : null;
  var vinylTitle = document.getElementById('vinylTrackTitle');
  var vinylArtist = document.getElementById('vinylTrackArtist');
  var vinylIframe = document.getElementById('vinylIframe');
  var noteBlog = document.querySelector('.note-blog');
  var noteMusic = document.querySelector('.note-music');
  var moduleMusic = document.getElementById('moduleMusic');
  var duckPoolScene = document.getElementById('duckPoolScene');
  var poolMessage = document.getElementById('poolMessage');
  var messageForm = document.getElementById('messageForm');
  var duckButton = document.getElementById('duckButton');
  var progress = document.getElementById('reading-progress');
  var activeDuck = null;
  var dragState = null;
  var cachedSongs = null;
  var activeSong = null;
  var iframeLoaded = false;

  if (vinylInfo) {
    vinylTitle = vinylTitle || vinylInfo.querySelector('strong');
    vinylArtist = vinylArtist || vinylInfo.querySelector('span');
  }

  function getAPIBase() {
    var host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1') ? '' : 'https://latte-site-production.up.railway.app';
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  function normalizeSongs(data) {
    if (!data) return [];
    if (Array.isArray(data.songs)) return data.songs;
    if (data.netease && Array.isArray(data.netease.songs)) return data.netease.songs;
    return [];
  }

  function loadNeteaseSongs() {
    if (cachedSongs) return Promise.resolve(cachedSongs);
    return fetchJSON(getAPIBase() + '/api/netease/weekly')
      .catch(function () { return fetchJSON('data/currently.json?v=' + Date.now()); })
      .then(function (data) {
        cachedSongs = normalizeSongs(data);
        return cachedSongs;
      })
      .catch(function () {
        cachedSongs = [];
        return cachedSongs;
      });
  }

  function ensureVinylIframe(song) {
    if (!song || !song.id || iframeLoaded) return;
    if (!vinylIframe && vinylInfo) {
      vinylIframe = document.createElement('div');
      vinylIframe.className = 'vinyl-iframe';
      vinylIframe.id = 'vinylIframe';
      vinylInfo.appendChild(vinylIframe);
    }
    if (!vinylIframe) return;
    vinylIframe.innerHTML = '<iframe title="' + '\u7f51\u6613\u4e91\u97f3\u4e50\u64ad\u653e\u5668' + '" frameborder="no" border="0" marginwidth="0" marginheight="0" width="100%" height="66" src="https://music.163.com/outchain/player?type=2&id=' + encodeURIComponent(song.id) + '&auto=1&height=66"></iframe>';
    iframeLoaded = true;
  }

  function updateVinylSong(song) {
    if (!song) return;
    activeSong = song;
    if (vinylTitle) vinylTitle.textContent = song.name || '\u591c\u95f4\u6f02\u6d6e\u7535\u53f0';
    if (vinylArtist) vinylArtist.textContent = song.artists || '\u7f51\u6613\u4e91\u6700\u8fd1\u5e38\u542c';
  }

  function initLatestBlogLink() {
    if (!noteBlog) return;
    fetchJSON('data/blog.json?v=' + Date.now()).then(function (blog) {
      var posts = (blog && blog.posts) || [];
      if (!posts.length) return;
      posts.sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
      var latest = posts[0];
      if (!latest || !latest.file) return;
      var href = 'blog/posts/' + latest.file;
      if (noteBlog.tagName === 'A') noteBlog.href = href;
      noteBlog.setAttribute('data-clickable', 'true');
      noteBlog.setAttribute('aria-label', '\u6253\u5f00\u6700\u65b0\u535a\u5ba2');
      noteBlog.addEventListener('click', function (event) {
        if (noteBlog.tagName === 'A') return;
        window.location.href = href;
      });
      noteBlog.addEventListener('keydown', function (event) {
        if (noteBlog.tagName === 'A') return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          window.location.href = href;
        }
      });
    }).catch(function () {});
  }

  function setProgress() {
    if (!progress) return;
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var height = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = height > 0 ? (scrollTop / height * 100) + '%' : '0';
  }

  function initSettleLoader() {
    if (!loader) return;
    var settled = false;
    function skipLoader() {
      if (settled) return;
      settled = true;
      loaderItems.forEach(function (item) { item.classList.remove('is-settling'); });
      document.body.classList.remove('loader-active');
      document.body.classList.add('home-settled');
      loader.classList.add('is-hidden');
      initGsapMotion();
      window.dispatchEvent(new CustomEvent('latte:home-settled'));
      window.removeEventListener('pointerdown', skipLoader);
      window.removeEventListener('touchstart', skipLoader);
      window.removeEventListener('keydown', skipLoader);
    }
    if (prefersReducedMotion) {
      skipLoader();
      return;
    }
    document.body.classList.add('loader-active');
    loaderItems.forEach(function (item) { item.classList.add('is-settling'); });
    window.addEventListener('pointerdown', skipLoader, { once: true });
    window.addEventListener('touchstart', skipLoader, { once: true, passive: true });
    window.addEventListener('keydown', skipLoader, { once: true });
    setTimeout(skipLoader, 1900);
  }

  function initNav() {
    if (!nav || !navToggle || !links) return;
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function () {
      nav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  }

  function scrollToHashTarget() {
    if (!window.location.hash) return;
    var targetId = decodeURIComponent(window.location.hash.slice(1));
    var target = document.getElementById(targetId);
    if (!target) return;
    setTimeout(function () {
      target.scrollIntoView({ block: 'start' });
    }, 120);
  }

  function openVinyl() {
    if (window.LatteGlobalPlayer && typeof window.LatteGlobalPlayer.play === 'function') {
      window.LatteGlobalPlayer.play();
    }
    if (!vinylDock) return;
    vinylDock.classList.add('is-open', 'is-playing');
    if (noteMusic) noteMusic.classList.add('is-playing');
    if (soundButton) {
      soundButton.setAttribute('aria-pressed', 'true');
      soundButton.classList.add('is-jelly');
      setTimeout(function () { soundButton.classList.remove('is-jelly'); }, 650);
    }
    loadNeteaseSongs().then(function (songs) {
      updateVinylSong(activeSong || songs[0]);
      ensureVinylIframe(activeSong || songs[0]);
    });
  }

  function initVinyl() {
    if (vinylDisc) {
      vinylDisc.addEventListener('click', function () {
        vinylDock.classList.toggle('is-open');
      });
    }
    if (soundButton) {
      soundButton.addEventListener('click', openVinyl);
    }
    if (noteMusic) {
      noteMusic.setAttribute('data-clickable', 'true');
      noteMusic.setAttribute('tabindex', '0');
      noteMusic.setAttribute('role', 'button');
      noteMusic.addEventListener('click', openVinyl);
      noteMusic.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openVinyl();
        }
      });
    }
    if (moduleMusic) {
      moduleMusic.addEventListener('click', function () {
        window.location.href = 'music/';
      });
    }
    loadNeteaseSongs().then(function (songs) {
      updateVinylSong(songs[0]);
    });
  }

  function initMessages() {
    var seed = [
      { name: 'Latte', text: '\u6b22\u8fce\u6295\u5165\u4e00\u53ea\u5c0f\u9ec4\u9e2d', x: 24, y: 48 },
      { name: '\u8bbf\u5ba2', text: '\u8fd9\u4e2a\u5b87\u5b99\u6709\u70b9\u4eae', x: 52, y: 58 },
      { name: '\u670b\u53cb', text: '\u8def\u8fc7\uff0c\u6295\u5582\u4e00\u70b9\u7075\u611f', x: 77, y: 43 }
    ];

    function getDuckPosition(item, index) {
      if (item.x && item.y) return { x: item.x, y: item.y };
      var columns = 10;
      var row = Math.floor(index / columns);
      var col = index % columns;
      var wrapRow = row % 5;
      var xJitter = ((index * 17) % 7) - 3;
      var yJitter = ((index * 11) % 9) - 4;
      return {
        x: 10 + col * 8.8 + xJitter * 0.55,
        y: 30 + wrapRow * 10.5 + yJitter * 0.5
      };
    }

    function renderDuck(item, index, options) {
      if (!duckPoolScene) return;
      options = options || {};
      var duck = document.createElement('button');
      duck.type = 'button';
      duck.className = 'message-duck' + (options.drop ? ' is-dropping' : '');
      duck.dataset.message = item.name + '：' + item.text;
      var position = getDuckPosition(item, index);
      duck.style.left = position.x + '%';
      duck.style.top = position.y + '%';
      duck.style.zIndex = String(Math.round(position.y));
      duck.style.animationDelay = options.drop ? '0s' : (index * -0.7) + 's';
      duck.innerHTML = '<span class="duck-tail"></span><span class="duck-head"></span><span class="duck-wing"></span>';
      duck.addEventListener('click', function () {
        if (duck.dataset.wasDragged === 'true') {
          duck.dataset.wasDragged = 'false';
          return;
        }
        if (poolMessage) poolMessage.textContent = duck.dataset.message;
        duck.classList.add('is-jelly');
        setTimeout(function () { duck.classList.remove('is-jelly'); }, 650);
      });
      duck.addEventListener('pointerdown', startDuckDrag);
      duckPoolScene.appendChild(duck);
      if (options.drop) {
        setTimeout(function () {
          var rect = duckPoolScene.getBoundingClientRect();
          createPoolRipple(rect.width * position.x / 100, rect.height * position.y / 100);
          createPoolBubble(rect.width * position.x / 100, rect.height * position.y / 100, true);
          duckPoolScene.classList.add('is-rippling');
          setTimeout(function () { duckPoolScene.classList.remove('is-rippling'); }, 560);
        }, prefersReducedMotion ? 0 : 520);
        duck.addEventListener('animationend', function () {
          duck.classList.remove('is-dropping');
          duck.style.animationDelay = (index * -0.7) + 's';
        }, { once: true });
      }
      return duck;
    }

    seed.forEach(renderDuck);

    if (duckButton) {
      duckButton.addEventListener('click', function () {
        document.getElementById('guestText')?.focus();
        if (poolMessage) poolMessage.textContent = '小黄鸭：嘎，等你把留言丢进池子';
      });
    }

    if (!messageForm) return;
    messageForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var nameInput = document.getElementById('guestName');
      var textInput = document.getElementById('guestText');
      var name = (nameInput && nameInput.value.trim()) || '匿名访客';
      var text = textInput && textInput.value.trim();
      if (!text) return;
      var count = duckPoolScene ? duckPoolScene.querySelectorAll('.message-duck').length : 0;
      var duck = renderDuck({ name: name, text: text }, count, { drop: true });
      if (poolMessage) poolMessage.textContent = '新鸭子入水，点它读取刚刚的留言';
      messageForm.reset();
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function createPoolRipple(x, y) {
    if (!duckPoolScene || prefersReducedMotion) return;
    var ripple = document.createElement('span');
    ripple.className = 'pool-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    duckPoolScene.appendChild(ripple);
    ripple.addEventListener('animationend', function () {
      ripple.remove();
    }, { once: true });
  }

  function createPoolBubble(x, y, burst) {
    if (!duckPoolScene || prefersReducedMotion) return;
    var total = burst ? 5 : 2;
    for (var i = 0; i < total; i += 1) {
      var bubble = document.createElement('span');
      bubble.className = 'pool-bubble';
      var size = burst ? 5 + Math.random() * 8 : 4 + Math.random() * 5;
      bubble.style.setProperty('--bubble-size', size.toFixed(1) + 'px');
      bubble.style.setProperty('--bubble-drift', ((Math.random() * 24) - 12).toFixed(1) + 'px');
      bubble.style.left = (x + (Math.random() * 34) - 17) + 'px';
      bubble.style.top = (y + (Math.random() * 16) - 8) + 'px';
      duckPoolScene.appendChild(bubble);
      bubble.addEventListener('animationend', function (event) {
        event.currentTarget.remove();
      }, { once: true });
    }
  }

  function startDuckDrag(event) {
    if (!duckPoolScene || event.button > 0) return;
    activeDuck = event.currentTarget;
    var poolRect = duckPoolScene.getBoundingClientRect();
    var duckRect = activeDuck.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - duckRect.left - duckRect.width / 2,
      offsetY: event.clientY - duckRect.top - duckRect.height / 2,
      startX: event.clientX,
      startY: event.clientY,
      lastBubbleAt: 0
    };
    activeDuck.setPointerCapture(event.pointerId);
    activeDuck.classList.add('is-dragging');
    duckPoolScene.classList.add('is-rippling');
    duckPoolScene.closest('.duck-pool-scene')?.classList.add('is-dragging');
    createPoolRipple(event.clientX - poolRect.left, event.clientY - poolRect.top);
    createPoolBubble(event.clientX - poolRect.left, event.clientY - poolRect.top, true);
    window.addEventListener('pointermove', moveDuckDrag);
    window.addEventListener('pointerup', endDuckDrag);
    window.addEventListener('pointercancel', endDuckDrag);
  }

  function moveDuckDrag(event) {
    if (!activeDuck || !dragState || event.pointerId !== dragState.pointerId) return;
    var rect = duckPoolScene.getBoundingClientRect();
    var duckWidth = activeDuck.offsetWidth;
    var duckHeight = activeDuck.offsetHeight;
    var x = event.clientX - rect.left - dragState.offsetX;
    var y = event.clientY - rect.top - dragState.offsetY;
    var safeX = clamp(x, duckWidth * 0.42, rect.width - duckWidth * 0.42);
    var safeY = clamp(y, duckHeight * 0.45, rect.height - duckHeight * 0.28);
    activeDuck.style.left = (safeX / rect.width * 100).toFixed(2) + '%';
    activeDuck.style.top = (safeY / rect.height * 100).toFixed(2) + '%';
    if (Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) > 6) {
      activeDuck.dataset.wasDragged = 'true';
    }
    if (event.timeStamp - dragState.lastBubbleAt > 90) {
      dragState.lastBubbleAt = event.timeStamp;
      createPoolBubble(safeX, safeY + duckHeight * 0.2, false);
    }
  }

  function endDuckDrag(event) {
    if (!activeDuck || !dragState || event.pointerId !== dragState.pointerId) return;
    var rect = duckPoolScene.getBoundingClientRect();
    var x = clamp(event.clientX - rect.left, 0, rect.width);
    var y = clamp(event.clientY - rect.top, 0, rect.height);
    createPoolRipple(x, y);
    createPoolBubble(x, y, true);
    var settlingDuck = activeDuck;
    settlingDuck.classList.remove('is-dragging');
    settlingDuck.classList.remove('is-settling');
    void settlingDuck.offsetWidth;
    settlingDuck.classList.add('is-settling');
    settlingDuck.addEventListener('animationend', function () {
      settlingDuck.classList.remove('is-settling');
    }, { once: true });
    setTimeout(function () {
      settlingDuck.classList.remove('is-settling');
    }, 850);
    duckPoolScene.classList.remove('is-rippling');
    duckPoolScene.closest('.duck-pool-scene')?.classList.remove('is-dragging');
    activeDuck.releasePointerCapture?.(dragState.pointerId);
    window.removeEventListener('pointermove', moveDuckDrag);
    window.removeEventListener('pointerup', endDuckDrag);
    window.removeEventListener('pointercancel', endDuckDrag);
    activeDuck = null;
    dragState = null;
  }

  function initMagneticCards() {
    if (prefersReducedMotion) return;
    var cards = document.querySelectorAll('.magnetic-card');
    cards.forEach(function (card) {
      card.addEventListener('pointermove', function (event) {
        if (card.classList.contains('message-duck')) return;
        var rect = card.getBoundingClientRect();
        var x = (event.clientX - rect.left - rect.width / 2) / rect.width;
        var y = (event.clientY - rect.top - rect.height / 2) / rect.height;
        card.style.setProperty('--glow-x', ((x + 0.5) * 100).toFixed(1) + '%');
        card.style.setProperty('--glow-y', ((y + 0.5) * 100).toFixed(1) + '%');
        card.classList.add('is-active');
        if (window.innerWidth < 980) {
          card.style.translate = (x * 7).toFixed(2) + 'px ' + (y * 7).toFixed(2) + 'px';
          card.style.scale = '1.025';
          return;
        }
        card.style.transform = 'translate(' + (x * 8).toFixed(2) + 'px,' + (y * 8).toFixed(2) + 'px) rotateX(' + (y * -5).toFixed(2) + 'deg) rotateY(' + (x * 5).toFixed(2) + 'deg)';
      });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
        card.style.translate = '';
        card.style.scale = '';
        card.classList.remove('is-active');
      });
      card.addEventListener('pointerdown', function (event) {
        if (card.classList.contains('message-duck')) return;
        var rect = card.getBoundingClientRect();
        card.style.setProperty('--glow-x', ((event.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
        card.style.setProperty('--glow-y', ((event.clientY - rect.top) / rect.height * 100).toFixed(1) + '%');
        card.style.setProperty('--tap-rotate', card.classList.contains('note-music') ? '1.5deg' : '-1.5deg');
        card.classList.add('is-active', 'is-tapped');
        setTimeout(function () {
          card.classList.remove('is-tapped');
          if (!card.matches(':hover')) card.classList.remove('is-active');
        }, 480);
      });
    });
  }

  function initGsapMotion() {
    if (prefersReducedMotion || !window.gsap) return;
    var gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    gsap.from('.hero-copy > *', {
      y: 28,
      opacity: 0,
      duration: 0.9,
      stagger: 0.08,
      ease: 'power3.out',
      delay: 0.55
    });

    gsap.from('.planet-stage', {
      scale: 1.32,
      opacity: 0,
      duration: 1.15,
      ease: 'expo.out',
      delay: 0.25
    });

    var floatingNotes = document.querySelectorAll('.floating-note:not(.loader-item)');
    if (floatingNotes.length) {
      gsap.from(floatingNotes, {
        y: 48,
        opacity: 0,
        duration: 0.95,
        stagger: 0.12,
        ease: 'power3.out',
        delay: 0.82
      });
    }

    gsap.to('.orbit-wide', {
      rotation: '+=360',
      duration: 42,
      repeat: -1,
      ease: 'none'
    });

    gsap.to('.orbit-tight', {
      rotation: '-=360',
      duration: 36,
      repeat: -1,
      ease: 'none'
    });

    gsap.to('.status-planet', {
      y: -8,
      duration: 5.5,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut'
    });

    if (window.innerWidth < 980) {
      gsap.to('.floating-note', {
        y: function (index) { return index % 2 ? 10 : -10; },
        x: function (index) { return index % 3 === 0 ? 4 : -3; },
        duration: function (index) { return 3.8 + index * 0.28; },
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: 0.12,
        delay: 1.25
      });
    } else if (window.ScrollTrigger) {
      gsap.utils.toArray('.floating-note').forEach(function (note, index) {
        gsap.to(note, {
          y: index % 2 ? 72 : -54,
          rotation: index % 2 ? -3 : 3,
          ease: 'none',
          scrollTrigger: {
            trigger: '.planet-hero',
            start: 'top top',
            end: 'bottom top',
            scrub: 0.8
          }
        });
      });

      gsap.utils.toArray('[data-motion="lift"], .module-card, .message-console').forEach(function (node) {
        gsap.from(node, {
          y: 34,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: node,
            start: 'top 82%'
          }
        });
      });
    }
  }

  window.addEventListener('scroll', setProgress, { passive: true });
  window.addEventListener('resize', setProgress);
  window.addEventListener('hashchange', scrollToHashTarget);
  document.addEventListener('DOMContentLoaded', function () {
    initSettleLoader();
    setProgress();
    initNav();
    initLatestBlogLink();
    initVinyl();
    initMessages();
    initMagneticCards();
    scrollToHashTarget();
  });
})();


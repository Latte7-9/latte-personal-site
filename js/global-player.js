(function () {
  if (window.LatteGlobalPlayer && window.LatteGlobalPlayer.ready) {
    window.LatteGlobalPlayer.ensure();
    return;
  }

  var state = {
    ready: true,
    root: null,
    disc: null,
    playControl: null,
    title: null,
    artist: null,
    iframe: null,
    songs: null,
    currentSong: null,
    audioLoaded: false,
    playing: false,
    rootBase: '',
    loadedScripts: {}
  };

  function getRootBase() {
    var script = document.currentScript && document.currentScript.src;
    if (script) return script.replace(/js\/global-player\.js(?:\?.*)?$/, '');
    var cursor = document.querySelector('script[src$="js/cursor.js"],script[src*="js/cursor.js?"]');
    if (cursor && cursor.src) return cursor.src.replace(/js\/cursor\.js(?:\?.*)?$/, '');
    return location.origin + '/';
  }

  function apiBase() {
    var host = location.hostname;
    return (host === 'localhost' || host === '127.0.0.1') ? '' : 'https://latte-site-production.up.railway.app';
  }

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function normalizeSongs(data) {
    if (!data) return [];
    if (Array.isArray(data.songs)) return data.songs;
    if (data.netease && Array.isArray(data.netease.songs)) return data.netease.songs;
    return [];
  }

  function loadSongs() {
    if (state.songs) return Promise.resolve(state.songs);
    return fetchJSON(apiBase() + '/api/netease/weekly')
      .catch(function () { return fetchJSON(state.rootBase + 'data/currently.json?v=' + Date.now()); })
      .then(function (data) {
        state.songs = normalizeSongs(data);
        return state.songs;
      })
      .catch(function () {
        state.songs = [];
        return state.songs;
      });
  }

  function setSong(song) {
    if (!song) return;
    state.currentSong = song;
    if (state.title) state.title.textContent = song.name || '\u591c\u95f4\u6f02\u6d6e\u7535\u53f0';
    if (state.artist) state.artist.textContent = song.artists || '\u7f51\u6613\u4e91\u6700\u8fd1\u5e38\u542c';
  }

  function loadAudio(song) {
    if (!song || !song.id || state.audioLoaded) return;
    state.iframe.src = 'https://music.163.com/outchain/player?type=2&id=' + encodeURIComponent(song.id) + '&auto=1&height=32';
    state.audioLoaded = true;
  }

  function syncControl() {
    if (!state.playControl) return;
    state.playControl.classList.toggle('is-playing', state.playing);
    state.playControl.setAttribute('aria-label', state.playing ? '\u6682\u505c\u9ed1\u80f6\u7535\u53f0' : '\u64ad\u653e\u9ed1\u80f6\u7535\u53f0');
    state.playControl.setAttribute('title', state.playing ? '\u6682\u505c' : '\u64ad\u653e');
  }

  function play() {
    ensure();
    state.root.classList.add('is-open', 'is-playing');
    state.playing = true;
    syncControl();
    loadSongs().then(function (songs) {
      setSong(state.currentSong || songs[0]);
      loadAudio(state.currentSong || songs[0]);
    });
  }

  function pause() {
    ensure();
    state.playing = false;
    state.audioLoaded = false;
    if (state.iframe) state.iframe.src = 'about:blank';
    state.root.classList.remove('is-playing');
    if (state.artist) state.artist.textContent = '\u5df2\u6682\u505c\uff0c\u70b9\u51fb\u64ad\u653e\u91cd\u65b0\u5f00\u59cb';
    syncControl();
  }

  function togglePlayback() {
    if (state.playing) pause();
    else play();
  }

  function toggle() {
    ensure();
    var isOpen = state.root.classList.contains('is-open');
    state.root.classList.toggle('is-open', !isOpen);
  }

  function waitForHomeSettle(root) {
    var reveal = function () {
      requestAnimationFrame(function () {
        root.classList.remove('awaiting-home-settle');
        root.classList.add('is-home-revealed');
      });
    };
    if (document.body.classList.contains('home-settled')) {
      root.classList.add('awaiting-home-settle');
      window.setTimeout(reveal, 80);
      return;
    }
    if (!document.body.classList.contains('loader-active')) return;
    root.classList.add('awaiting-home-settle');
    window.addEventListener('latte:home-settled', function () {
      reveal();
    }, { once: true });
  }

  function ensure() {
    state.rootBase = state.rootBase || getRootBase();
    if (state.root && document.body.contains(state.root)) return state.root;
    if (state.root && !document.body.contains(state.root)) {
      document.body.appendChild(state.root);
      return state.root;
    }

    state.root = document.createElement('aside');
    state.root.className = 'latte-global-player';
    state.root.setAttribute('aria-label', '\u9ed1\u80f6\u60ac\u6d6e\u7535\u53f0');
    state.root.innerHTML =
      '<button class="latte-global-disc" type="button" aria-label="' + '\u64ad\u653e\u6216\u5c55\u5f00\u9ed1\u80f6\u7535\u53f0' + '"></button>' +
      '<div class="latte-global-panel">' +
        '<p class="latte-global-label">NOW PLAYING</p>' +
        '<strong class="latte-global-title">' + '\u591c\u95f4\u6f02\u6d6e\u7535\u53f0' + '</strong>' +
        '<span class="latte-global-artist">' + '\u70b9\u51fb\u5531\u7247\u5f00\u59cb\u64ad\u653e' + '</span>' +
        '<button class="latte-global-toggle" type="button" aria-label="' + '\u64ad\u653e\u9ed1\u80f6\u7535\u53f0' + '"><span aria-hidden="true"></span></button>' +
        '<div class="latte-global-wave" aria-hidden="true"></div>' +
      '</div>' +
      '<div class="latte-hidden-audio" aria-hidden="true"><iframe title="' + '\u7f51\u6613\u4e91\u97f3\u4e50\u9690\u85cf\u64ad\u653e\u5668' + '" frameborder="no" border="0" marginwidth="0" marginheight="0" allow="autoplay"></iframe></div>';
    document.body.appendChild(state.root);
    waitForHomeSettle(state.root);

    state.disc = state.root.querySelector('.latte-global-disc');
    state.title = state.root.querySelector('.latte-global-title');
    state.artist = state.root.querySelector('.latte-global-artist');
    state.playControl = state.root.querySelector('.latte-global-toggle');
    state.iframe = state.root.querySelector('iframe');
    state.disc.addEventListener('click', toggle);
    state.playControl.addEventListener('click', function(event) {
      event.stopPropagation();
      togglePlayback();
    });
    loadSongs().then(function (songs) { setSong(songs[0]); });
    syncControl();
    return state.root;
  }

  window.LatteGlobalPlayer = {
    ready: true,
    ensure: ensure,
    play: play,
    pause: pause,
    toggle: toggle
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensure);
  } else {
    ensure();
  }
})();

(function () {
  var state = { session: null, songs: [] };
  var el = {};

  function $(id) { return document.getElementById(id); }
  function apiBase() {
    return (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? '' : 'https://latte-site-production.up.railway.app';
  }
  function escapeHTML(value) {
    return String(value || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fetchJSON(url, options) {
    return fetch(url, Object.assign({ cache: 'no-store' }, options || {})).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
        return data;
      });
    });
  }
  function songUrl(song) { return song.url || ('https://music.163.com/#/song?id=' + encodeURIComponent(song.id || '')); }
  function normalizeSongs(data) {
    if (data && Array.isArray(data.songs)) return data.songs;
    if (data && data.netease && Array.isArray(data.netease.songs)) return data.netease.songs;
    return [];
  }
  function renderWeekly(songs) {
    var list = songs.slice(0, 10);
    el.fmWeeklyStatus.textContent = list.length ? '当前缓存' : '暂时不可用';
    if (!list.length) {
      el.fmWeeklyGrid.innerHTML = '<p class="fm-weekly-empty">最近常听暂时读取失败，请稍后再试。</p>';
      return;
    }
    el.fmWeeklyGrid.innerHTML = list.map(function (song, index) {
      var art = song.cover ? '<img src="' + escapeHTML(song.cover) + '" alt="" loading="lazy">' : '<span class="fm-art-placeholder">' + String(index + 1).padStart(2, '0') + '</span>';
      return '<a class="fm-weekly-card" href="' + escapeHTML(songUrl(song)) + '" target="_blank" rel="noopener"><span class="fm-weekly-order">' + String(index + 1).padStart(2, '0') + '</span><span class="fm-weekly-art">' + art + '</span><span class="fm-weekly-copy"><b>' + escapeHTML(song.name) + '</b><i>' + escapeHTML(song.artists) + '</i><small>最近常听第 ' + (song.weeklyRank || index + 1) + ' 位</small></span><span class="fm-open-song" aria-hidden="true">↗</span></a>';
    }).join('');
  }
  function loadWeekly() {
    fetchJSON(apiBase() + '/api/netease/weekly').catch(function () {
      return fetchJSON('../data/currently.json?v=' + Date.now());
    }).then(function (data) {
      renderWeekly(normalizeSongs(data));
    }).catch(function () {
      renderWeekly([]);
    });
  }
  function renderPlaylist() {
    if (!state.session) return;
    el.fmPlaylistTitle.textContent = state.session.title || '此刻的 12 首推荐';
    el.fmPlaylistGrid.innerHTML = state.songs.map(function (song, index) {
      var art = song.cover ? '<img src="' + escapeHTML(song.cover) + '" alt="" loading="lazy">' : '<span class="fm-art-placeholder">' + String(index + 1).padStart(2, '0') + '</span>';
      return '<a class="fm-playlist-card" href="' + escapeHTML(songUrl(song)) + '" target="_blank" rel="noopener"><div class="fm-card-art">' + art + '</div><div class="fm-card-body"><div class="fm-card-heading"><span>' + String(index + 1).padStart(2, '0') + '</span><b>' + escapeHTML(song.name) + '</b></div><i>' + escapeHTML(song.artists) + '</i></div><span class="fm-open-song" aria-hidden="true">↗</span></a>';
    }).join('');
  }
  function generate(event) {
    event.preventDefault();
    var prompt = el.fmPrompt.value.trim();
    if (prompt.length < 4) { el.fmStatus.textContent = '请至少写一句心情或天气。'; return; }
    el.fmGenerateBtn.disabled = true;
    fetchJSON(apiBase() + '/api/fm/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt }) })
      .then(function (data) { state.session = data.session; state.songs = data.session.songs || []; el.fmPlaylistShell.hidden = false; renderPlaylist(); })
      .catch(function () { el.fmStatus.textContent = '推荐服务暂时不可用，最近常听仍可正常查看。'; })
      .finally(function () { el.fmGenerateBtn.disabled = false; });
  }
  function init() {
    ['fmPromptForm', 'fmPrompt', 'fmGenerateBtn', 'fmStatus', 'fmLibraryStatus', 'fmWeeklyStatus', 'fmWeeklyGrid', 'fmPlaylistShell', 'fmPlaylistTitle', 'fmPlaylistGrid'].forEach(function (id) { el[id] = $(id); });
    el.fmPromptForm.addEventListener('submit', generate);
    fetchJSON(apiBase() + '/api/netease/status').then(function (data) {
      el.fmLibraryStatus.textContent = (data.fmLibrarySongs || 0) + ' 首歌可供推荐';
    }).catch(function () {
      fetchJSON('../data/currently.json?v=' + Date.now()).then(function (data) {
        el.fmLibraryStatus.textContent = normalizeSongs(data).length + ' 首歌（当前缓存）';
      }).catch(function () { el.fmLibraryStatus.textContent = '歌曲暂时不可用'; });
    });
    loadWeekly();
  }
  document.addEventListener('DOMContentLoaded', init);
})();

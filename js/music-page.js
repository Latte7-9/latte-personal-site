(function () {
  var state = { session: null, songs: [] };
  var el = {};
  function $(id) { return document.getElementById(id); }
  function getAPIBase() { return (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : 'https://latte-site-production.up.railway.app'; }
  function escapeHTML(value) { return String(value || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fetchJSON(url, options) { return fetch(url, Object.assign({ cache: 'no-store' }, options || {})).then(function (response) { return response.json().catch(function () { return {}; }).then(function (data) { if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status)); return data; }); }); }
  function postJSON(url, body) { return fetchJSON(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
  function songUrl(song) { return song.url || ('https://music.163.com/#/song?id=' + encodeURIComponent(song.id || '')); }
  function setStatus(message, tone) { el.fmStatus.textContent = message; el.fmStatus.dataset.tone = tone || 'info'; }
  function setGenerationStep(index, percent, label) { el.fmGeneration.hidden = false; el.fmGenerationLabel.textContent = label; el.fmGenerationPercent.textContent = Math.round(percent) + '%'; el.fmGenerationBar.style.width = percent + '%'; el.fmGenerationSteps.querySelectorAll('li').forEach(function (node, i) { node.classList.toggle('is-active', i === index); node.classList.toggle('is-done', i < index); }); }
  function listeningMeta(song) { if (Number(song.playCount) > 0) return '近期播放 ' + song.playCount + ' 次'; if (song.weeklyRank) return '最近常听第 ' + song.weeklyRank + ' 位'; return '收录在喜欢歌曲'; }
  function sourceMeta(song) { return song.source === 'weekly' || song.source === 'liked+weekly' ? '最近常听' : '喜欢歌曲'; }
  function renderWeekly(songs) {
    var list = Array.isArray(songs) ? songs.slice(0, 10) : [];
    el.fmWeeklyStatus.textContent = list.length ? '\u66f4\u65b0\u4e8e\u521a\u521a' : '\u6682\u65f6\u4e0d\u53ef\u7528';
    if (!list.length) {
      el.fmWeeklyGrid.innerHTML = '<p class="fm-weekly-empty">\u6682\u65f6\u65e0\u6cd5\u8bfb\u53d6\u6700\u8fd1\u5e38\u542c\uff0c\u9996\u9875\u9ed1\u80f6\u4f1a\u5728\u4e0b\u6b21\u540c\u6b65\u540e\u6062\u590d\u66f4\u65b0\u3002</p>';
      return;
    }
    el.fmWeeklyGrid.innerHTML = list.map(function (song, index) {
      var art = song.cover ? '<img src="' + escapeHTML(song.cover) + '" alt="" loading="lazy">' : '<span class="fm-art-placeholder">' + String(index + 1).padStart(2, '0') + '</span>';
      var playMeta = Number(song.playCount) > 0 ? '\u8fd1\u671f\u64ad\u653e ' + song.playCount + ' \u6b21' : '\u6700\u8fd1\u5e38\u542c\u7b2c ' + (song.weeklyRank || index + 1) + ' \u4f4d';
      return '<a class="fm-weekly-card" href="' + escapeHTML(songUrl(song)) + '" target="_blank" rel="noopener" aria-label="\u53bb\u7f51\u6613\u4e91\u64ad\u653e ' + escapeHTML(song.name) + '"><span class="fm-weekly-order">' + String(index + 1).padStart(2, '0') + '</span><span class="fm-weekly-art">' + art + '</span><span class="fm-weekly-copy"><b>' + escapeHTML(song.name) + '</b><i>' + escapeHTML(song.artists) + '</i><small>' + escapeHTML(playMeta) + '</small></span><span class="fm-open-song" aria-hidden="true">\u2197</span></a>';
    }).join('');
  }
  function loadWeekly() {
    fetchJSON(getAPIBase() + '/api/netease/weekly').then(function (data) {
      renderWeekly(data.songs || []);
    }).catch(function () {
      el.fmWeeklyStatus.textContent = '\u6682\u65f6\u4e0d\u53ef\u7528';
      el.fmWeeklyGrid.innerHTML = '<p class="fm-weekly-empty">\u6700\u8fd1\u5e38\u542c\u6682\u65f6\u8bfb\u53d6\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u518d\u65b0\u3002</p>';
    });
  }

  function renderPlaylist() {
    el.fmPlaylistTitle.textContent = state.session.title || '\u6b64\u523b\u7684 12 \u9996\u63a8\u8350';
    el.fmPlaylistGrid.innerHTML = state.songs.map(function (song, index) {
      var art = song.cover ? '<img src="' + escapeHTML(song.cover) + '" alt="" loading="lazy">' : '<span class="fm-art-placeholder">' + String(index + 1).padStart(2, '0') + '</span>';
      return '<a class="fm-playlist-card" href="' + escapeHTML(songUrl(song)) + '" target="_blank" rel="noopener" aria-label="\u53bb\u7f51\u6613\u4e91\u64ad\u653e ' + escapeHTML(song.name) + '"><div class="fm-card-art">' + art + '</div><div class="fm-card-body"><div class="fm-card-heading"><span>' + String(index + 1).padStart(2, '0') + '</span><b>' + escapeHTML(song.name) + '</b></div><i>' + escapeHTML(song.artists) + '</i><div class="fm-card-meta"><em>' + escapeHTML(sourceMeta(song)) + '</em><small>' + escapeHTML(listeningMeta(song)) + '</small></div></div><span class="fm-open-song" aria-hidden="true">\u2197</span></a>';
    }).join('');
  }
  function generate(event) {
    event.preventDefault(); var prompt = el.fmPrompt.value.trim(); if (prompt.length < 4) { setStatus('请至少写一句心情和天气。', 'err'); el.fmPrompt.focus(); return; }
    el.fmGenerateBtn.disabled = true; setStatus('正在为你整理歌单。', 'info'); setGenerationStep(0, 12, '正在整理最近常听'); var phase = 0;
    var timer = setInterval(function () { phase += 1; if (phase === 1) setGenerationStep(1, 36, '正在匹配此刻情绪'); else if (phase === 2) setGenerationStep(2, 64, '正在从喜欢歌曲补全'); else if (phase === 3) setGenerationStep(3, 84, '正在整理推荐顺序'); }, 850);
    postJSON(getAPIBase() + '/api/fm/session', { prompt: prompt }).then(function (data) { state.session = data.session; state.songs = data.session.songs || []; try { sessionStorage.setItem('latte_emotion_playlist', JSON.stringify(data.session)); } catch (e) {} setGenerationStep(3, 100, '12 首推荐已准备好'); setStatus('歌单已生成。点击任意歌曲即可去网易云播放。', 'ok'); el.fmPlaylistShell.hidden = false; renderPlaylist(); el.fmPlaylistShell.scrollIntoView({ behavior: 'smooth', block: 'start' }); }).catch(function (err) { el.fmGeneration.hidden = true; setStatus(err.message || '生成失败，请稍后再试。', 'err'); }).finally(function () { clearInterval(timer); el.fmGenerateBtn.disabled = false; });
  }
  function init() {
    ['fmPromptForm','fmPrompt','fmGenerateBtn','fmStatus','fmLibraryStatus','fmGeneration','fmGenerationLabel','fmGenerationPercent','fmGenerationBar','fmGenerationSteps','fmWeeklyShell','fmWeeklyStatus','fmWeeklyGrid','fmPlaylistShell','fmPlaylistTitle','fmPlaylistGrid'].forEach(function (id) { el[id] = $(id); });
    el.fmPromptForm.addEventListener('submit', generate);
    fetchJSON(getAPIBase() + '/api/netease/status').then(function (data) { el.fmLibraryStatus.textContent = (data.fmLibrarySongs || 0) + ' \u9996\u6b4c\u53ef\u4f9b\u63a8\u8350'; }).catch(function () { el.fmLibraryStatus.textContent = '\u6b4c\u5e93\u7b49\u5f85\u540e\u7aef'; });
    loadWeekly();
    try { var session = JSON.parse(sessionStorage.getItem('latte_emotion_playlist') || 'null'); if (session && session.songs && session.songs.length) { state.session = session; state.songs = session.songs; el.fmPlaylistShell.hidden = false; renderPlaylist(); } } catch (e) {}
  }
  document.addEventListener('DOMContentLoaded', init);
})();
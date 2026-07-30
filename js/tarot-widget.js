(function () {
  var DATA_URL = 'data/tarot-cards.json?v=' + Date.now();
  var DAILY_KEY = 'latte:tarot:daily-reading:v2';
  var LEGACY_DAILY_KEY = 'latte:tarot:daily-reading:v1';
  var CARD_SLOTS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  var dataCache = null;
  var state = null;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function qs(selector, root) { return (root || document).querySelector(selector); }
  function qsa(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function cryptoInt(max) {
    if (!max || max <= 0) return 0;
    if (window.crypto && window.crypto.getRandomValues) {
      var values = new Uint32Array(1);
      var limit = Math.floor(4294967296 / max) * max;
      do { window.crypto.getRandomValues(values); } while (values[0] >= limit);
      return values[0] % max;
    }
    return Math.floor(Math.random() * max);
  }
  function shuffle(items) {
    var copy = items.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = cryptoInt(i + 1);
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }
  function wrap(index, length) { return ((index % length) + length) % length; }
  function shanghaiDate(offset) {
    var date = new Date(Date.now() + (offset || 0) * 86400000);
    var parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date).reduce(function (acc, item) {
      acc[item.type] = item.value;
      return acc;
    }, {});
    return parts.year + '-' + parts.month + '-' + parts.day;
  }
  function storedReading() {
    try {
      var raw = localStorage.getItem(DAILY_KEY) || localStorage.getItem(LEGACY_DAILY_KEY);
      if (!raw) return null;
      var reading = JSON.parse(raw);
      if (!reading || reading.date !== shanghaiDate()) return null;
      if (!localStorage.getItem(DAILY_KEY)) {
        saveReading(reading);
        localStorage.removeItem(LEGACY_DAILY_KEY);
      }
      return reading;
    } catch (e) {
      return null;
    }
  }
  function saveReading(reading) {
    try {
      localStorage.setItem(DAILY_KEY, JSON.stringify({
        date: reading.date,
        spreadKey: reading.spreadKey,
        spreadName: reading.spreadName,
        draws: reading.draws
      }));
    } catch (e) {}
  }
  function loadData() {
    if (dataCache) return Promise.resolve(dataCache);
    return fetch(DATA_URL, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      dataCache = json;
      return json;
    });
  }
  function cardBack() {
    return '<span class="tarot-back-frame"></span><span class="tarot-back-moon"></span><span class="tarot-back-lines"></span>';
  }
  function cardFront(draw) {
    return '<img class="tarot-card-front-image" src="' + esc(draw.card.image) + '" alt="' + esc(draw.card.name) + '">';
  }
  function cardBackToken(draw, index) {
    var label = draw ? draw.position : '待抽取';
    return '<article class="tarot-back-token" aria-label="' + esc(label) + '，牌背朝上"><span class="tarot-back-mini">' + cardBack() + '</span><strong>' + esc(label) + '</strong>' + (index != null ? '<em>' + (index + 1) + '</em>' : '') + '</article>';
  }
  function drawMeaning(draw) {
    return draw.orientation === '逆位' ? draw.card.reversed : draw.card.upright;
  }
  function apiBase() {
    var host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1') ? '' : 'https://latte-site-production.up.railway.app';
  }

  function renderGateway(root) {
    var locked = storedReading();
    root.innerHTML = [
      '<div class="tarot-gateway">',
      '  <div class="tarot-panel-head">',
      '    <p class="motion-label">LATTE TAROT</p>',
      '    <h2 id="latteTarotTitle">LATTE在线塔罗</h2>',
      '    <p>赛博占卜，童叟无欺；有则有之，无则加勉。</p>',
      '  </div>',
      '  <button class="tarot-crystal" id="tarotOpen" type="button" aria-haspopup="dialog" aria-controls="tarotModal">',
      '    <span class="tarot-crystal-orb" aria-hidden="true"></span>',
      '    <span class="tarot-crystal-label">' + (locked ? '查看今日塔罗' : '点击水晶球开始占卜') + '</span>',
      '  </button>',
      '</div>',
      '<section class="tarot-modal" id="tarotModal" role="dialog" aria-modal="true" aria-labelledby="tarotModalTitle" hidden>',
      '  <button class="tarot-close" type="button" data-tarot-close aria-label="关闭塔罗">×</button>',
      '  <div class="tarot-modal-backdrop" data-tarot-close></div>',
      '  <div class="tarot-modal-panel" id="tarotModalPanel" role="document"></div>',
      '</section>'
    ].join('');
    qs('#tarotOpen', root).addEventListener('click', function () { openModal(root); });
    qsa('[data-tarot-close]', root).forEach(function (node) {
      node.addEventListener('click', function () { closeModal(root); });
    });
  }

  function openModal(root) {
    var modal = qs('#tarotModal', root);
    modal.hidden = false;
    document.body.classList.add('tarot-modal-open');
    requestAnimationFrame(function () {
      modal.classList.add('is-open');
      renderModalStart(root);
    });
  }
  function closeModal(root) {
    var modal = qs('#tarotModal', root);
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('tarot-modal-open');
    setTimeout(function () {
      if (!modal.classList.contains('is-open')) modal.hidden = true;
    }, 220);
  }

  function renderModalStart(root) {
    var panel = qs('#tarotModalPanel', root);
    panel.classList.remove('is-drawing-stage');
    var locked = storedReading();
    if (locked) {
      panel.innerHTML = renderLocked(locked);
      return;
    }
    panel.innerHTML = [
      '<div class="tarot-modal-copy"><p class="motion-label">LATTE TAROT</p><h2 id="tarotModalTitle">先聊两句。</h2></div>',
      '<div class="tarot-intake-stream" id="tarotIntakeStream" aria-live="polite"></div>',
      '<div class="tarot-spread-list" id="tarotSpreadList" hidden>',
      Object.keys(dataCache.spreads).map(function (key) { return renderSpread(key, dataCache.spreads[key]); }).join(''),
      '</div>',
      '<form class="tarot-question" id="tarotQuestionForm">',
      '  <textarea id="tarotQuestion" maxlength="180" rows="2" placeholder="不用讲完整。想到哪儿说到哪儿。"></textarea>',
      '  <button type="submit">说一句</button>',
      '</form>',
      '<div class="tarot-draw-area" id="tarotDrawArea" hidden></div>',
      '<div class="tarot-reading-output" id="tarotReadingOutput" hidden></div>'
    ].join('');
    var intake = [{ role: 'assistant', content: '来，说出你的故事' }];
    qs('#tarotQuestionForm', panel).addEventListener('submit', function (event) {
      event.preventDefault();
      var input = qs('#tarotQuestion', panel);
      var text = (input.value || '').trim();
      if (!text) return;
      intake.push({ role: 'user', content: text });
      panel.dataset.tarotQuestion = text;
      input.value = '';
      renderIntake();
      input.disabled = true;
      requestTarotIntake(intake).then(function (result) {
        intake.push({ role: 'assistant', content: result.message });
        renderIntake();
        if (result.ready) qs('#tarotSpreadList', panel).hidden = false;
        else input.focus();
      }).catch(function () {
        intake.push({ role: 'assistant', content: '我刚才没接住。你最近最难受的是哪一件事？' });
        renderIntake();
      }).finally(function () { input.disabled = false; });
    });
    function renderIntake() {
      qs('#tarotIntakeStream', panel).innerHTML = intake.map(function (item) {
        return '<p class="tarot-chat-message ' + (item.role === 'user' ? 'is-user' : 'is-latte') + '">' + esc(item.content) + '</p>';
      }).join('');
    }
    renderIntake();
    qs('#tarotSpreadList', panel).addEventListener('click', function (event) {
      var button = event.target.closest('[data-spread]');
      if (!button) return;
      startSpread(root, button.dataset.spread);
    });
    setTimeout(function () {
      var input = qs('#tarotQuestion', panel);
      if (input) input.focus({ preventScroll: true });
    }, 80);
  }

  function renderSpread(key, spread) {
    var recommended = key === 'single';
    return [
      '<button class="tarot-spread-card' + (recommended ? ' is-recommended' : '') + '" type="button" data-spread="' + esc(key) + '">',
      '  <span>' + esc(spread.name) + '</span>',
      '  <strong>' + spread.positions.length + ' 张牌' + (recommended ? ' · 推荐' : '') + '</strong>',
      '  <em>' + esc(spread.description || '') + '</em>',
      '  <small>' + esc(spread.positions.join(' / ')) + '</small>',
      '</button>'
    ].join('');
  }

  function startSpread(root, spreadKey) {
    var spread = dataCache.spreads[spreadKey];
    var panel = qs('#tarotModalPanel', root);
    var question = panel.dataset.tarotQuestion || (qs('#tarotQuestion', panel) || {}).value || '';
    state = {
      root: root,
      panel: panel,
      spreadKey: spreadKey,
      spread: spread,
      question: question.trim(),
      deck: shuffle(dataCache.cards.map(function (_, i) { return i; })),
      position: cryptoInt(dataCache.cards.length),
      current: 0,
      draws: [],
      pending: null,
      drag: null,
      confirmDrag: null,
      didMove: false
    };
    renderDrawArea();
    renderPartialReading('先抽第一张。');
  }
  function requestTarotIntake(conversation) {
    return fetch(apiBase() + '/api/tarot/intake', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation: conversation })
    }).then(function (res) { if (!res.ok) throw new Error('intake unavailable'); return res.json(); });
  }

  function renderDrawArea() {
    var total = state.spread.positions.length;
    var currentPosition = state.spread.positions[state.current];
    state.panel.classList.add('is-drawing-stage');
    state.panel.innerHTML = [
      '<div class="tarot-modal-copy is-drawing">',
      '  <p class="tarot-progress-line">' + esc(state.spread.name) + ' · ' + (state.current + 1) + '/' + total + ' · ' + esc(currentPosition) + '</p>',
      '  <h2 id="tarotModalTitle">默念心中所想，选中你想抽的牌。</h2>',
      '</div>',
      '<div class="tarot-drawn-stash" id="tarotDrawnStash" aria-live="polite">',
      state.draws.length ? state.draws.map(cardBackToken).join('') : '<p>已抽到的牌会先背面朝上放在这里。</p>',
      '</div>',
      '<div class="tarot-draw-area" id="tarotDrawArea">',
      '  <div class="tarot-slider" id="tarotSlider" role="group" aria-label="滑动塔罗牌组">',
      '    <div class="tarot-spotlight" aria-hidden="true"></div>',
      CARD_SLOTS.map(function () { return '<button class="tarot-orbit-card" type="button" aria-label="未知塔罗牌">' + cardBack() + '</button>'; }).join(''),
      '  </div>',
      '  <div class="tarot-swipe-confirm" id="tarotSwipeConfirm" hidden><span></span>确认了吗？上滑选择</div>',
      '</div>',
      '<div class="tarot-reading-output" id="tarotReadingOutput"></div>'
    ].join('');
    bindSlider(qs('#tarotDrawArea', state.panel));
    updateCards();
  }

  function cardAt(slot) {
    var deckIndex = wrap(Math.round(state.position) + slot, state.deck.length);
    return { deckIndex: deckIndex, cardIndex: state.deck[deckIndex], card: dataCache.cards[state.deck[deckIndex]] };
  }
  function updateCards() {
    var cards = qsa('.tarot-orbit-card', state.panel);
    var width = (qs('#tarotSlider', state.panel) || {}).clientWidth || 640;
    var step = Math.max(72, Math.min(132, width / 6.2));
    var center = Math.round(state.position);
    var drift = state.position - center;
    cards.forEach(function (node, i) {
      var slot = CARD_SLOTS[i];
      var visual = cardAt(slot);
      var offset = slot - drift;
      var abs = Math.abs(offset);
      node.dataset.deckIndex = visual.deckIndex;
      node.dataset.cardIndex = visual.cardIndex;
      node.dataset.slot = slot;
      node.classList.toggle('is-center', slot === 0);
      node.classList.remove('is-pending', 'is-revealed');
      node.innerHTML = cardBack();
      node.style.zIndex = String(80 - Math.round(abs * 10));
      node.style.opacity = String(Math.max(0.2, 1 - abs * 0.13));
      node.style.transform = 'translate3d(' + (offset * step) + 'px,' + (abs * 18) + 'px,0) rotate(' + (offset * 7) + 'deg) scale(' + Math.max(0.72, 1.1 - abs * 0.07) + ')';
    });
  }

  function bindSlider(area) {
    var slider = qs('#tarotSlider', area);
    slider.addEventListener('pointerdown', function (event) {
      if (event.button > 0) return;
      var card = event.target.closest('.tarot-orbit-card');
      if (state.pending && card && card === state.pending.node) {
        state.confirmDrag = { id: event.pointerId, y: event.clientY, lastY: event.clientY, node: card };
        card.setPointerCapture(event.pointerId);
        return;
      }
      state.drag = { id: event.pointerId, x: event.clientX, start: state.position, moved: false, card: card };
      state.didMove = false;
      slider.setPointerCapture(event.pointerId);
      hideConfirm();
    });
    slider.addEventListener('pointermove', function (event) {
      if (state.confirmDrag && state.confirmDrag.id === event.pointerId) {
        var dy = Math.min(0, event.clientY - state.confirmDrag.y);
        state.confirmDrag.lastY = event.clientY;
        state.confirmDrag.node.style.transform += ' translateY(' + Math.max(-88, dy) + 'px)';
        return;
      }
      if (!state.drag || state.drag.id !== event.pointerId) return;
      var dx = event.clientX - state.drag.x;
      if (Math.abs(dx) > 4) state.drag.moved = state.didMove = true;
      var width = slider.clientWidth || 640;
      var step = Math.max(72, Math.min(132, width / 6.2));
      state.position = state.drag.start - dx / step;
      updateCards();
    });
    function finish(event) {
      if (state.confirmDrag && state.confirmDrag.id === event.pointerId) {
        var dy = state.confirmDrag.lastY - state.confirmDrag.y;
        var node = state.confirmDrag.node;
        state.confirmDrag = null;
        if (dy < -56) confirmDraw(node);
        else prepareFloat(node);
        return;
      }
      if (!state.drag || state.drag.id !== event.pointerId) return;
      var wasMove = state.drag.moved;
      var downCard = state.drag.card;
      state.drag = null;
      state.position = Math.round(state.position);
      updateCards();
      if (!wasMove) {
        var target = event.target.closest('.tarot-orbit-card') || downCard;
        if (target) prepareSelection(target);
      }
    }
    slider.addEventListener('pointerup', finish);
    slider.addEventListener('pointercancel', finish);
    slider.addEventListener('click', function (event) {
      if (state.didMove) { state.didMove = false; return; }
      var card = event.target.closest('.tarot-orbit-card');
      if (card) prepareSelection(card);
    });
  }

  function prepareSelection(node) {
    if (state.pending) return;
    if (node.dataset.slot !== '0') {
      moveCardToCenter(node, Number(node.dataset.deckIndex));
      return;
    }
    var cardIndex = Number(node.dataset.cardIndex);
    var deckIndex = Number(node.dataset.deckIndex);
    var card = dataCache.cards[cardIndex];
    state.pending = {
      node: node,
      deckIndex: deckIndex,
      cardIndex: cardIndex,
      position: state.spread.positions[state.current],
      orientation: cryptoInt(2) ? '正位' : '逆位',
      card: card
    };
    prepareFloat(node);
    showConfirm();
  }
  function moveCardToCenter(node, deckIndex) {
    var from = node.getBoundingClientRect();
    state.position = deckIndex;
    updateCards();
    var centerNode = qs('.tarot-orbit-card.is-center', state.panel);
    if (!centerNode) return;
    if (reducedMotion) return prepareSelection(centerNode);
    var to = centerNode.getBoundingClientRect();
    var ghost = node.cloneNode(true);
    ghost.className = 'tarot-orbit-card tarot-card-traveler';
    ghost.style.cssText = 'position:fixed;left:' + from.left + 'px;top:' + from.top + 'px;width:' + from.width + 'px;height:' + from.height + 'px;margin:0;z-index:9999;pointer-events:none;transform:none;opacity:1;';
    document.body.appendChild(ghost);
    ghost.animate([
      { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px', transform: 'rotate(0deg)', opacity: 1 },
      { left: to.left + 'px', top: to.top + 'px', width: to.width + 'px', height: to.height + 'px', transform: 'rotate(0deg)', opacity: 1 }
    ], { duration: 260, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' }).onfinish = function () {
      ghost.remove();
      prepareSelection(centerNode);
    };
  }
  function prepareFloat(node) {
    node.classList.add('is-pending');
    node.style.transform = node.style.transform.replace(/ translateY\([^)]*\)/g, '') + ' translateY(-24px)';
  }
  function showConfirm() {
    var confirm = qs('#tarotSwipeConfirm', state.panel);
    if (confirm) confirm.hidden = false;
  }
  function hideConfirm() {
    var confirm = state && qs('#tarotSwipeConfirm', state.panel);
    if (confirm) confirm.hidden = true;
    if (state) state.pending = null;
  }
  function confirmDraw(node) {
    if (!state.pending) return;
    var draw = state.pending;
    draw.meaning = drawMeaning(draw);
    node.classList.add('is-collected');
    if (!reducedMotion) {
      node.animate([
        { transform: node.style.transform, opacity: 1 },
        { transform: 'translate3d(34vw,-28vh,0) rotate(8deg) scale(0.34)', opacity: 0.08 }
      ], { duration: 420, easing: 'cubic-bezier(.22,.61,.36,1)' });
    }
    state.draws.push({ position: draw.position, orientation: draw.orientation, meaning: draw.meaning, card: draw.card });
    state.deck.splice(draw.deckIndex, 1);
    state.pending = null;
    qs('#tarotSwipeConfirm', state.panel).hidden = true;
    renderPartialReading('已收下 ' + draw.position + '。先不翻，等全部抽完一起看。');
    setTimeout(function () {
      state.current += 1;
      if (state.current >= state.spread.positions.length) finishReading();
      else {
        state.position = cryptoInt(state.deck.length);
        renderDrawArea();
      }
    }, reducedMotion ? 80 : 560);
  }

  function readable(draw) { return draw.position + '是' + draw.orientation + draw.card.name; }
  function softenOrientation(draw) {
    return draw.orientation === '逆位' ? '这张牌是逆位，所以它不像在催你往前冲，更像是在说：这里有点卡住，需要先顺一下。' : '这张牌是正位，感觉没有那么拧巴，至少有一部分事情是可以接住的。';
  }
  function topKeywords(draws) {
    var map = {};
    draws.forEach(function (d) {
      (d.card.keywords || []).forEach(function (k) { map[k] = (map[k] || 0) + 1; });
    });
    return Object.keys(map).sort(function (a, b) { return map[b] - map[a]; }).slice(0, 3);
  }
  function textScore(value) {
    return String(value || '').split('').reduce(function (sum, char) { return sum + char.charCodeAt(0); }, 0);
  }
  function chooseLine(lines, seed) {
    return lines[textScore(seed) % lines.length];
  }
  function questionSignals(question) {
    var q = question || '';
    var emotions = [];
    var needs = [];
    if (/焦虑|害怕|担心|慌|怕|不安/.test(q)) emotions.push('不安');
    if (/难过|伤心|哭|委屈|低落|失落/.test(q)) emotions.push('难过');
    if (/生气|气|烦|恶心|受不了|离谱/.test(q)) emotions.push('生气');
    if (/迷茫|不知道|看不懂|纠结|混乱|不确定/.test(q)) emotions.push('迷茫');
    if (/孤独|没人|一个人|被忽略|不被理解/.test(q)) emotions.push('孤单');
    if (/累|疲|耗|撑不住|没劲|失眠/.test(q)) emotions.push('疲惫');
    if (/是不是我|我是不是|正常吗|想多了吗|太敏感|有没有问题/.test(q)) needs.push('被确认');
    if (/怎么办|不知道|看不清|到底|为什么|怎么想/.test(q)) needs.push('一个更清楚的说法');
    if (/不回|敷衍|忽略|越界|冷暴力|不尊重|利用/.test(q)) needs.push('边界感');
    if (/能不能|该不该|要不要|敢不敢|可不可以/.test(q)) needs.push('一点允许');
    if (/休息|停下|放空|请假|睡|缓一缓/.test(q)) needs.push('喘口气');
    return { emotions: emotions, needs: needs };
  }
  function questionKind(question) {
    var q = question || '';
    if (/累|疲|烦|崩|低落|撑|耗/.test(q)) return 'tired';
    if (/感情|喜欢|分手|关系|爱|他|她/.test(q)) return 'relationship';
    if (/工作|事业|考|学|未来|选择|方向/.test(q)) return 'choice';
    if (/自卑|敏感|不够好|失败|没用|配不上|讨厌自己/.test(q)) return 'self_worth';
    if (/想念|失去|遗憾|舍不得|离开|空/.test(q)) return 'loss';
    return 'general';
  }
  function moodLine(question, seed) {
    var kind = questionKind(question);
    var lines = {
      tired: [
        '你说累的时候，我会先怀疑不是事情单独有多难，是它们一个接一个地来，连喘口气都得排队。',
        '这个状态先别急着叫它“不够努力”。听起来更像是电一直在漏，充一会儿又掉下去。'
      ],
      relationship: [
        '关系一旦让人反复确认自己是不是想多了，事情多半已经不只是“性格不同”了。',
        '我先不急着站谁那边。你在意的可能不只是这件事，是这件事之后自己被放在了什么位置。'
      ],
      choice: [
        '我不太想直接替你看“以后会不会更好”，先看你现在这个地方到底是在消耗，还是只是很难。',
        '选择这事最烦的地方，是两个选项往往都像有点道理，所以人才会卡住。'
      ],
      self_worth: [
        '你问自己是不是不够好的时候，我会先把这个问题往回推一下：到底是谁让你开始用这种标准看自己？',
        '这件事里最麻烦的，可能不是你做得够不够好，是你已经很习惯先把错往自己身上收。'
      ],
      loss: [
        '舍不得不一定说明该回头，有时候只是这段东西在你这里确实占过很大的位置。',
        '你现在难受的也许不只是失去一个人，是原来以为会有的那种以后突然没了。'
      ],
      general: [
        '这个事乍一听有点乱，但乱也有乱的结构，先别急着把它归成一句“我就是不行”。',
        '我先不替你把这团东西命名。名字起得太快，真正别扭的地方反而容易被盖过去。'
      ]
    };
    return chooseLine(lines[kind], seed);
  }
  function actionLine(draw, seed) {
    var words = (draw.card.keywords || []).join('');
    var lines;
    if (/边界|责任|规则|掌控|判断/.test(words)) lines = ['先把你能接受到哪里想清楚，别每次都等事情越线了才回头算账。', '这一步不一定要翻脸，先把“我不想再这样了”这句话在心里说完整。'];
    else if (/情感|关系|共情|失落|滋润|回忆/.test(words)) lines = ['先承认你就是在意，不用急着把自己说得特别洒脱。', '别急着判断谁更有道理，先看你在这段关系里是不是总要自己补台。'];
    else if (/行动|启动|推进|冲刺|火花/.test(words)) lines = ['先做一个能落地的小动作，别一上来就给自己安排一场人生发布会。', '这件事不用靠一口气解决，先让它真的动一下就够了。'];
    else if (/焦虑|内耗|选择|真相|清晰/.test(words)) lines = ['先把脑内小剧场和已经发生的事分开写，很多焦虑一落字就没那么能打了。', '先别急着解释所有人的动机，眼下把事实捋顺比猜心思有用。'];
    else lines = ['先把最卡你的那一小块拎出来，不用把整个人生一起搬上桌。', '先看清这一轮到底在重复什么，剩下的不用今天全解决。'];
    return chooseLine(lines, seed + words);
  }
  function reflectionLine(kind, seed) {
    var lines = {
      tired: ['你现在最想停下来的，到底是哪一件事？', '如果不用证明自己很能扛，你会先放掉哪一部分？'],
      relationship: ['你最难受的，是对方做了什么，还是自己总在替这段关系找理由？', '你想要的是一个解释，还是一个能让你安心的行为？'],
      choice: ['你现在怕选错，还是怕选了以后要承担那个后果？', '两个选项里，哪一个更像你真心想要，只是你还没敢承认？'],
      self_worth: ['这件事里，哪一个评价其实是别人给你的，你却一直当成了自己的结论？', '如果不拿“够不够好”来衡量，你会怎么描述现在的自己？'],
      loss: ['你舍不得的到底是这个人，还是那段关系里你以为自己会拥有的以后？', '如果不急着让自己释怀，今天你最想承认的遗憾是什么？'],
      general: ['这件事里，你最不想承认的那一小块是什么？', '如果不急着给结论，你觉得哪里最值得再看一眼？']
    };
    return chooseLine(lines[kind], seed);
  }
  function buildReading() {
    var draws = state.draws;
    var first = draws[0];
    var last = draws[draws.length - 1];
    var reversed = draws.filter(function (d) { return d.orientation === '逆位'; });
    var keys = topKeywords(draws);
    var hinge = reversed[0] || last;
    var seed = (state.question || '') + draws.map(function (d) { return d.card.name + d.orientation; }).join('');
    var kind = questionKind(state.question);
    var signals = questionSignals(state.question);
    var reply = [];
    reply.push(moodLine(state.question, seed));
    if (signals.emotions.length || signals.needs.length) {
      reply.push('你这次说得很明显：里面有' + (signals.emotions.join('、') || '一些情绪') + '，也在想要' + (signals.needs.join('、') || '一个更清楚的方向') + '。这个部分我不想跳过去。');
    }
    reply.push(chooseLine([
      first.position + '落在' + first.card.name + '，我会先看它和你这次的问题哪里互相别扭。' + softenOrientation(first),
      first.card.name + '出现在' + first.position + '，感觉像是先把一个你绕开的角落照亮了。' + softenOrientation(first)
    ], seed + first.card.name));
    if (draws.length > 1) {
      reply.push('这组牌不是排队告诉你“该怎么做”。' + draws.map(function (d) {
        return d.position + '更像在说“' + (d.card.keywords || []).slice(0, 2).join('、') + '”';
      }).join('；') + '。放在一起看，事情里既有感受，也有现实，还有一部分是你一直没空细看的。');
      reply.push(reversed.length > draws.length / 2
        ? '逆位偏多，不是坏消息，比较像是这些地方暂时没法靠硬撑过去。先把别扭说出来，比急着做决定靠谱。'
        : '正位多一点，说明这事不是完全没抓手。只是你可能还没找到最顺手的处理方式。');
    } else {
      reply.push('这张牌给我的提醒是：' + first.meaning + '。先把它当成一个观察角度，不用当成判决书。');
    }
    reply.push(actionLine(hinge, seed));
    return {
      reply: reply.join('\n\n'),
      plainSummary: chooseLine([
        '先别急着把它升级成人生大题，看看“' + ((keys[0]) || last.card.keywords[0] || last.card.name) + '”这块是不是一直没人认真碰。',
        '这轮牌更像是在提醒你：先把最别扭的地方说清楚，答案不用今天一次性长出来。'
      ], seed),
      reflectionQuestion: reflectionLine(kind, seed)
    };
  }

  function renderPartialReading(status) {
    var out = qs('#tarotReadingOutput', state.panel);
    if (!out) return;
    out.hidden = false;
    out.innerHTML = [
      '<p class="tarot-output-status">' + esc(status) + '</p>'
    ].join('');
  }
  function renderDrawCard(draw) {
    return [
      '<article class="tarot-draw-card">',
      '  <img src="' + esc(draw.card.image) + '" alt="' + esc(draw.card.name) + '">',
      '  <div><span>' + esc(draw.position) + ' · ' + esc(draw.orientation) + '</span><strong>' + esc(draw.card.name) + '</strong><p>' + esc((draw.card.keywords || []).join(' / ')) + '</p></div>',
      '</article>'
    ].join('');
  }
  function requestAIReading(fallback) {
    var payload = {
      question: state.question,
      spread: state.spreadKey,
      spreadName: state.spread.name,
      cards: state.draws.map(function (draw) {
        return {
          position: draw.position,
          name: draw.card.name,
          orientation: draw.orientation,
          keywords: draw.card.keywords || [],
          meaning: draw.meaning
        };
      }),
      conversation: state.question ? [{ role: 'user', content: state.question }] : []
    };
    return fetch(apiBase() + '/api/tarot/reading', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('tarot api unavailable');
      return res.json();
    }).then(function (json) {
      return {
        reply: json.reply || fallback.reply,
        plainSummary: json.plainSummary || fallback.plainSummary,
        reflectionQuestion: json.reflectionQuestion || fallback.reflectionQuestion
      };
    }).catch(function () {
      return fallback;
    });
  }
  function chatCardPayload() {
    return state.draws.map(function (draw) {
      return { position: draw.position, name: draw.card.name, orientation: draw.orientation, keywords: draw.card.keywords || [], meaning: draw.meaning };
    });
  }
  function requestTarotChat(text) {
    var conversation = (state.chatMessages || []).map(function (item) { return { role: item.role, content: item.text }; });
    return fetch(apiBase() + '/api/tarot/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text, cards: chatCardPayload(), conversation: conversation })
    }).then(function (res) { if (!res.ok) throw new Error('chat unavailable'); return res.json(); })
      .then(function (json) { return Array.isArray(json.messages) ? json.messages : []; });
  }
  function initialChat(reading) {
    var reply = (reading.ai && reading.ai.reply) || '';
    var messages = reading.question ? [{ role: 'user', text: reading.question }] : [];
    return messages.concat(reply.split(/\n\s*\n/).filter(Boolean).map(function (text) { return { role: 'assistant', text: text }; }));
  }
  function renderChatMessages(messages) {
    return (messages || []).map(function (message) {
      return '<p class="tarot-chat-message ' + (message.role === 'user' ? 'is-user' : 'is-latte') + '">' + esc(message.text) + '</p>';
    }).join('');
  }
  function bindChat(panel, reading) {
    if (!state || !qs('#tarotChatForm', panel)) return;
    state.chatMessages = state.chatMessages || initialChat(reading);
    var form = qs('#tarotChatForm', panel);
    var input = qs('#tarotChatInput', panel);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var text = (input.value || '').trim();
      if (!text) return;
      state.chatMessages.push({ role: 'user', text: text });
      input.value = '';
      qs('#tarotChatStream', panel).innerHTML = renderChatMessages(state.chatMessages);
      input.disabled = true;
      requestTarotChat(text).then(function (messages) {
        messages.forEach(function (message) { state.chatMessages.push({ role: 'assistant', text: message.text }); });
        qs('#tarotChatStream', panel).innerHTML = renderChatMessages(state.chatMessages);
      }).catch(function () {
        state.chatMessages.push({ role: 'assistant', text: '刚才这句我没接稳。你可以换个说法，或者先放在这里。' });
        qs('#tarotChatStream', panel).innerHTML = renderChatMessages(state.chatMessages);
      }).finally(function () { input.disabled = false; input.focus(); });
    });
  }
  function finishReading() {
    var fallback = buildReading();
    var reading = {
      date: shanghaiDate(),
      spreadKey: state.spreadKey,
      spreadName: state.spread.name,
      question: state.question,
      draws: state.draws,
      ai: fallback
    };
    state.chatMessages = initialChat(reading);
    saveReading(reading);
    state.panel.innerHTML = renderLocked(reading);
    bindChat(state.panel, reading);
    renderGateway(state.root);
    openModal(state.root);
    requestAIReading(fallback).then(function (ai) {
      reading.ai = ai;
      saveReading(reading);
      var panel = qs('#tarotModalPanel', state.root);
      if (panel) { panel.innerHTML = renderLocked(reading); bindChat(panel, reading); }
    });
  }
  function renderLocked(reading) {
    var activePanel = qs('#tarotModalPanel');
    if (activePanel) activePanel.classList.remove('is-drawing-stage');
    return [
      '<div class="tarot-modal-copy">',
      '  <p class="motion-label">LATTE TAROT</p>',
      '  <h2 id="tarotModalTitle">今日塔罗已完成。</h2>',
      '  <p>' + esc(reading.date) + ' · ' + esc(reading.spreadName) + '。今天就这一轮，不能重抽。</p>',
      '</div>',
      reading.question ? '<p class="tarot-question-echo">你给的方向：' + esc(reading.question) + '</p>' : '',
      '<div class="tarot-mini-results">' + (reading.draws || []).map(renderDrawCard).join('') + '</div>',
      '<article class="tarot-chat"><h3>LATTE这样看</h3><div class="tarot-chat-stream" id="tarotChatStream">' + renderChatMessages(state && state.chatMessages ? state.chatMessages : initialChat(reading)) + '</div>' + (state ? '<form class="tarot-chat-form" id="tarotChatForm"><label for="tarotChatInput">不用讲完整。想到哪儿说到哪儿。</label><div><textarea id="tarotChatInput" rows="2" maxlength="300" placeholder="想继续就说一句。"></textarea><button type="submit">送出</button></div><small>这次聊天不会保存在本站。刷新或关闭页面后，内容就会消失。</small></form>' : '') + '</article>'
    ].join('');
  }

  function init() {
    var root = qs('[data-tarot-root]');
    if (!root) return;
    loadData().then(function (data) {
      if (!data.cards || data.cards.length !== 78) throw new Error('牌库数量不是 78');
      renderGateway(root);
      document.addEventListener('keydown', function (event) {
        var modal = qs('#tarotModal', root);
        if (event.key === 'Escape' && modal && modal.classList.contains('is-open')) closeModal(root);
      });
    }).catch(function () {
      root.innerHTML = '<div class="tarot-panel-head"><p class="motion-label">LATTE TAROT</p><h2 id="latteTarotTitle">LATTE在线塔罗</h2><p>牌库暂时没醒，刷新一下再试。</p></div>';
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

(function () {
  var STORAGE_KEY = 'latte:digital-answer-book:v3';
  var THURSDAY_READING_URL = 'https://www.52k.cn/';
  var TEASE_DELAY = 850;
  var TEASE_DURATION = 6800;
  var PICK_DURATION = 3600;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var answers = [
    '很多答案，不是在等待中出现，而是在行动中形成。',
    '先把问题变小，答案才会靠近。',
    '你不需要立刻确定方向，只需要确认下一步是真的。',
    '犹豫有时不是退缩，而是在提醒你重新看见代价。',
    '把注意力放回你能改变的地方，事情会开始松动。',
    '真正重要的事，通常不需要用很大的声音证明。',
    '如果一个选择让你更诚实，它就值得被认真看见。',
    '不要急着给混乱命名，先给它一点空间。',
    '答案可能不是结论，而是一种更清醒的姿态。',
    '先完成一个微小版本，再判断它是否值得继续。',
    '你已经知道一部分答案，只是还没有允许自己承认。',
    '慢一点不是停下，是让判断重新回到你自己身上。',
    '不要把未来想得太满，给变化留一个入口。',
    '当你不知道如何选择时，先选择更能保护长期能量的那一个。',
    '把问题写下来，它会从情绪里浮出轮廓。',
    '今天适合少解释一点，多观察一点。',
    '真正的确定感，常常来自一次诚实的试探。',
    '如果答案还没有出现，先照顾那个一直追问答案的人。'
  ];

  var paperWords = [
    '行动', '等待', '回望', '专注',
    '靠近', '松开', '转向', '留白',
    '倾听', '试探', '边界', '火种',
    '选择', '慢行', '清醒', '成形',
    '沉默', '入口', '余温', '确认'
  ];

  var stageState = null;

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function randomInt(max) {
    if (!max || max <= 0) return 0;
    if (window.crypto && window.crypto.getRandomValues) {
      var values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function isThursday() {
    return new Date().getDay() === 4;
  }

  function createWidget() {
    var widget = document.createElement('aside');
    widget.className = 'answer-book-widget';
    widget.setAttribute('aria-label', '数字答案之书');
    widget.innerHTML = [
      '<button class="answer-book-entry" id="answerBookOpen" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="answerBookModal" aria-label="打开数字答案之书">',
      '  <span class="answer-book-mark" aria-hidden="true"></span>',
      '</button>',
      '<div class="answer-book-tip" id="answerBookTip" role="status"><strong>答案之书</strong><span>来都来了，不问一嘴吗。</span></div>',
      '<section class="answer-book-modal" id="answerBookModal" role="dialog" aria-modal="true" aria-labelledby="answerBookTitle" hidden>',
      '  <div class="answer-book-backdrop" data-answer-close></div>',
      '  <div class="answer-book-stage" id="answerBookStage" role="document" tabindex="-1">',
      '    <button class="answer-book-close" type="button" aria-label="关闭数字答案之书" data-answer-close>×</button>',
      '    <div class="answer-book-ritual-copy">',
      '      <p class="answer-book-kicker">DIGITAL ANSWER BOOK</p>',
      '      <h2 class="answer-book-title" id="answerBookTitle">默念你的问题</h2>',
      '      <p class="answer-book-subtitle">书页会从这里醒来。持续上下滑动，让其中一页靠近你。</p>',
      '    </div>',
      '    <div class="answer-book-papers answer-book-papers-back" id="answerBookPapersBack" aria-hidden="true"></div>',
      '    <div class="answer-book-source-book" id="answerBookSourceBook" aria-hidden="true">',
      '      <span class="answer-book-source-pages answer-book-source-pages-right"></span>',
      '      <span class="answer-book-source-pages answer-book-source-pages-bottom"></span>',
      '      <span class="answer-book-source-spine"></span>',
      '      <span class="answer-book-source-cover"></span>',
      '      <span class="answer-book-source-symbol"></span>',
      '      <span class="answer-book-source-title">ANSWER<br>BOOK</span>',
      '    </div>',
      '    <div class="answer-book-papers answer-book-papers-front" id="answerBookPapersFront" aria-hidden="true"></div>',
      '    <div class="answer-book-charge" id="answerBookCharge" aria-hidden="true">',
      '      <span class="answer-book-charge-bar"><i></i></span>',
      '      <span class="answer-book-charge-text">继续滑动，让纸片靠近</span>',
      '    </div>',
      '    <div class="answer-book-answer-card" id="answerBookAnswerCard" aria-live="polite">',
      '      <p class="answer-book-label">ANSWER</p>',
      '      <p class="answer-book-answer" id="answerBookAnswer"></p>',
      '      <div class="answer-book-actions">',
      '        <button class="answer-book-action" id="answerBookAgain" type="button">重新提问</button>',
      '        <button class="answer-book-action" id="answerBookSave" type="button">保存答案</button>',
      '        <button class="answer-book-action" id="answerBookShare" type="button">分享答案</button>',
      '        <a class="answer-book-action answer-book-full-reading" id="answerBookFullReading" href="' + THURSDAY_READING_URL + '" target="_blank" rel="noopener noreferrer" hidden>查看完整详细解读</a>',
      '        <span class="answer-book-toast" id="answerBookToast" aria-live="polite"></span>',
      '      </div>',
      '    </div>',
      '    <div class="answer-book-hint" id="answerBookHint">',
      '      <span class="answer-book-arrows" aria-hidden="true"></span>',
      '      <p class="answer-book-hint-text"><span class="answer-book-hint-kicker">默念问题</span> 持续上下滑动，抽取一张纸片</p>',
      '    </div>',
      '  </div>',
      '</section>'
    ].join('');
    document.body.appendChild(widget);
    renderPapers(widget);
    return widget;
  }

  function renderPapers(widget) {
    var wrap = qs('#answerBookPapersFront', widget);
    wrap.innerHTML = paperWords.map(function (word, index) {
      return [
        '<article class="answer-book-paper" data-paper-index="' + index + '">',
        '  <span class="answer-paper-code">PAGE ' + String(index + 1).padStart(2, '0') + '</span>',
        '  <span class="answer-paper-word">' + escapeHTML(word) + '</span>',
        '</article>'
      ].join('');
    }).join('');
  }

  function tease(widget) {
    widget.classList.add('is-teasing');
    window.setTimeout(function () {
      widget.classList.remove('is-teasing');
    }, TEASE_DURATION);
  }

  function animateEntrance(widget) {
    var book = qs('#answerBookOpen', widget);
    window.setTimeout(function () { tease(widget); }, TEASE_DELAY);
    if (!window.gsap || prefersReducedMotion) return;
    window.gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo(book, { autoAlpha: 0, y: 14, rotationY: -32, rotationZ: -3, scale: 0.94 }, { autoAlpha: 1, y: 0, rotationY: 0, rotationZ: 0, scale: 1, duration: 0.52, delay: 0.24 })
      .to(book, { rotationY: -10, y: -2, duration: 0.16, yoyo: true, repeat: 1 }, '>-0.02');
  }

  function waitForHomeSettle(widget) {
    if (!document.body.classList.contains('loader-active')) return;
    widget.classList.add('awaiting-home-settle');
    window.addEventListener('latte:home-settled', function () {
      requestAnimationFrame(function () {
        widget.classList.remove('awaiting-home-settle');
        widget.classList.add('is-home-revealed');
      });
    }, { once: true });
  }

  function paperFinalVars(index, count) {
    var width = window.innerWidth;
    var height = window.innerHeight;
    var isMobile = width < 640;
    var turns = isMobile ? 1.7 : 1.9;
    var angle = (index / count) * Math.PI * 2 * turns + (index % 3) * 0.22;
    var radiusX = width * (isMobile ? 0.38 : 0.34);
    var radiusZ = width * (isMobile ? 0.38 : 0.3);
    var spiralStep = height * (isMobile ? 0.05 : 0.056);
    var centerOffset = (count - 1) / 2;
    var y = (index - centerOffset) * spiralStep + Math.sin(angle * 1.35) * 30;
    var x = Math.cos(angle) * radiusX;
    var z = Math.sin(angle) * radiusZ;
    var angleDeg = angle * 180 / Math.PI;
    var scale = isMobile ? 0.78 : 0.88 + ((index % 5) * 0.03);
    return {
      x: x,
      y: y,
      z: z,
      rotation: -8 + Math.sin(angle) * 14,
      rotationX: -12 + Math.cos(angle * 1.2) * 18,
      rotationY: angleDeg + 90,
      autoAlpha: 0.5 + ((index % 5) * 0.075),
      scale: scale,
      orbitAngle: angleDeg,
      orbitRadiusX: radiusX,
      orbitRadiusZ: radiusZ,
      orbitY: y,
      orbitScale: scale,
      orbitTilt: -12 + Math.cos(angle * 1.2) * 18,
      orbitRoll: -8 + Math.sin(angle) * 14
    };
  }

  function paperOrbitVars(base, orbit, progress) {
    var angleDeg = base.orbitAngle + orbit;
    var angle = angleDeg * Math.PI / 180;
    var depth = (Math.sin(angle) + 1) / 2;
    var radiusBoost = 1 + progress * 0.12;
    return {
      x: Math.cos(angle) * base.orbitRadiusX * radiusBoost,
      y: base.orbitY + Math.sin(angle * 1.7) * (18 + progress * 22),
      z: Math.sin(angle) * base.orbitRadiusZ * radiusBoost + progress * 120,
      rotation: base.orbitRoll + Math.cos(angle) * 12,
      rotationX: base.orbitTilt + Math.sin(angle * 1.15) * (14 + progress * 10),
      rotationY: angleDeg + 90,
      autoAlpha: 0.44 + depth * 0.45,
      scale: base.orbitScale * (0.86 + depth * 0.2 + progress * 0.06),
      depth: depth
    };
  }

  function setPaperLayout(widget, instant) {
    var papers = qsa('.answer-book-paper', widget);
    papers.forEach(function (paper, index) {
      var vars = paperFinalVars(index, papers.length);
      paper._answerBookFinal = vars;
      if (window.gsap && !prefersReducedMotion) {
        window.gsap.to(paper, Object.assign({ duration: instant ? 0 : 0.82, ease: 'power3.out', overwrite: 'auto', transformOrigin: '50% 50%' }, paperOrbitVars(vars, stageState ? stageState.orbit : 0, 0)));
      } else {
        var orbitVars = paperOrbitVars(vars, stageState ? stageState.orbit : 0, 0);
        paper.style.opacity = orbitVars.autoAlpha;
        paper.style.transform = 'translate(-50%, -50%) translate3d(' + orbitVars.x + 'px,' + orbitVars.y + 'px,' + orbitVars.z + 'px) rotateX(' + orbitVars.rotationX + 'deg) rotateY(' + orbitVars.rotationY + 'deg) rotate(' + orbitVars.rotation + 'deg) scale(' + orbitVars.scale + ')';
      }
    });
  }

  function stopPaperOrbit() {
    if (stageState && stageState.orbitTween) {
      stageState.orbitTween.kill();
      stageState.orbitTween = null;
    }
    if (stageState && stageState.inertiaTween) {
      stageState.inertiaTween.kill();
      stageState.inertiaTween = null;
    }
    if (stageState && stageState.inertiaDelay) {
      stageState.inertiaDelay.kill();
      stageState.inertiaDelay = null;
    }
  }

  function renderPaperOrbit(widget, progress) {
    if (!window.gsap || prefersReducedMotion || !stageState) return;
    var frontLayer = qs('#answerBookPapersFront', widget);
    var backLayer = qs('#answerBookPapersBack', widget);
    qsa('.answer-book-paper', widget).forEach(function (paper, index) {
      var base = paper._answerBookFinal || paperFinalVars(index, paperWords.length);
      var vars = paperOrbitVars(base, stageState.orbit, progress || 0);
      var shouldBeFront = vars.depth >= 0.5 || paper.classList.contains('is-picked');
      var targetLayer = shouldBeFront ? frontLayer : backLayer;
      if (targetLayer && paper.parentNode !== targetLayer) targetLayer.appendChild(paper);
      paper.style.zIndex = String(10 + Math.round(vars.depth * 40));
      window.gsap.set(paper, Object.assign({ transformOrigin: '50% 50%' }, vars));
    });
  }

  function floatPapers(widget) {
    renderPaperOrbit(widget, stageState ? stageState.chargeElapsed / PICK_DURATION * 0.2 : 0);
  }

  function scatterFromBook(widget) {
    var papers = qsa('.answer-book-paper', widget);
    var tl = window.gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo('#answerBookSourceBook', {
      autoAlpha: 0,
      y: 36,
      rotationX: 56,
      scale: 0.86
    }, {
      autoAlpha: 1,
      y: 0,
      rotationX: 48,
      scale: 1,
      duration: 0.56
    }, 0);
    tl.fromTo('.answer-book-ritual-copy', { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.54 }, 0.08);
    tl.fromTo(papers, {
      x: function (i) { return (i % 2 ? 20 : -20); },
      y: window.innerHeight * 0.12,
      z: -360,
      rotationX: function (i) { return 130 + (i % 3) * 30; },
      rotationY: function (i) { return -120 + (i % 5) * 60; },
      rotation: function (i) { return -80 + (i % 7) * 28; },
      autoAlpha: 0,
      scale: 0.36,
      transformOrigin: '50% 50%'
    }, {
      x: function (i, target) { return paperOrbitVars(target._answerBookFinal, 0, 0).x; },
      y: function (i, target) { return paperOrbitVars(target._answerBookFinal, 0, 0).y; },
      z: function (i, target) { return paperOrbitVars(target._answerBookFinal, 0, 0).z; },
      rotationX: function (i, target) { return paperOrbitVars(target._answerBookFinal, 0, 0).rotationX; },
      rotationY: function (i, target) { return paperOrbitVars(target._answerBookFinal, 0, 0).rotationY; },
      rotation: function (i, target) { return paperOrbitVars(target._answerBookFinal, 0, 0).rotation; },
      autoAlpha: function (i, target) { return paperOrbitVars(target._answerBookFinal, 0, 0).autoAlpha; },
      scale: function (i, target) { return paperOrbitVars(target._answerBookFinal, 0, 0).scale; },
      duration: 1.65,
      ease: 'expo.out',
      stagger: { amount: 0.72, from: 'random' },
      onComplete: function () { renderPaperOrbit(widget, 0); }
    }, 0.24);
    tl.fromTo('#answerBookHint', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.48 }, 1.08);
  }

  function openStage(widget) {
    var modal = qs('#answerBookModal', widget);
    var button = qs('#answerBookOpen', widget);
    widget.classList.remove('is-teasing');
    modal.hidden = false;
    document.body.classList.add('answer-book-modal-open');
    button.setAttribute('aria-expanded', 'true');

    requestAnimationFrame(function () {
      modal.classList.add('is-open');
      qs('#answerBookStage', widget).focus({ preventScroll: true });
      resetStage(widget, true);
      setPaperLayout(widget, true);
      if (window.gsap && !prefersReducedMotion) scatterFromBook(widget);
    });
  }

  function closeStage(widget) {
    var modal = qs('#answerBookModal', widget);
    var button = qs('#answerBookOpen', widget);
    modal.classList.remove('is-open');
    document.body.classList.remove('answer-book-modal-open');
    button.setAttribute('aria-expanded', 'false');
    stopPaperOrbit();
    if (window.gsap) window.gsap.killTweensOf(qsa('.answer-book-paper', widget));
    setTimeout(function () {
      if (!modal.classList.contains('is-open')) modal.hidden = true;
    }, 280);
    button.focus();
  }

  function setOpen(widget, open) {
    if (open) openStage(widget);
    else closeStage(widget);
  }

  function resetStage(widget, keepPapers) {
    stopPaperOrbit();
    stageState = {
      isPicked: false,
      lastPick: -1,
      touchStartY: 0,
      chargeElapsed: 0,
      lastGestureAt: 0,
      isPreparing: false,
      swirl: 0,
      orbit: 0,
      orbitTween: null,
      orbitVelocity: 0,
      inertiaTween: null,
      inertiaDelay: null
    };
    qs('#answerBookAnswerCard', widget).classList.remove('is-visible');
    qs('#answerBookAnswer', widget).textContent = '';
    qs('#answerBookToast', widget).textContent = '';
    qs('#answerBookHint', widget).hidden = false;
    qs('#answerBookFullReading', widget).hidden = true;
    updateCharge(widget, 0);
    var frontLayer = qs('#answerBookPapersFront', widget);
    qsa('.answer-book-paper', widget).forEach(function (paper) {
      paper.classList.remove('is-picked');
      paper.style.zIndex = '';
      if (frontLayer && paper.parentNode !== frontLayer) frontLayer.appendChild(paper);
    });
    if (!keepPapers) {
      setPaperLayout(widget, false);
      if (window.gsap && !prefersReducedMotion) renderPaperOrbit(widget, 0);
    }
  }

  function updateCharge(widget, elapsed) {
    var charge = qs('#answerBookCharge', widget);
    var fill = qs('.answer-book-charge-bar i', widget);
    if (!charge || !fill) return;
    var progress = Math.max(0, Math.min(1, elapsed / PICK_DURATION));
    charge.classList.toggle('is-active', progress > 0 && progress < 1);
    charge.classList.toggle('is-ready', progress >= 1);
    fill.style.transform = 'scaleX(' + progress + ')';
    var text = qs('.answer-book-charge-text', widget);
    if (!text) return;
    if (progress < 0.34) text.textContent = '继续滑动，让纸片靠近';
    else if (progress < 0.7) text.textContent = '纸页正在旋转，再保持一下';
    else text.textContent = '快到了，答案正在成形';
  }

  function stirPapers(widget, amount, progress) {
    if (!window.gsap || prefersReducedMotion) return;
    var direction = amount >= 0 ? 1 : -1;
    var orbitDelta = direction * Math.min(42, Math.abs(amount) * 0.22);
    if (stageState.inertiaTween) {
      stageState.inertiaTween.kill();
      stageState.inertiaTween = null;
    }
    if (stageState.inertiaDelay) {
      stageState.inertiaDelay.kill();
      stageState.inertiaDelay = null;
    }
    stageState.orbit += orbitDelta;
    stageState.orbitVelocity = orbitDelta;
    renderPaperOrbit(widget, progress);
    schedulePaperInertia(widget, progress);
    window.gsap.to('#answerBookSourceBook', {
      scale: 1 + progress * 0.07,
      rotationZ: -2 + progress * 2,
      duration: 0.24,
      ease: 'power2.out',
      overwrite: 'auto'
    });
  }

  function schedulePaperInertia(widget, progress) {
    if (!window.gsap || prefersReducedMotion || !stageState) return;
    var velocity = stageState.orbitVelocity || 0;
    if (Math.abs(velocity) < 2) return;
    stageState.inertiaDelay = window.gsap.delayedCall(0.08, function () {
      if (!stageState || stageState.isPicked || stageState.isPreparing) return;
      var carry = Math.max(-110, Math.min(110, velocity * 2.2));
      stageState.inertiaTween = window.gsap.to(stageState, {
        orbit: stageState.orbit + carry,
        duration: 0.82,
        ease: 'power3.out',
        onUpdate: function () {
          renderPaperOrbit(widget, progress);
        },
        onComplete: function () {
          if (stageState) stageState.inertiaTween = null;
        }
      });
      stageState.inertiaDelay = null;
    });
  }

  function chargeGesture(widget, amount) {
    if (!stageState || stageState.isPicked || stageState.isPreparing) return;
    var now = performance.now();
    if (!stageState.lastGestureAt || now - stageState.lastGestureAt > 850) {
      stageState.chargeElapsed = Math.max(0, stageState.chargeElapsed - 450);
    } else {
      stageState.chargeElapsed += Math.min(360, now - stageState.lastGestureAt);
    }
    stageState.lastGestureAt = now;

    if (Math.abs(amount) > 0) {
      stageState.chargeElapsed += Math.min(80, Math.abs(amount) * 0.1);
    }

    var progress = Math.max(0, Math.min(1, stageState.chargeElapsed / PICK_DURATION));
    updateCharge(widget, stageState.chargeElapsed);
    stirPapers(widget, amount, progress);

    if (stageState.chargeElapsed >= PICK_DURATION) preparePick(widget);
  }

  function preparePick(widget) {
    if (!stageState || stageState.isPicked || stageState.isPreparing) return;
    stageState.isPreparing = true;
    qs('#answerBookHint', widget).hidden = true;
    var text = qs('.answer-book-charge-text', widget);
    if (text) text.textContent = '纸片正在选择你';

    if (window.gsap && !prefersReducedMotion) {
      window.gsap.timeline({ onComplete: function () { pickPaper(widget); } })
        .to(qsa('.answer-book-paper', widget), {
          autoAlpha: 0.96,
          scale: '+=0.1',
          z: '+=90',
          rotationY: '+=90',
          duration: 0.38,
          ease: 'power2.out',
          stagger: { amount: 0.2, from: 'center' }
        })
        .to(qsa('.answer-book-paper', widget), {
          scale: '-=0.05',
          z: '-=44',
          rotationX: '+=35',
          duration: 0.34,
          ease: 'power2.inOut',
          stagger: { amount: 0.14, from: 'random' }
        });
      return;
    }

    window.setTimeout(function () { pickPaper(widget); }, 620);
  }

  function choosePaperIndex(widget) {
    var papers = qsa('.answer-book-paper', widget);
    var next = randomInt(papers.length);
    if (papers.length > 1 && stageState && next === stageState.lastPick) {
      next = (next + 1 + randomInt(papers.length - 1)) % papers.length;
    }
    if (stageState) stageState.lastPick = next;
    return next;
  }

  function pickPaper(widget) {
    if (!stageState || stageState.isPicked) return;
    stageState.isPicked = true;
    stopPaperOrbit();

    var papers = qsa('.answer-book-paper', widget);
    var pickedIndex = choosePaperIndex(widget);
    var picked = papers[pickedIndex];
    var answer = answers[randomInt(answers.length)];

    qs('#answerBookAnswer', widget).textContent = answer;
    widget.dataset.answer = answer;
    qs('#answerBookFullReading', widget).hidden = !isThursday();
    qs('#answerBookHint', widget).hidden = true;
    qs('#answerBookCharge', widget).classList.remove('is-active', 'is-ready');

    papers.forEach(function (paper, index) {
      paper.classList.toggle('is-picked', index === pickedIndex);
      if (index === pickedIndex) {
        var frontLayer = qs('#answerBookPapersFront', widget);
        if (frontLayer && paper.parentNode !== frontLayer) frontLayer.appendChild(paper);
        paper.style.zIndex = '240';
      }
    });

    if (window.gsap && !prefersReducedMotion) {
      window.gsap.killTweensOf(papers);
      window.gsap.to(papers.filter(function (paper, index) { return index !== pickedIndex; }), {
        autoAlpha: 0.1,
        scale: 0.58,
        z: -420,
        rotationY: '+=120',
        duration: 0.58,
        ease: 'power2.out',
        stagger: { amount: 0.18, from: pickedIndex }
      });
      window.gsap.timeline()
        .to(picked, {
          x: 0,
          y: -18,
          z: 210,
          rotation: 0,
          rotationX: 0,
          rotationY: 0,
          scale: window.innerWidth < 640 ? 1.25 : 1.36,
          autoAlpha: 1,
          duration: 0.66,
          ease: 'power3.out'
        }, 0)
        .to(picked, { rotationY: 180, duration: 0.48, ease: 'power2.inOut' }, '+=0.06')
        .to(picked, { autoAlpha: 0, scale: 1.08, duration: 0.24, ease: 'power2.out' }, '>-0.04')
        .add(function () {
          var card = qs('#answerBookAnswerCard', widget);
          card.classList.add('is-visible');
          window.gsap.fromTo(card, { autoAlpha: 0, y: 20, scale: 0.96, rotationX: 5 }, { autoAlpha: 1, y: 0, scale: 1, rotationX: 0, duration: 0.48, ease: 'power3.out' });
        });
      return;
    }

    qs('#answerBookAnswerCard', widget).classList.add('is-visible');
  }

  function saveAnswer(widget) {
    var answer = widget.dataset.answer || '';
    if (!answer) return;
    var saved = [];
    try {
      saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(saved)) saved = [];
      saved.unshift({ answer: answer, createdAt: new Date().toISOString() });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(0, 12)));
      qs('#answerBookToast', widget).textContent = '已保存到本机。';
    } catch (error) {
      qs('#answerBookToast', widget).textContent = '保存失败，可以先复制这句话。';
    }
  }

  function shareAnswer(widget) {
    var answer = widget.dataset.answer || '';
    if (!answer) return;
    var text = 'ANSWER: ' + answer;
    if (navigator.share) {
      navigator.share({ title: 'Digital Answer Book', text: text }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        qs('#answerBookToast', widget).textContent = '已复制到剪贴板。';
      }).catch(function () {
        qs('#answerBookToast', widget).textContent = text;
      });
      return;
    }
    qs('#answerBookToast', widget).textContent = text;
  }

  function bindEvents(widget) {
    qs('#answerBookOpen', widget).addEventListener('click', function () {
      var book = qs('#answerBookOpen', widget);
      book.classList.add('is-opening');
      window.setTimeout(function () { book.classList.remove('is-opening'); }, 260);
      setOpen(widget, true);
    });

    qsa('[data-answer-close]', widget).forEach(function (node) {
      node.addEventListener('click', function () { setOpen(widget, false); });
    });

    qs('#answerBookStage', widget).addEventListener('wheel', function (event) {
      event.preventDefault();
      if (Math.abs(event.deltaY) > 8) chargeGesture(widget, event.deltaY);
    }, { passive: false });

    qs('#answerBookStage', widget).addEventListener('touchstart', function (event) {
      if (!stageState || !event.touches.length) return;
      stageState.touchStartY = event.touches[0].clientY;
    }, { passive: true });

    qs('#answerBookStage', widget).addEventListener('touchmove', function (event) {
      if (!stageState || !event.touches.length) return;
      var dy = event.touches[0].clientY - stageState.touchStartY;
      if (Math.abs(dy) > 10) {
        event.preventDefault();
        stageState.touchStartY = event.touches[0].clientY;
        chargeGesture(widget, dy);
      }
    }, { passive: false });

    qs('#answerBookAgain', widget).addEventListener('click', function () { resetStage(widget, false); });
    qs('#answerBookSave', widget).addEventListener('click', function () { saveAnswer(widget); });
    qs('#answerBookShare', widget).addEventListener('click', function () { shareAnswer(widget); });

    document.addEventListener('keydown', function (event) {
      var modal = qs('#answerBookModal', widget);
      if (!modal || !modal.classList.contains('is-open')) return;
      if (event.key === 'Escape') setOpen(widget, false);
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === ' ') {
        event.preventDefault();
        chargeGesture(widget, 92);
      }
    });

    window.addEventListener('resize', function () {
      var modal = qs('#answerBookModal', widget);
      if (modal && modal.classList.contains('is-open') && (!stageState || !stageState.isPicked)) {
        setPaperLayout(widget, false);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var widget = createWidget();
    waitForHomeSettle(widget);
    bindEvents(widget);
    animateEntrance(widget);
  });
})();

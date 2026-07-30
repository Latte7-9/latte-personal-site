(function () {
  var cards = document.querySelectorAll('.interest-magnetic-card');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!cards.length) return;

  var kaomojiMap = {
    LIGHTBOX: '( •̀ ω •́ )✧',
    ALTITUDE: '(ง •̀_•́)ง',
    READING: '(｡･ω･｡)ﾉ📖',
    MESSY: '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧'
  };

  function prepareCard(card) {
    if (card.dataset.magneticReady === 'true') return;
    card.dataset.magneticReady = 'true';
    var title = card.textContent.trim();
    var label = card.getAttribute('data-kind') || 'MODULE';
    var kaomoji = kaomojiMap[label] || '(｀・ω・´)';
    card.textContent = '';
    card.innerHTML =
      '<span class="interest-card-label">' + label + '</span>' +
      '<span class="interest-card-spark" aria-hidden="true"></span>' +
      '<span class="interest-card-title">' +
        '<span class="interest-title-text">' + title + '</span>' +
        '<span class="interest-kaomoji" aria-hidden="true">' + kaomoji + '</span>' +
      '</span>' +
      '<span class="interest-card-path" aria-hidden="true"></span>';
  }

  function initFallback(card) {
    card.addEventListener('pointerdown', function () {
      var kaomoji = card.querySelector('.interest-kaomoji');
      card.classList.add('is-magnetic');
      if (kaomoji) kaomoji.classList.add('is-peeking');
      window.setTimeout(function () { card.classList.remove('is-magnetic'); }, 240);
      window.setTimeout(function () {
        if (kaomoji) kaomoji.classList.remove('is-peeking');
      }, 420);
    });
  }

  function initGsapCard(card) {
    var spark = card.querySelector('.interest-card-spark');
    var kaomoji = card.querySelector('.interest-kaomoji');
    var path = card.querySelector('.interest-card-path');
    var kaomojiXTo = gsap.quickTo(kaomoji, 'x', { duration: 0.28, ease: 'power3.out', overwrite: 'auto' });
    var kaomojiYTo = gsap.quickTo(kaomoji, 'y', { duration: 0.28, ease: 'power3.out', overwrite: 'auto' });
    var kaomojiRotateTo = gsap.quickTo(kaomoji, 'rotation', { duration: 0.28, ease: 'power3.out', overwrite: 'auto' });

    card.addEventListener('pointermove', function (event) {
      if (event.pointerType === 'touch') return;
      var rect = card.getBoundingClientRect();
      var relX = (event.clientX - rect.left) / rect.width;
      var relY = (event.clientY - rect.top) / rect.height;
      var x = (relX - 0.5) * 18;
      var y = (relY - 0.5) * 14;
      card.classList.add('is-magnetic');
      card.style.setProperty('--glow-x', (relX * 100).toFixed(1) + '%');
      card.style.setProperty('--glow-y', (relY * 100).toFixed(1) + '%');
      card.style.setProperty('--spark-x', (relX * 100).toFixed(1) + '%');
      card.style.setProperty('--spark-y', (relY * 100).toFixed(1) + '%');
      kaomojiXTo(x);
      kaomojiYTo(y);
      kaomojiRotateTo((relX - 0.5) * 12);
      gsap.to(spark, { scale: 1.45, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(kaomoji, { scale: 1.12, duration: 0.22, ease: 'back.out(2)', overwrite: 'auto' });
      gsap.to(path, { opacity: 0.72, scaleX: 1, duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
    });

    card.addEventListener('pointerleave', function () {
      card.classList.remove('is-magnetic');
      gsap.to(card, { scale: 1, duration: 0.24, ease: 'power2.out', overwrite: true });
      gsap.to(kaomoji, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.54, ease: 'elastic.out(1, 0.42)', overwrite: true });
      gsap.to(spark, { scale: 1, duration: 0.28, ease: 'power2.out', overwrite: true });
      gsap.to(path, { opacity: 0, scaleX: 0.2, duration: 0.24, ease: 'power2.out', overwrite: true });
    });

    card.addEventListener('pointerdown', function () {
      gsap.to(kaomoji, { y: '-=8', rotation: '+=8', scale: 1.22, duration: 0.13, ease: 'power2.out', overwrite: 'auto' });
    });

    card.addEventListener('pointerup', function () {
      gsap.to(kaomoji, { y: 0, rotation: 0, scale: 1, duration: 0.48, ease: 'elastic.out(1, 0.36)', overwrite: 'auto' });
    });

    card.addEventListener('focus', function () {
      gsap.to(kaomoji, { y: -6, rotation: 5, scale: 1.12, duration: 0.28, ease: 'back.out(2)', overwrite: 'auto' });
    });

    card.addEventListener('blur', function () {
      gsap.to(kaomoji, { x: 0, y: 0, rotation: 0, scale: 1, duration: 0.34, ease: 'power3.out', overwrite: true });
    });
  }

  cards.forEach(function (card, index) {
    prepareCard(card);
    if (prefersReducedMotion || !window.gsap) {
      initFallback(card);
      return;
    }
    initGsapCard(card);
    gsap.from(card, {
      y: 22,
      autoAlpha: 0,
      duration: 0.72,
      delay: index * 0.08,
      ease: 'power3.out',
      overwrite: 'auto'
    });
  });
})();

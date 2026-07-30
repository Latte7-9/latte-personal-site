// ====== GSAP cursor trail: adapted from demos.gsap.com/demo/cursor-trail ======
(function() {
  function loadGlobalAsset(tag, attrs) {
    var marker = attrs['data-latte-global'];
    if (marker && document.querySelector('[' + 'data-latte-global="' + marker + '"]')) return;
    var el = document.createElement(tag);
    Object.keys(attrs).forEach(function(key) { el.setAttribute(key, attrs[key]); });
    (tag === 'link' ? document.head : document.body).appendChild(el);
  }

  var cursorScript = document.currentScript && document.currentScript.src;
  var rootBase = cursorScript ? cursorScript.replace(/js\/cursor\.js(?:\?.*)?$/, '') : '';
  var assetVersion = '?v=20260707-blue-mobile-nav';
  var isMusicPage = /\/music\/?$/.test(location.pathname);
  if (!isMusicPage) {
    loadGlobalAsset('link', {
      rel: 'stylesheet',
      href: rootBase + 'css/global-player.css' + assetVersion,
      'data-latte-global': 'player-css'
    });
  }
  loadGlobalAsset('link', {
    rel: 'stylesheet',
    href: rootBase + 'css/blog-comments.css' + assetVersion,
    'data-latte-global': 'comments-css'
  });
  loadGlobalAsset('link', {
    rel: 'stylesheet',
    href: rootBase + 'css/reading-notes.css' + assetVersion,
    'data-latte-global': 'reading-notes-css'
  });
  loadGlobalAsset('script', {
    src: rootBase + 'js/blog-comments.js' + assetVersion,
    defer: 'defer',
    'data-latte-global': 'comments-js'
  });
  if (!isMusicPage) {
    loadGlobalAsset('script', {
      src: rootBase + 'js/global-player.js' + assetVersion,
      defer: 'defer',
      'data-latte-global': 'player-js'
    });
  }

  var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("has-neon-cursor");
  if (prefersReducedMotion || !window.gsap) return;

  var palette = ["#ff3d71", "#00d4aa", "#ffb800", "#7c4dff", "#4da3ff"];
  var flairCount = 18;
  var flair = [];

  function makeFlair(i) {
    var el = document.createElement("span");
    var color = palette[i % palette.length];
    var shape = i % 4;
    el.className = "flair";
    el.style.cssText =
      "position:fixed;left:0;top:0;z-index:9998;pointer-events:none;" +
      "width:" + (18 + (i % 5) * 4) + "px;height:" + (18 + (i % 5) * 4) + "px;" +
      "opacity:0;will-change:transform,opacity;" +
      "mix-blend-mode:screen;background:" + color + ";" +
      "box-shadow:0 0 16px " + color + ",0 0 36px " + color + ";";

    if (shape === 0) {
      el.style.borderRadius = "50%";
    } else if (shape === 1) {
      el.style.borderRadius = "38% 62% 44% 56%";
    } else if (shape === 2) {
      el.style.borderRadius = "4px";
      el.style.transform = "rotate(45deg)";
    } else {
      el.style.width = "10px";
      el.style.height = "30px";
      el.style.borderRadius = "999px";
    }

    document.body.appendChild(el);
    return el;
  }

  for (var i = 0; i < flairCount; i++) {
    flair.push(makeFlair(i));
  }

  function playAnimation(shape) {
    var tl = gsap.timeline();
    tl.from(shape, {
      opacity: 0,
      scale: 0,
      ease: "elastic.out(1,0.3)"
    })
    .to(shape, {
      rotation: "random([-360, 360])"
    }, "<")
    .to(shape, {
      y: "120vh",
      ease: "back.in(.4)",
      duration: 1
    }, 0);
  }

  var gap = 100;
  var index = 0;
  var wrapper = gsap.utils.wrap(0, flair.length);
  gsap.defaults({ duration: 1 });

  var mousePos = { x: 0, y: 0 };
  var lastMousePos = { x: 0, y: 0 };
  var cachedMousePos = { x: 0, y: 0 };
  var hasMouse = false;

  window.addEventListener("mousemove", function(e) {
    mousePos = { x: e.x, y: e.y };
    if (!hasMouse) {
      lastMousePos = { x: e.x, y: e.y };
      cachedMousePos = { x: e.x, y: e.y };
      hasMouse = true;
    }
  }, { passive: true });

  gsap.ticker.add(ImageTrail);

  function ImageTrail() {
    if (!hasMouse) return;
    var travelDistance = Math.hypot(
      lastMousePos.x - mousePos.x,
      lastMousePos.y - mousePos.y
    );

    cachedMousePos.x = gsap.utils.interpolate(
      cachedMousePos.x || mousePos.x,
      mousePos.x,
      0.1
    );
    cachedMousePos.y = gsap.utils.interpolate(
      cachedMousePos.y || mousePos.y,
      mousePos.y,
      0.1
    );

    if (travelDistance > gap) {
      animateImage();
      lastMousePos = { x: mousePos.x, y: mousePos.y };
    }
  }

  function animateImage() {
    var wrappedIndex = wrapper(index);
    var img = flair[wrappedIndex];
    gsap.killTweensOf(img);

    gsap.set(img, {
      clearProps: "transform,opacity,left,top"
    });

    gsap.set(img, {
      opacity: 1,
      left: mousePos.x,
      top: mousePos.y,
      xPercent: -50,
      yPercent: -50
    });

    playAnimation(img);
    index++;
  }
})();

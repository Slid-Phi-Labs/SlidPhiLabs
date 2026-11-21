/* Homepage project carousel — vanilla JS, no dependencies.
   Pattern: W3C APG grouped carousel; accessibility.build carousel guidance.
   No auto-advance; the prev/next buttons and the dot picker are the primary
   path. Left/Right keys and touch swipe are conveniences. Focus never moves
   on a slide change. Non-visible slides are hidden, so they leave the
   accessibility tree and the tab order. */
(function () {
  var carousel = document.querySelector('.spl-carousel');
  if (!carousel) return;
  var viewport = carousel.querySelector('.spl-carousel-viewport');
  var slides = Array.prototype.slice.call(viewport.querySelectorAll('[data-slide]'));
  var dots = Array.prototype.slice.call(carousel.querySelectorAll('.spl-carousel-dots button'));
  var prevBtn = carousel.querySelector('.spl-carousel-prev');
  var nextBtn = carousel.querySelector('.spl-carousel-next');
  if (!slides.length || !prevBtn || !nextBtn) return;

  var total = slides.length;
  var current = 0;

  function show(index) {
    var next = ((index % total) + total) % total; /* wrap-around both directions */
    if (next === current) return;
    slides[current].hidden = true;
    slides[next].hidden = false;
    dots.forEach(function (dot, i) {
      var isCurrent = i === next;
      dot.setAttribute('aria-disabled', isCurrent ? 'true' : 'false');
      if (isCurrent) {
        dot.setAttribute('aria-current', 'true');
      } else {
        dot.removeAttribute('aria-current');
      }
    });
    current = next;
  }

  prevBtn.addEventListener('click', function () { show(current - 1); });
  nextBtn.addEventListener('click', function () { show(current + 1); });
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { show(i); });
  });

  carousel.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      show(current - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      show(current + 1);
    }
  });

  /* Touch swipe via Pointer Events. touch-action: pan-y in CSS keeps vertical
     page scroll native; horizontal drags reach pointermove/pointerup. A swipe
     that starts on a link must not also fire that link, so a swipe suppresses
     the click that follows it. */
  var startX = null;
  var startY = null;
  var swiped = false;

  viewport.addEventListener('pointerdown', function (event) {
    swiped = false;
    if (event.pointerType === 'mouse') return;
    startX = event.clientX;
    startY = event.clientY;
  });
  viewport.addEventListener('pointerup', function (event) {
    if (startX === null) return;
    var dx = event.clientX - startX;
    var dy = event.clientY - startY;
    startX = null;
    startY = null;
    if (Math.abs(dx) >= 40 && Math.abs(dy) <= 15) {
      swiped = true;
      show(dx < 0 ? current + 1 : current - 1);
    }
  });
  viewport.addEventListener('pointercancel', function () {
    startX = null;
    startY = null;
  });
  viewport.addEventListener('click', function (event) {
    if (swiped) {
      swiped = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
})();

/* Антикризисный риэлтор — интерактив блоков 2–12 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Появление при скролле ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var siblings = Array.prototype.filter.call(el.parentNode.children, function (n) {
          return n.classList && n.classList.contains('reveal');
        });
        var delay = Math.min(siblings.indexOf(el), 6) * 80;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('is-visible');
        setTimeout(function () { el.style.transitionDelay = ''; }, 900 + delay);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- 3D-наклон карточек услуг ---------- */
  if (canHover && !reduceMotion) {
    document.querySelectorAll('.tilt').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width;
        var y = (e.clientY - r.top) / r.height;
        card.style.transform = 'perspective(1200px) rotateX(' + ((0.5 - y) * 6).toFixed(2) +
          'deg) rotateY(' + ((x - 0.5) * 8).toFixed(2) + 'deg) translateY(-6px)';
        card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () { card.style.transform = ''; });
    });
  }

  /* ---------- Таймлайн: заполнение линии ---------- */
  var timeline = document.querySelector('[data-timeline]');
  if (timeline) {
    var steps = timeline.querySelectorAll('.step');
    var ticking = false;
    var updateTimeline = function () {
      ticking = false;
      var vh = window.innerHeight;
      var anchor = vh * 0.62;
      var r = timeline.getBoundingClientRect();
      var p = Math.min(Math.max((anchor - r.top) / r.height, 0), 1);
      timeline.style.setProperty('--p', p.toFixed(4));
      steps.forEach(function (s) {
        var dot = s.querySelector('.step__dot').getBoundingClientRect();
        s.classList.toggle('is-active', dot.top < anchor);
      });
    };
    var onScroll = function () {
      if (!ticking) { ticking = true; requestAnimationFrame(updateTimeline); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateTimeline();
  }

  /* ---------- Аккордеон FAQ ---------- */
  var accRoot = document.querySelector('[data-accordion]');
  if (accRoot) {
    var accs = accRoot.querySelectorAll('.acc');
    var setAcc = function (acc, open) {
      acc.classList.toggle('is-open', open);
      acc.querySelector('.acc__btn').setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    accs.forEach(function (acc) {
      acc.querySelector('.acc__btn').addEventListener('click', function () {
        var willOpen = !acc.classList.contains('is-open');
        accs.forEach(function (a) { setAcc(a, false); });
        setAcc(acc, willOpen);
      });
    });
    if (accs[0]) setAcc(accs[0], true);
  }

  /* ---------- Модальные окна ---------- */
  var openModal = function (dialog) {
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    document.body.classList.add('modal-open');
    document.dispatchEvent(new CustomEvent('modal:toggle', { detail: true }));
  };
  var closeModal = function (dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  };

  document.querySelectorAll('dialog.modal').forEach(function (dialog) {
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog || e.target.closest('[data-close]')) closeModal(dialog);
    });
    dialog.addEventListener('close', function () {
      document.body.classList.remove('modal-open');
      document.dispatchEvent(new CustomEvent('modal:toggle', { detail: false }));
    });
  });

  document.querySelectorAll('[data-open]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openModal(document.getElementById(btn.getAttribute('data-open')));
    });
  });

  // Отзыв в окне
  var reviewModal = document.getElementById('review-modal');
  var fillReview = function (card) {
    var set = function (key, value) {
      var el = reviewModal.querySelector('[data-m="' + key + '"]');
      if (el) el.textContent = value;
    };
    set('tag', card.querySelector('.review__tag').textContent);
    set('text', card.querySelector('.review__text').textContent);
    set('name', card.querySelector('.review__name').textContent);
    set('date', card.querySelector('.review__date').textContent);
    set('avatar', card.querySelector('.review__avatar').textContent);
  };

  /* ---------- Лента отзывов ---------- */
  var mq = document.querySelector('[data-marquee]');
  if (mq) {
    var track = mq.querySelector('.marquee__track');
    var originals = Array.prototype.slice.call(track.children);
    originals.forEach(function (card) {
      var clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('button, a').forEach(function (b) { b.tabIndex = -1; });
      track.appendChild(clone);
    });
    var firstClone = track.children[originals.length];

    var x = 0;
    var loopW = 0;
    var speed = 42; // px в секунду
    var hovered = false;
    var focused = false;
    var dragging = false;
    var pointerDown = false;
    var modalOpen = false;
    var inView = true;
    var holdUntil = 0;
    var startX = 0;
    var startOffset = 0;
    var moved = false;
    var suppressClick = false;
    var pid = null;
    var last = performance.now();

    var measure = function () { loopW = firstClone.offsetLeft - originals[0].offsetLeft; };
    var wrap = function () {
      if (!loopW) return;
      while (x <= -loopW) x += loopW;
      while (x > 0) x -= loopW;
    };
    var render = function () { track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)'; };

    var frame = function (now) {
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      var paused = reduceMotion || hovered || focused || dragging || pointerDown ||
        modalOpen || !inView || now < holdUntil;
      if (!paused) { x -= speed * dt; wrap(); render(); }
      requestAnimationFrame(frame);
    };

    measure();
    window.addEventListener('resize', function () { measure(); wrap(); render(); });
    window.addEventListener('load', measure);
    requestAnimationFrame(frame);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
      }).observe(mq);
    }

    // Остановка при наведении (мышь)
    mq.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hovered = true; });
    mq.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hovered = false; });
    mq.addEventListener('focusin', function () { focused = true; });
    mq.addEventListener('focusout', function () { focused = false; });

    // Перетаскивание мышью / пальцем
    mq.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerDown = true;
      moved = false;
      startX = e.clientX;
      startOffset = x;
      pid = e.pointerId;
      if (e.pointerType !== 'mouse') holdUntil = Infinity; // касание — лента стоит
    });

    mq.addEventListener('pointermove', function (e) {
      if (!pointerDown || e.pointerId !== pid) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) {
        moved = true;
        dragging = true;
        mq.classList.add('is-dragging');
        try { mq.setPointerCapture(pid); } catch (err) { /* noop */ }
      }
      if (moved) { x = startOffset + dx; wrap(); render(); }
    });

    var endDrag = function (e) {
      if (!pointerDown) return;
      pointerDown = false;
      if (moved) suppressClick = true;
      dragging = false;
      mq.classList.remove('is-dragging');
      // после касания лента стоит 4 секунды, затем продолжает движение
      if (e.pointerType !== 'mouse') holdUntil = performance.now() + 4000;
      setTimeout(function () { suppressClick = false; }, 50);
    };
    mq.addEventListener('pointerup', endDrag);
    mq.addEventListener('pointercancel', endDrag);
    mq.addEventListener('dragstart', function (e) { e.preventDefault(); });

    mq.addEventListener('click', function (e) {
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); return; }
      var btn = e.target.closest('[data-review-open]');
      if (btn && reviewModal) {
        fillReview(btn.closest('.review'));
        openModal(reviewModal);
      }
    }, true);

    document.addEventListener('modal:toggle', function (e) {
      modalOpen = e.detail;
      if (!modalOpen) holdUntil = performance.now() + 1200;
    });
  }

  /* ---------- Маска телефона ---------- */
  var formatPhone = function (value) {
    var d = value.replace(/\D/g, '');
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    d = d.slice(0, 11);
    var out = '+7';
    if (d.length > 1) out += ' (' + d.slice(1, 4);
    if (d.length >= 4) out += ')';
    if (d.length > 4) out += ' ' + d.slice(4, 7);
    if (d.length > 7) out += '-' + d.slice(7, 9);
    if (d.length > 9) out += '-' + d.slice(9, 11);
    return out;
  };

  document.querySelectorAll('[data-phone]').forEach(function (input) {
    input.addEventListener('input', function () {
      input.value = formatPhone(input.value);
      input.classList.remove('is-invalid');
    });
    input.addEventListener('focus', function () { if (!input.value) input.value = '+7 ('; });
    input.addEventListener('blur', function () { if (input.value.replace(/\D/g, '').length <= 1) input.value = ''; });
  });

  /* ---------- Отправка форм ---------- */
  document.querySelectorAll('[data-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var valid = true;

      form.querySelectorAll('[required]').forEach(function (field) {
        var ok;
        if (field.type === 'checkbox') ok = field.checked;
        else if (field.hasAttribute('data-phone')) ok = field.value.replace(/\D/g, '').length === 11;
        else ok = field.value.trim().length > 1;

        var target = field.type === 'checkbox' ? field.closest('.consent') : field;
        if (target) target.classList.toggle('is-invalid', !ok);
        if (!ok && valid) { valid = false; field.focus(); }
      });

      if (!valid) return;

      // TODO: подключить отправку заявки (Telegram-бот, почта или CRM):
      // fetch('/send.php', { method: 'POST', body: new FormData(form) });

      var success = form.querySelector('.form-success');
      if (success) success.hidden = false;
      form.reset();

      var dialog = form.closest('dialog');
      setTimeout(function () {
        if (dialog) closeModal(dialog);
        if (success) success.hidden = true;
      }, dialog ? 2600 : 6000);
    });

    form.addEventListener('change', function (e) {
      var c = e.target.closest('.consent');
      if (c) c.classList.remove('is-invalid');
    });
    form.addEventListener('input', function (e) {
      if (e.target.classList) e.target.classList.remove('is-invalid');
    });
  });
})();

(function () {
  /* Mobile nav */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');

  function setOpen(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
  }
  toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); toggle.focus(); }
  });
  document.addEventListener('click', function (e) {
    if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
  });

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* Header shrinks and gains a shadow once the page scrolls; hero photo drifts slightly (parallax) */
  var header = document.querySelector('.site-header');
  var heroPhoto = document.querySelector('.hero-photo');
  var progress = document.querySelector('.progress');
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ticking = false;
  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    header.classList.toggle('scrolled', y > 24);
    if (progress) { var max = document.documentElement.scrollHeight - window.innerHeight; progress.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : 0); }
    if (heroPhoto && !calm && y < 900) heroPhoto.style.setProperty('--py', String(Math.round(y * -0.06)));
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  /* Photos fade in once loaded */
  document.querySelectorAll('img[loading="lazy"]').forEach(function (img) {
    function done() { img.classList.add('is-loaded'); }
    if (img.complete && img.naturalWidth) done(); else { img.addEventListener('load', done); img.addEventListener('error', done); }
  });

  /* Hero headline: split into words so they can slide in one by one */
  var h1 = document.querySelector('.hero-copy h1');
  if (h1 && !calm) {
    var wi = 0;
    (function split(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var w = document.createElement('span'), inner = document.createElement('span');
            w.className = 'w'; inner.textContent = part; inner.style.setProperty('--i', wi++); w.appendChild(inner); frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) { split(n); }
      });
    })(h1);
    h1.classList.add('split');
  }

  /* Soft glow that follows the cursor over product cards (mouse devices only) */
  var cardsEl = document.querySelector('#makes .cards');
  if (cardsEl && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    cardsEl.addEventListener('pointermove', function (e) {
      var card = e.target.closest('.card'); if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px'); card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  }

  /* Scroll reveal */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* Lightbox (steps through whichever photos are currently visible) */
  var box = document.getElementById('lightbox');
  var boxImg = box.querySelector('img');
  var boxCap = box.querySelector('figcaption');
  var all = Array.prototype.slice.call(document.querySelectorAll('[data-zoom]'));
  var list = [];
  var current = 0;

  function show(i) {
    current = (i + list.length) % list.length;
    var img = list[current].querySelector('img');
    boxImg.src = img.getAttribute('src');
    boxImg.alt = img.alt;
    boxCap.textContent = img.alt;
  }
  all.forEach(function (btn) {
    btn.addEventListener('click', function () {
      list = all.filter(function (b) { return b.offsetParent !== null; });
      show(list.indexOf(btn));
      if (typeof box.showModal === 'function') box.showModal();
    });
  });
  box.querySelector('.lb-close').addEventListener('click', function () { box.close(); });
  box.querySelector('.lb-prev').addEventListener('click', function () { show(current - 1); });
  box.querySelector('.lb-next').addEventListener('click', function () { show(current + 1); });
  box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
  var sx = null, sy = null;
  box.addEventListener('touchstart', function (e) { sx = e.changedTouches[0].clientX; sy = e.changedTouches[0].clientY; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = sy = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
    else if (dy > 90 && dy > Math.abs(dx) * 1.5) box.close();
  }, { passive: true });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  /* Product category filter */
  var chips = document.querySelectorAll('.chip');
  var cards = document.querySelectorAll('.card[data-cat]');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      cards.forEach(function (card) {
        var show = f === 'all' || card.getAttribute('data-cat') === f;
        card.hidden = !show;
        if (show) { card.classList.add('in'); card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop'); }
      });
      var track = document.querySelector('#makes .cards'); if (track) track.scrollLeft = 0;
    });
  });

  /* Instagram feed. Paste a Behold JSON feed URL into data-feed on #insta-grid to show live posts.
     If it is empty, or the request fails, the static photos in the HTML stay in place. */
  var instaGrid = document.getElementById('insta-grid');
  var feedUrl = instaGrid && instaGrid.getAttribute('data-feed');
  if (feedUrl && window.fetch) {
    fetch(feedUrl)
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) {
        var posts = (data.posts || []).filter(function (p) { return p.sizes && p.sizes.small; }).slice(0, 6);
        if (!posts.length) return;
        instaGrid.textContent = '';
        posts.forEach(function (p) {
          var a = document.createElement('a');
          a.href = p.permalink; a.target = '_blank'; a.rel = 'noopener';
          var text = (p.altText || p.prunedCaption || p.caption || '').replace(/\s+/g, ' ').trim().slice(0, 110);
          a.setAttribute('aria-label', 'Open on Instagram: ' + (text || 'latest post'));
          var s = p.sizes, img = document.createElement('img');
          img.src = s.small.mediaUrl;
          if (s.medium) img.srcset = s.small.mediaUrl + ' ' + s.small.width + 'w, ' + s.medium.mediaUrl + ' ' + s.medium.width + 'w';
          img.sizes = '(max-width: 820px) 33vw, 180px';
          img.width = s.small.width; img.height = s.small.height;
          img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
          a.appendChild(img);
          if (p.mediaType === 'VIDEO') a.className = 'is-video';
          instaGrid.appendChild(a);
        });
      })
      .catch(function () { /* keep the static photos */ });
  }

  /* Highlight the nav link for the section being read */
  var spyLinks = {};
  document.querySelectorAll('.nav a[href^="#"]:not(.btn)').forEach(function (a) { spyLinks[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(spyLinks).forEach(function (id) {
          if (id === en.target.id) spyLinks[id].setAttribute('aria-current', 'true');
          else spyLinks[id].removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(spyLinks).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });

    /* Floating quote button: shown after the hero, hidden once the contact section is on screen */
    var fab = document.querySelector('.float-cta');
    var pastHero = false, atContact = false, atDesigner = false;
    function updateFab() { fab.classList.toggle('show', pastHero && !atContact && !atDesigner); }
    new IntersectionObserver(function (e) { pastHero = !e[0].isIntersecting && e[0].boundingClientRect.top < 0; updateFab(); }).observe(document.getElementById('top'));
    new IntersectionObserver(function (e) { atContact = e[0].isIntersecting; updateFab(); }, { rootMargin: '0px 0px -10% 0px' }).observe(document.getElementById('contact'));
    var dz = document.getElementById('designer');
    if (dz) new IntersectionObserver(function (e) { atDesigner = e[0].isIntersecting; updateFab(); }).observe(dz);
  }

  /* Board designer: the 3D engine is only downloaded once the section is near the screen */
  var dapp = document.getElementById('designer-app');
  if (dapp) {
    var designerStarted = false;
    var startDesigner = function () {
      if (designerStarted) return; designerStarted = true;
      var load = new Function('u', 'return import(u)');   // keeps very old browsers from choking on the syntax
      load('/js/designer/designer.js?v=3').then(function (m) { m.init(dapp); }).catch(function () {
        dapp.insertAdjacentHTML('beforeend', '<p class="bd-nojs">The board designer could not load here. You can still tell Phil what you would like in the <a href="#contact">enquiry form</a>.</p>');
      });
    };
    if (/[?&]design=/.test(location.search)) {
      dapp.classList.add('is-linked'); startDesigner();
      window.addEventListener('load', function () { var d = document.getElementById('designer'); if (d) d.scrollIntoView(); });
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en, ob) { if (en[0].isIntersecting) { ob.disconnect(); startDesigner(); } }, { rootMargin: '700px 0px' }).observe(dapp);
    } else { startDesigner(); }
  }

  /* Christmas countdown (shown from 1 Oct to 24 Dec only) */
  var xc = document.getElementById('xmas-count');
  if (xc) {
    var now = new Date(), y = now.getFullYear();
    var start = new Date(y, 9, 1), xmas = new Date(y, 11, 25), today = new Date(y, now.getMonth(), now.getDate());
    var days = Math.round((xmas - today) / 86400000);
    if (today >= start && days > 0) {
      xc.textContent = days + (days === 1 ? ' day' : ' days') + ' until Christmas. Order early.';
      xc.hidden = false;
    }
  }

  /* "Enquire about this" links pre-select the product in the form */
  var interest = document.getElementById('f-interest');
  document.querySelectorAll('[data-interest]').forEach(function (a) {
    a.addEventListener('click', function () { interest.value = a.getAttribute('data-interest'); });
  });

  /* Enquiry form: opens the visitor's email app with the details filled in.
     To receive enquiries without an email app, point this at a form service. */
  var form = document.getElementById('enquiry');
  var note = document.getElementById('form-note');
  var TO = 'hello@fathamster.co.uk';
  if (form.getAttribute('data-endpoint')) note.textContent = 'Phil will reply to you by email.';

  ['f-name', 'f-email'].forEach(function (id) {
    var f = document.getElementById(id);
    f.addEventListener('input', function () { f.setAttribute('aria-invalid', 'false'); var er = document.getElementById('err-' + id.slice(2)); if (er) er.hidden = true; });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.elements.name, email = form.elements.email;
    var problems = [];
    function check(field, errId, message, bad) {
      var err = document.getElementById(errId);
      field.setAttribute('aria-invalid', bad ? 'true' : 'false');
      err.hidden = !bad; err.textContent = bad ? message : '';
      if (bad) problems.push(field);
    }
    check(name, 'err-name', 'Please tell Phil your name.', !name.value.trim());
    check(email, 'err-email', 'Please enter a valid email address so Phil can reply.', !/^\S+@\S+\.\S+$/.test(email.value.trim()));
    if (problems.length) {
      note.textContent = 'A couple of details are missing above.';
      problems[0].focus();
      return;
    }
    var details = {
      name: name.value.trim(),
      email: email.value.trim(),
      interest: form.elements.interest.value,
      message: form.elements.message.value.trim(),
      _subject: 'Website enquiry: ' + form.elements.interest.value
    };
    if (form.elements._gotcha && form.elements._gotcha.value) return; /* bot */

    function viaEmailApp() {
      var body = 'Name: ' + details.name + '\nEmail: ' + details.email + '\nInterested in: ' + details.interest + '\n\n' + details.message;
      note.textContent = 'Opening your email app. If nothing happens, email ' + TO + ' directly.';
      window.location.href = 'mailto:' + TO + '?subject=' + encodeURIComponent('Enquiry: ' + details.interest) + '&body=' + encodeURIComponent(body);
    }

    var endpoint = form.getAttribute('data-endpoint');
    if (!endpoint || !window.fetch) { viaEmailApp(); return; }

    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Sending...';
    fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(details) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); })
      .then(function () {
        form.innerHTML = '<div class="thanks" role="status"><h3>Thank you, ' + details.name.replace(/[<>&"]/g, '') + '</h3><p>Your enquiry has been sent. Phil will be in touch by email soon.</p></div>';
      })
      .catch(function () { btn.disabled = false; btn.textContent = 'Send enquiry'; viaEmailApp(); });
  });
})();

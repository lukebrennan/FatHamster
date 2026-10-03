(function () {
  /* Mobile nav */
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');

  function setOpen(open) {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }
  toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') setOpen(false); });

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

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
        if (show) card.classList.add('in');
      });
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
    var pastHero = false, atContact = false;
    function updateFab() { fab.classList.toggle('show', pastHero && !atContact); }
    new IntersectionObserver(function (e) { pastHero = !e[0].isIntersecting && e[0].boundingClientRect.top < 0; updateFab(); }).observe(document.getElementById('top'));
    new IntersectionObserver(function (e) { atContact = e[0].isIntersecting; updateFab(); }, { rootMargin: '0px 0px -10% 0px' }).observe(document.getElementById('contact'));
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

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.elements.name, email = form.elements.email;
    var ok = true;
    [name, email].forEach(function (f) {
      var bad = !f.value.trim() || (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
      f.classList.toggle('invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) {
      note.textContent = 'Please add your name and a valid email address.';
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

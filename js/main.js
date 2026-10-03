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

  /* Lightbox */
  var box = document.getElementById('lightbox');
  var boxImg = box.querySelector('img');
  var boxCap = box.querySelector('figcaption');
  var zoomables = Array.prototype.slice.call(document.querySelectorAll('[data-zoom]'));
  var current = 0;

  function show(i) {
    current = (i + zoomables.length) % zoomables.length;
    var img = zoomables[current].querySelector('img');
    boxImg.src = img.currentSrc || img.src;
    boxImg.alt = img.alt;
    boxCap.textContent = img.alt;
  }
  zoomables.forEach(function (btn, i) {
    btn.addEventListener('click', function () {
      show(i);
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
    var body = 'Name: ' + name.value.trim() + '\n' +
               'Email: ' + email.value.trim() + '\n' +
               'Interested in: ' + form.elements.interest.value + '\n\n' +
               form.elements.message.value.trim();
    var subject = 'Enquiry: ' + form.elements.interest.value;
    note.textContent = 'Opening your email app. If nothing happens, email ' + TO + ' directly.';
    window.location.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  });
})();

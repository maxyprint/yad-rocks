(function () {
  // --- 1. Scroll depth ---
  var fired = {};
  function checkScroll() {
    var pct = Math.round((window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100);
    [25, 50, 75, 100].forEach(function (p) {
      if (pct >= p && !fired[p]) {
        fired[p] = true;
        if (window.clarity) clarity('event', 'scroll_' + p);
      }
    });
  }
  window.addEventListener('scroll', checkScroll, { passive: true });

  // --- 2. Section visibility — track last section seen ---
  var lastSection = 'hero';
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          lastSection = e.target.dataset.track || e.target.className.split(' ')[0] || 'section';
        }
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('section').forEach(function (s) { io.observe(s); });
  }

  // --- 3. Exit event — fire last section on tab close/hide ---
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && window.clarity) {
      clarity('event', 'exit_' + lastSection);
    }
  });

  // --- 4. CTA click tracking ---
  document.addEventListener('click', function (e) {
    if (!window.clarity) return;
    var el = e.target.closest('a, button');
    if (!el) return;
    var href = (el.href || '').toLowerCase();
    var text = el.textContent.trim().slice(0, 30);
    if (href.includes('termin')) {
      clarity('event', 'cta_termin');
    } else if (href.includes('selbstcheck')) {
      clarity('event', 'cta_selbstcheck');
    } else if (el.tagName === 'BUTTON' || el.classList.contains('btn')) {
      clarity('event', 'btn_' + text.replace(/\s+/g, '_').toLowerCase().slice(0, 25));
    }
  });

  // --- 5. Termin-Funnel steps (only on /termin) ---
  if (window.location.pathname.includes('termin')) {
    var _goStep = window.goStep;
    if (typeof _goStep === 'function') {
      window.goStep = function (n) {
        if (window.clarity) clarity('event', 'termin_step_' + n);
        return _goStep(n);
      };
    }
    var _submitBooking = window.submitBooking;
    if (typeof _submitBooking === 'function') {
      window.submitBooking = function () {
        if (window.clarity) clarity('event', 'termin_submit');
        return _submitBooking();
      };
    }
    // Patch: also hook via MutationObserver for step 4 (confirmation)
    var step4 = document.getElementById('step-4');
    if (step4 && window.MutationObserver) {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.type === 'attributes' && m.attributeName === 'class') {
            if (!step4.classList.contains('hidden') && window.clarity) {
              clarity('event', 'termin_confirmed');
            }
          }
        });
      }).observe(step4, { attributes: true });
    }
  }
})();

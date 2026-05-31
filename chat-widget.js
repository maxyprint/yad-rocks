(function () {
  'use strict';

  var QA = [
    {
      id: 'null-start',
      q: 'Wir haben noch gar keine Online-Präsenz — könnt ihr von Null aufbauen?',
      a: 'Ja — genau dafür sind wir da. Von Google-Eintrag über Website und Buchungssystem bis zum individuellen KI-Chatbot: wir digitalisieren euer Studio komplett. Ihr müsst euch um nichts kümmern außer dem Tattoowieren.'
    },
    {
      id: 'pakete',
      q: 'Welche Pakete gibt es und was kosten sie?',
      a: 'PAKETE'
    },
    {
      id: 'meta-ads',
      q: 'Was macht ihr genau bei Meta Ads?',
      a: 'Wir bauen Kampagnen auf Facebook + Instagram, erstellen Creatives aus eurem vorhandenen Handy-Content, und schalten einen Qualifikations-Funnel vor — sodass nur buchungsbereite Kunden bei euch ankommen. Zeitverschwender filtert das System raus bevor sie euch überhaupt erreichen.'
    },
    {
      id: 'website-booking',
      q: 'Macht ihr auch Websites, Buchungssysteme und Chatbots?',
      a: 'Ja. Im KOMPLETT-Paket bauen wir eine professionelle Studio-Website mit integriertem Online-Buchungssystem. Kunden buchen direkt online ihren Termin — ohne dass ihr manuell koordinieren müsst. Dazu kommt ein individueller KI-Chatbot der Story-Replies und DMs rund um die Uhr beantwortet.'
    },
    {
      id: 'ergebnisse',
      q: 'Wie schnell kommen erste Ergebnisse?',
      a: 'Erste Anfragen sind oft in den ersten 7–14 Tagen möglich. Verlässliche, planbare Ergebnisse zeigen sich nach 3–6 Wochen — das ist die Lernphase in der Meta versteht, wer euer idealer Kunde ist. Ab dann läuft das System ohne euer Zutun.'
    },
    {
      id: 'qualitaet',
      q: 'Kommen qualifizierte Anfragen oder Zeitverschwender?',
      a: 'Qualifizierte. Wer bei euch landet, hat bereits euren Stil gesehen, kennt eure Preisvorstellung und ist buchungsbereit. Der Funnel filtert aus, wer nicht ernsthaft ist — bevor derjenige überhaupt eure Zeit kostet.'
    },
    {
      id: 'vertrag',
      q: 'Gibt es einen Langzeitvertrag?',
      a: 'Nein. Monatlich kündbar — immer. Wir verdienen unser Geld wenn ihr Ergebnisse seht. Außerdem machen wir gar nicht erst weiter wenn wir nach dem Erstgespräch nicht glauben, dass es für euch passt.'
    },
    {
      id: 'budget',
      q: 'Was ist das Werbebudget — geht das an euch?',
      a: 'Das Werbebudget geht direkt an Meta (Facebook/Instagram) — nicht an uns. Ihr habt jederzeit die volle Kontrolle. Wir empfehlen mindestens €450/Monat (€15/Tag) als Start. Unsere Agenturgebühr ist davon getrennt und in den Paketen klar ausgewiesen.'
    }
  ];

  var PAKETE = [
    {
      name: 'LOKAL',
      tagline: 'Digital sichtbar werden',
      setup: '',
      monatlich: '€ 290 einmalig',
      budget: 'Kein Monatsabo · Kein Werbebudget',
      items: [
        'Google Business Setup & Optimierung',
        'Simple Landingpage (1 Seite: Studio, Stile, Buchungs-CTA)',
        'Buchungslink über das YAD CRM System integriert',
        'WhatsApp Business Einrichtung',
        'Basis-Chatbot für Story-Replies'
      ],
      breakeven: 'Break-even: ~1 extra Buchung / Monat'
    },
    {
      name: 'ADS',
      tagline: 'Planbar wachsen',
      setup: '€ 390 einmalig',
      monatlich: '€ 299 / Monat',
      budget: '+ Werbebudget ab € 450 / Monat direkt an Meta',
      items: [
        'Meta Ads Management (Facebook + Instagram)',
        'Creative-Produktion aus eurem Content',
        'Lead-Qualifikations-Funnel',
        'DM-Chatbot inkl. — qualifiziert rund um die Uhr',
        'Wöchentlicher Performance-Report',
        'Google Business laufend optimiert'
      ],
      breakeven: 'Break-even: ~2 extra Buchungen / Monat'
    },
    {
      name: 'KOMPLETT',
      tagline: 'Volle Digitalisierung',
      setup: '€ 990 einmalig',
      monatlich: '€ 549 / Monat',
      budget: '+ Werbebudget ab € 450 / Monat direkt an Meta',
      items: [
        'Alles aus ADS',
        'Professionelle Studio-Website (5 Seiten)',
        'Online-Buchungssystem vollständig integriert',
        'Individueller KI-Chatbot (24/7, auf euer Studio zugeschnitten)',
        'TikTok Reels Produktion (2–3 / Monat)',
        'Monatlicher Strategy Call (30 Min)'
      ],
      breakeven: 'Break-even: ~5 extra Buchungen / Monat'
    }
  ];

  // ── Styles ────────────────────────────────────────────────────────────
  var css = [
    '#yadchat-btn{position:fixed;bottom:24px;right:24px;z-index:9999;width:56px;height:56px;border-radius:50%;background:#e8173a;color:#fff;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(232,23,58,0.35);display:flex;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s;font-family:inherit}',
    '#yadchat-btn:hover{transform:scale(1.08)}',
    '#yadchat-panel{position:fixed;bottom:92px;right:24px;z-index:9998;width:370px;max-width:calc(100vw - 32px);background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.14),0 2px 8px rgba(0,0,0,0.06);border:1px solid #e5e7eb;display:flex;flex-direction:column;max-height:560px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}',
    '#yadchat-head{padding:14px 20px;background:#e8173a;border-radius:16px 16px 0 0;display:flex;align-items:center;gap:10px;flex-shrink:0}',
    '#yadchat-head .yc-avatar{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '#yadchat-head .yc-name{font-size:14px;font-weight:700;color:#fff}',
    '#yadchat-head .yc-sub{font-size:12px;color:rgba(255,255,255,0.75)}',
    '#yadchat-body{flex:1;overflow-y:auto;padding:18px}',
    '.yc-bubble{background:#f9fafb;border-radius:12px;padding:13px 15px;margin-bottom:14px;font-size:14px;color:#111827;line-height:1.65}',
    '.yc-btn{display:block;width:100%;text-align:left;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:10px 13px;font-size:13px;font-weight:500;color:#111827;cursor:pointer;margin-bottom:7px;transition:border-color .15s,background .15s;font-family:inherit}',
    '.yc-btn:hover{border-color:#e8173a;background:#fff5f5}',
    '.yc-btn.secondary{color:#6b7280}',
    '.yc-btn.primary{background:#e8173a;color:#fff;border-color:#e8173a;font-weight:700;text-align:center}',
    '.yc-btn.primary:hover{background:#c0102e;border-color:#c0102e}',
    '.yc-btn.ghost{background:none;border:none;font-size:12px;color:#9ca3af;padding:4px;margin-top:2px}',
    '.yc-btn.ghost:hover{color:#6b7280}',
    '.yc-answer-q{font-size:13px;font-weight:700;color:#e8173a;margin-bottom:9px}',
    '.yc-pkg{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-bottom:10px}',
    '.yc-pkg-name{font-size:13px;font-weight:800;color:#e8173a;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}',
    '.yc-pkg-tagline{font-size:12px;color:#6b7280;margin-bottom:10px}',
    '.yc-pkg-price{font-size:15px;font-weight:700;color:#111827;margin-bottom:2px}',
    '.yc-pkg-setup{font-size:12px;color:#6b7280;margin-bottom:2px}',
    '.yc-pkg-budget{font-size:11px;color:#9ca3af;margin-bottom:10px}',
    '.yc-pkg-item{font-size:12px;color:#374151;margin-bottom:4px;display:flex;gap:6px}',
    '.yc-pkg-item::before{content:"✓";color:#16a34a;font-weight:700;flex-shrink:0}',
    '.yc-pkg-breakeven{font-size:11px;color:#9ca3af;margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb}',
    '.yc-contact-form input,.yc-contact-form textarea{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;outline:none;font-family:inherit;color:#111827;margin-bottom:8px}',
    '.yc-contact-form textarea{resize:none}',
    '.yc-sent{text-align:center;padding:24px 0}',
    '.yc-sent .yc-check{font-size:36px;margin-bottom:10px}',
    '.yc-sent h3{font-size:15px;font-weight:700;color:#111827;margin:0 0 6px}',
    '.yc-sent p{font-size:13px;color:#6b7280;line-height:1.6;margin:0 0 18px}',
    '.yc-err{font-size:12px;color:#dc2626;margin-bottom:6px}'
  ].join('');

  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ── State ─────────────────────────────────────────────────────────────
  var state = { open: false, screen: 'home', activeQA: null, sending: false };
  var btn, panel, body;

  // ── Icons ─────────────────────────────────────────────────────────────
  var iconChat = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var iconClose = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  // ── Render ─────────────────────────────────────────────────────────────
  function render() {
    btn.innerHTML = state.open ? iconClose : iconChat;
    panel.style.display = state.open ? 'flex' : 'none';
    if (state.open) renderScreen();
  }

  function renderScreen() {
    body.innerHTML = '';
    if (state.screen === 'home') renderHome();
    else if (state.screen === 'answer') renderAnswer();
    else if (state.screen === 'pakete') renderPakete();
    else if (state.screen === 'contact') renderContact();
    else if (state.screen === 'sent') renderSent();
  }

  function el(tag, props, children) {
    var e = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'className') e.className = props[k];
      else if (k === 'style') e.style.cssText = props[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), props[k]);
      else e[k] = props[k];
    });
    (children || []).forEach(function (c) {
      if (!c) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function btn_(text, cls, onClick) {
    return el('button', { className: 'yc-btn ' + (cls || ''), onClick: onClick }, [text]);
  }

  function renderHome() {
    body.appendChild(el('div', { className: 'yc-bubble' }, [
      'Hallo 👋 Wie können wir helfen?'
    ]));
    QA.forEach(function (qa) {
      body.appendChild(btn_(qa.q, '', function () {
        if (qa.id === 'pakete') {
          state.screen = 'pakete';
        } else {
          state.activeQA = qa;
          state.screen = 'answer';
        }
        renderScreen();
      }));
    });
    body.appendChild(btn_('✉️  Nachricht ans Team schreiben', 'secondary', function () {
      state.screen = 'contact';
      renderScreen();
    }));

    var bookEl = el('a', {
      href: '/#kontakt',
      style: 'display:block;text-align:center;background:#e8173a;color:#fff;border-radius:10px;padding:11px 16px;font-size:13px;font-weight:700;text-decoration:none;margin-top:10px'
    }, ['Kostenloses Erstgespräch buchen →']);
    body.appendChild(bookEl);
  }

  function renderAnswer() {
    var qa = state.activeQA;
    body.appendChild(el('div', { className: 'yc-answer-q' }, [qa.q]));
    body.appendChild(el('div', { className: 'yc-bubble' }, [qa.a]));
    body.appendChild(el('a', {
      href: '/#kontakt',
      style: 'display:block;text-align:center;background:#e8173a;color:#fff;border-radius:10px;padding:11px 16px;font-size:13px;font-weight:700;text-decoration:none;margin-bottom:8px'
    }, ['Kostenloses Gespräch buchen →']));
    body.appendChild(btn_('← Andere Frage', '', function () {
      state.screen = 'home';
      renderScreen();
    }));
    body.appendChild(btn_('Andere Frage nicht dabei? Nachricht ans Team', 'ghost', function () {
      state.screen = 'contact';
      renderScreen();
    }));
  }

  function renderPakete() {
    body.appendChild(el('div', {
      style: 'font-size:13px;font-weight:700;color:#111827;margin-bottom:12px'
    }, ['Unsere Pakete']));

    PAKETE.forEach(function (p) {
      var items = p.items.map(function (i) {
        return el('div', { className: 'yc-pkg-item' }, [i]);
      });
      var children = [
        el('div', { className: 'yc-pkg-name' }, [p.name]),
        el('div', { className: 'yc-pkg-tagline' }, [p.tagline]),
        el('div', { className: 'yc-pkg-price' }, [p.monatlich]),
        el('div', { className: 'yc-pkg-setup' }, [p.setup])
      ];
      if (p.budget) children.push(el('div', { className: 'yc-pkg-budget' }, [p.budget]));
      children = children.concat(items);
      children.push(el('div', { className: 'yc-pkg-breakeven' }, [p.breakeven]));
      body.appendChild(el('div', { className: 'yc-pkg' }, children));
    });

    body.appendChild(el('a', {
      href: '/#kontakt',
      style: 'display:block;text-align:center;background:#e8173a;color:#fff;border-radius:10px;padding:11px 16px;font-size:13px;font-weight:700;text-decoration:none;margin-top:4px;margin-bottom:8px'
    }, ['Kostenloses Erstgespräch buchen →']));
    body.appendChild(btn_('← Zurück', '', function () {
      state.screen = 'home';
      renderScreen();
    }));
  }

  function renderContact() {
    body.appendChild(el('div', {
      style: 'font-size:14px;font-weight:700;color:#111827;margin-bottom:4px'
    }, ['Nachricht ans Team']));
    body.appendChild(el('div', {
      style: 'font-size:13px;color:#6b7280;margin-bottom:14px;line-height:1.5'
    }, ['Wir melden uns schnellstmöglich.']));

    var errEl = el('div', { className: 'yc-err', style: 'display:none' }, ['']);
    var nameEl = el('input', { type: 'text', placeholder: 'Euer Studioname (optional)' });
    var emailEl = el('input', { type: 'email', placeholder: 'E-Mail Adresse *' });
    var msgEl = el('textarea', { rows: 4, placeholder: 'Eure Frage oder Anliegen *' });
    var submitEl = btn_('Nachricht senden', 'primary', function () {
      var email = emailEl.value.trim();
      var msg = msgEl.value.trim();
      if (!email || !msg) {
        errEl.textContent = 'E-Mail und Nachricht sind Pflichtfelder.';
        errEl.style.display = 'block';
        return;
      }
      // mailto fallback — works without backend
      var subject = encodeURIComponent('Anfrage via Chat-Widget — YAD');
      var body_text = encodeURIComponent(
        (nameEl.value.trim() ? 'Studio: ' + nameEl.value.trim() + '\n' : '') +
        'E-Mail: ' + email + '\n\n' + msg
      );
      window.location.href = 'mailto:hello@yad.rocks?subject=' + subject + '&body=' + body_text;
      state.screen = 'sent';
      renderScreen();
    });
    submitEl.style.marginTop = '2px';

    var form = el('div', { className: 'yc-contact-form' }, [
      nameEl, emailEl, msgEl, errEl, submitEl
    ]);
    body.appendChild(form);
    body.appendChild(btn_('← Zurück zu den Fragen', 'ghost', function () {
      state.screen = 'home';
      renderScreen();
    }));
  }

  function renderSent() {
    body.appendChild(el('div', { className: 'yc-sent' }, [
      el('div', { className: 'yc-check' }, ['✓']),
      el('h3', {}, ['Nachricht geöffnet!']),
      el('p', {}, ['Euer E-Mail-Programm öffnet sich. Sendet die Nachricht einfach ab — wir melden uns schnellstmöglich.']),
      el('a', {
        href: '/#kontakt',
        style: 'display:inline-block;background:#e8173a;color:#fff;border-radius:10px;padding:11px 20px;font-size:13px;font-weight:700;text-decoration:none'
      }, ['Lieber direkt ein Gespräch buchen →'])
    ]));
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────
  function init() {
    injectStyles();

    btn = el('button', {
      id: 'yadchat-btn',
      'aria-label': 'Chat öffnen',
      onClick: function () {
        state.open = !state.open;
        if (state.open) state.screen = 'home';
        render();
      }
    }, []);
    btn.innerHTML = iconChat;

    panel = el('div', { id: 'yadchat-panel', style: 'display:none' }, [
      el('div', { id: 'yadchat-head' }, [
        el('div', { className: 'yc-avatar' }, [
          el('span', { innerHTML: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' })
        ]),
        el('div', {}, [
          el('div', { className: 'yc-name' }, ['YAD — Tattoo Studio Marketing']),
          el('div', { className: 'yc-sub' }, ['Antworten sofort · Gespräch in 24h'])
        ])
      ])
    ]);
    body = el('div', { id: 'yadchat-body' });
    panel.appendChild(body);

    document.body.appendChild(btn);
    document.body.appendChild(panel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

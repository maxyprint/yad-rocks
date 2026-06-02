(function () {
  const KEY      = 'yad_analysis';
  const MAX_AGE  = 7 * 24 * 3600 * 1000; // 7 Tage
  const ON_BERICHT = window.location.pathname.includes('bericht');

  // ── Auf bericht.html: State speichern ───────────────────────────────────
  if (ON_BERICHT) {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) {
      const existing = readState();
      if (!existing || existing.id !== id) {
        saveState({ id, studioName: '…', city: '', status: 'pending', savedAt: Date.now() });
      }
      // Auf Statuswechsel horchen (wird von bericht.html getriggert)
      window.addEventListener('yadAnalysisUpdate', (e) => {
        saveState({ id, studioName: e.detail.studioName, city: e.detail.city, status: e.detail.status, savedAt: Date.now() });
      });
    }
    return; // Bubble auf Bericht-Seite selbst nicht zeigen
  }

  // ── Auf allen anderen Seiten: Bubble anzeigen ────────────────────────────
  const state = readState();
  if (!state) return;
  if (Date.now() - state.savedAt > MAX_AGE) { clearState(); return; }

  const isDone    = state.status === 'done';
  const isPending = state.status === 'pending' || state.status === 'processing' || state.status === 'analyzing';

  if (!isDone && !isPending) return;

  const bubble = document.createElement('div');
  bubble.id = 'yadAnalysisBubble';
  bubble.innerHTML = `
    <a href="/bericht?id=${state.id}" class="yab-link">
      <span class="yab-dot ${isDone ? 'done' : 'pulse'}"></span>
      <span class="yab-text">
        <strong>${isDone ? '✓ Report fertig' : 'Analyse läuft…'}</strong>
        <span>${state.studioName && state.studioName !== '…' ? state.studioName : 'Dein Studio'}</span>
      </span>
      <span class="yab-arrow">→</span>
    </a>
    <button class="yab-close" onclick="event.preventDefault();document.getElementById('yadAnalysisBubble').remove()">×</button>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #yadAnalysisBubble {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      display: flex; align-items: center; gap: 0;
      background: #111; border: 1px solid #2a2a2a;
      border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      overflow: hidden; animation: yabSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
    }
    @keyframes yabSlideIn { from { opacity:0; transform: translateY(16px) scale(0.95); } to { opacity:1; transform: none; } }
    .yab-link {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; text-decoration: none; color: #fff;
    }
    .yab-link:hover { background: rgba(255,255,255,0.04); }
    .yab-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }
    .yab-dot.done  { background: #4ade80; }
    .yab-dot.pulse { background: #e8173a; animation: yabPulse 1.2s ease-in-out infinite; }
    @keyframes yabPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .yab-text { display: flex; flex-direction: column; gap: 1px; }
    .yab-text strong { font-size: 13px; font-weight: 700; color: #fff; }
    .yab-text span   { font-size: 11px; color: #666; }
    .yab-arrow { font-size: 16px; color: #444; margin-left: 4px; }
    .yab-close {
      background: none; border: none; color: #444; cursor: pointer;
      padding: 14px 14px 14px 4px; font-size: 18px; line-height: 1;
    }
    .yab-close:hover { color: #fff; }
    @media (max-width: 480px) {
      #yadAnalysisBubble { bottom: 16px; right: 16px; left: 16px; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(bubble);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function readState()  { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
  function saveState(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
  function clearState() { try { localStorage.removeItem(KEY); } catch {} }
})();

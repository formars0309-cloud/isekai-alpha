/* ============ 알파톡 사운드 — Web Audio 합성 (외부 에셋 0개) ============ */
(function () {
  let ctx = null;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (ctx && ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, when, slide) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.12, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  const vib = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

  window.SND = {
    unlock() { ac(); },
    receive() { tone(880, 0.09, "sine", 0.1); tone(1320, 0.14, "sine", 0.08, 0.07); vib(30); },        // 수신 딩동
    send() { tone(520, 0.06, "triangle", 0.09); tone(700, 0.05, "triangle", 0.06, 0.05); },              // 발신 톡
    read() { tone(1560, 0.05, "sine", 0.05); },                                                          // 읽음
    bot() { tone(420, 0.08, "square", 0.045); tone(560, 0.1, "square", 0.04, 0.08); vib(20); },          // 봇 알림
    heart() { tone(660, 0.1, "sine", 0.1); tone(880, 0.1, "sine", 0.09, 0.09); tone(1100, 0.22, "sine", 0.08, 0.18); vib([30, 40, 30]); }, // 호감 상승
    drop() { tone(440, 0.12, "sine", 0.09, 0, 300); tone(300, 0.2, "sine", 0.07, 0.1, 200); },           // 호감 하락
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "triangle", 0.1, i * 0.09)); vib([40, 50, 40, 50, 80]); }, // 엔딩
    card() { tone(700, 0.07, "triangle", 0.08, 0, 900); },                                               // 카드 선택
  };
})();

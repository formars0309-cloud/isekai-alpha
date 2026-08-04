/* ============ 이세계알파남 — 게임 엔진 v0.2 ============ */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rnd = (n) => Math.floor(Math.random() * n);
  const SAVE_KEY = "isekai-alpha-save-v1";
  const HUMANS = ["ely", "luna", "sera"];

  /* ---------------- 상태 ---------------- */
  let S = null;
  function freshDaily() {
    return { str: 0, int: 0, cha: 0, gold: 0, aff: { ely: 0, luna: 0, sera: 0, amor: 0 },
             visits: 0, talked: {}, gifts: 0, locVisited: {}, festUsed: false };
  }
  function freshState() {
    return {
      v: 2, name: "김철수", day: 1, ap: 3, gold: 50,
      stats: { str: 3, int: 4, cha: 2 },
      aff: { ely: 0, luna: 0, sera: 0, amor: 0 },
      chain: { ely: 0, luna: 0, sera: 0, amor: 0 },
      giftDay: { ely: 0, luna: 0, sera: 0 },
      gains: freshDaily(),
      missions: [], missionAllDone: false,
      amor: { unlocked: false, lastDream: 0 },
      cleared: {},
      ended: false,
    };
  }
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} };
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d) return null;
      if (d.v === 1) { // v1 → v2 마이그레이션
        d.v = 2;
        d.aff.amor = 0;
        d.chain.amor = 0;
        d.amor = { unlocked: false, lastDream: 0 };
        d.gains = freshDaily();
        d.missions = []; d.missionAllDone = false;
      }
      if (!d.cleared) d.cleared = {};
      return d.v === 2 ? d : null;
    } catch (e) { return null; }
  }
  const wipe = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };

  /* ---------------- 랭크 ---------------- */
  function alphaScore() {
    const st = S.stats;
    const totalAff = S.aff.ely + S.aff.luna + S.aff.sera + S.aff.amor;
    return Math.round((st.str + st.int + st.cha) / 3 + totalAff / 6);
  }
  function rankOf(score) { return RANKS.find((r) => score >= r.min) || RANKS[RANKS.length - 1]; }
  const isFestival = () => S.day % 7 === 0;

  /* ---------------- 화면 전환 ---------------- */
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
  }

  /* ---------------- 토스트 ---------------- */
  let pendingToasts = [];
  function toast(msg, kind) {
    const wrap = $("toast-wrap");
    const el = document.createElement("div");
    el.className = "toast" + (kind ? " " + kind : "");
    el.textContent = msg;
    wrap.appendChild(el);
    while (wrap.children.length > 3) wrap.removeChild(wrap.firstChild);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 2800);
  }
  function queueToast(msg, kind) { pendingToasts.push([msg, kind]); }
  function flushToasts() {
    pendingToasts.forEach(([m, k], i) => setTimeout(() => toast(m, k), i * 550));
    pendingToasts = [];
  }

  /* ---------------- VN 플레이어 ---------------- */
  let vnQueue = [], vnIdx = 0, vnOnEnd = null, typing = false, typeTimer = null, fullText = "";
  let vnHeroine = null;
  const portraitCache = {};
  function portraitOf(id, emo) {
    const key = id + ":" + (emo || "normal");
    if (!portraitCache[key]) portraitCache[key] = portraitSVG(id, emo);
    return portraitCache[key];
  }
  function fmt(t) { return (t || "").replaceAll("{name}", S.name); }

  function startVN(script, onEnd, bg) {
    vnQueue = script.slice();
    vnIdx = 0;
    vnOnEnd = onEnd || null;
    setBg(bg || "bg-village");
    $("vn-choices").classList.add("hidden");
    show("scr-vn");
    renderNode();
  }
  function setBg(cls) { $("vn-bg").className = "vn-bg " + cls; }

  function renderNode() {
    if (vnIdx >= vnQueue.length) { endVN(); return; }
    const node = vnQueue[vnIdx];
    if (node.bg) setBg(node.bg);
    if (node.choices) { showChoices(node.choices); return; }

    const nameEl = $("vn-name"), textEl = $("vn-text"), pEl = $("vn-portrait");
    nameEl.classList.remove("hidden");
    textEl.className = "vn-text";
    let text = "";

    if (node.sp) {
      const m = CHAR_META[node.sp];
      nameEl.textContent = m.name;
      nameEl.className = "vn-name " + m.cls;
      pEl.innerHTML = portraitOf(node.sp, node.emo);
      pEl.style.opacity = "1";
      text = fmt(node.t);
    } else if (node.mc !== undefined) {
      nameEl.textContent = S.name;
      nameEl.className = "vn-name c-mc";
      pEl.style.opacity = "0.3";
      text = fmt(node.mc);
    } else if (node.sys !== undefined) {
      nameEl.textContent = "알파 시스템";
      nameEl.className = "vn-name c-sys";
      pEl.style.opacity = "0.3";
      textEl.classList.add("t-sys");
      text = "[" + fmt(node.sys) + "]";
    } else {
      nameEl.classList.add("hidden");
      pEl.style.opacity = "0.3";
      textEl.classList.add("t-narr");
      text = fmt(node.narr);
    }
    typewrite(textEl, text);
  }

  function typewrite(el, text) {
    clearInterval(typeTimer);
    fullText = text;
    typing = true;
    el.textContent = "";
    let i = 0;
    typeTimer = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(typeTimer); typing = false; }
    }, 16);
  }

  function advance() {
    if (!$("vn-choices").classList.contains("hidden")) return;
    if (typing) { clearInterval(typeTimer); $("vn-text").textContent = fullText; typing = false; return; }
    vnIdx++;
    renderNode();
  }

  function showChoices(choices) {
    const box = $("vn-choices");
    box.innerHTML = "";
    choices.forEach((c) => {
      const ok = checkReq(c.req);
      const btn = document.createElement("button");
      btn.className = "choice-btn " + (ok ? (c.req ? "ok" : "") : "locked");
      let html = fmt(c.t);
      if (c.req) {
        const label = c.req.stat ? STAT_META[c.req.stat].name + " " + c.req.val : c.req.gold + "G";
        html += `<span class="req">${ok ? "✦ " + label : "🔒 " + label + " 필요"}</span>`;
      }
      btn.innerHTML = html;
      if (ok) btn.onclick = (e) => { e.stopPropagation(); pickChoice(c); };
      box.appendChild(btn);
    });
    box.classList.remove("hidden");
  }

  function pickChoice(c) {
    $("vn-choices").classList.add("hidden");
    if (c.action) c.action();
    if (c.heroine !== undefined) vnHeroine = c.heroine;
    if (c.cost) S.gold = Math.max(0, S.gold - c.cost);
    if (c.aff && vnHeroine) addAff(vnHeroine, c.aff);
    const rest = vnQueue.slice(vnIdx + 1);
    vnQueue = vnQueue.slice(0, vnIdx + 1).concat(c.then || [], rest);
    vnIdx++;
    renderNode();
  }

  function checkReq(req) {
    if (!req) return true;
    if (req.gold !== undefined) return S.gold >= req.gold;
    if (req.stat) return S.stats[req.stat] >= req.val;
    return true;
  }

  function endVN() {
    const cb = vnOnEnd; vnOnEnd = null;
    if (cb) cb(); else goHub();
  }

  /* ---------------- 스탯/호감도 ---------------- */
  function gainStat(key, amount) {
    const before = rankOf(alphaScore()).code;
    S.stats[key] = Math.min(100, S.stats[key] + amount);
    S.gains[key] += amount;
    const after = rankOf(alphaScore());
    if (after.code !== before) queueToast("알파 등급 상승! → " + after.code + " · " + after.label, "gold");
    checkAmorUnlock();
  }
  function addAff(h, amount) {
    const before = S.aff[h];
    S.aff[h] = Math.min(100, S.aff[h] + amount);
    S.gains.aff[h] += S.aff[h] - before;
    if (before < 100 && S.aff[h] >= 100) {
      const msg = h === "amor" ? "오늘 밤, 꿈이 당신을 기다립니다." : pick(SNARK.affMax);
      queueToast("♥ " + CHAR_META[h].name + " — " + msg, "pink");
    }
    checkAmorUnlock();
    save();
  }
  function checkAmorUnlock() {
    if (!S.amor.unlocked && alphaScore() >= 50) {
      S.amor.unlocked = true;
      queueToast("…누군가, 당신을 지켜보고 있습니다. 오늘 밤 좋은 꿈을.", "pink");
    }
  }
  function markTalked(h) { if (h && HUMANS.includes(h)) S.gains.talked[h] = 1; }

  /* ---------------- 일일 미션 ---------------- */
  function genMissions() {
    const chosen = [];
    const add = (m) => {
      if (m && !chosen.some((x) => x.id === m.id))
        chosen.push({ id: m.id, label: m.label, key: m.key, type: m.type, target: m.target || 1, done: false });
    };
    add(pick(MISSION_POOL.stat));
    const talkable = MISSION_POOL.talk.filter((m) => S.aff[m.key] < 100);
    if (talkable.length) add(pick(talkable));
    let guard = 0;
    while (chosen.length < 3 && guard++ < 30) add(pick(MISSION_POOL.etc));
    S.missions = chosen;
    S.missionAllDone = false;
  }
  function missionProgress(m) {
    if (m.key && ["str", "int", "cha"].includes(m.key)) return S.gains[m.key];
    if (m.key && HUMANS.includes(m.key)) return S.gains.talked[m.key] ? 1 : 0;
    if (m.type === "earn") return S.gains.gold;
    if (m.type === "visits") return S.gains.visits;
    if (m.type === "loc") return S.gains.locVisited[m.key] ? 1 : 0;
    if (m.type === "gift") return S.gains.gifts;
    return 0;
  }
  function checkMissions() {
    if (!S.missions.length) return;
    S.missions.forEach((m) => {
      if (!m.done && missionProgress(m) >= m.target) {
        m.done = true;
        S.gold += 25;
        queueToast("📜 미션 완료: " + m.label + " (+25G)", "gold");
      }
    });
    if (!S.missionAllDone && S.missions.every((m) => m.done)) {
      S.missionAllDone = true;
      S.ap += 1;
      queueToast("📜 오늘의 미션 전부 완료! 보너스 행동력 +1 ⚡", "gold");
    }
  }
  function renderMissions() {
    const box = $("q-list");
    if (!box) return;
    box.innerHTML = S.missions.map((m) => {
      const p = Math.min(missionProgress(m), m.target);
      const prog = m.target > 1 ? ` <span class="q-prog">${p}/${m.target}</span>` : "";
      return `<div class="q-item ${m.done ? "done" : ""}">${m.done ? "☑" : "☐"} ${m.label}${prog}</div>`;
    }).join("");
    $("q-bonus").textContent = S.missionAllDone ? "보너스 지급 완료" : "전부 완료 시 ⚡+1";
  }

  /* ---------------- 허브 ---------------- */
  function goHub() {
    checkMissions();
    show("scr-hub");
    renderHud();
    renderLocs();
    renderMissions();
    flushToasts();
    save();
  }
  function renderHud() {
    $("hud-day").textContent = S.day;
    $("hud-ap").textContent = S.ap;
    $("hud-gold").textContent = S.gold;
    $("hud-rank").textContent = rankOf(alphaScore()).code;
    $("hub-greet").textContent = isFestival() && !S.gains.festUsed ? FEST_GREET : GREETS[(S.day - 1) % GREETS.length];
  }
  function renderLocs() {
    const list = $("loc-list");
    list.innerHTML = "";
    if (isFestival() && !S.gains.festUsed) {
      const fest = document.createElement("div");
      fest.className = "loc-card fest";
      fest.innerHTML = `<div class="ico">🎪</div>
        <div class="txt"><div class="nm">달빛 축제 광장</div><div class="ds">7일마다 열리는 축제 · 데이트 찬스!</div></div>
        <div class="cost">무료</div><span class="evdot"></span>`;
      fest.onclick = openFestival;
      list.appendChild(fest);
    }
    LOCATIONS.forEach((loc) => {
      const card = document.createElement("div");
      card.className = "loc-card";
      let dot = "";
      if (loc.heroine) {
        const h = loc.heroine;
        if (S.aff[h] >= 100 && S.chain[h] >= EVENTS[h].length) { card.classList.add("heart-max"); dot = `<span class="evdot"></span>`; }
        else {
          const next = EVENTS[h][S.chain[h]];
          if (next && meetsEventReq(next.req, h)) dot = `<span class="evdot"></span>`;
        }
      }
      const cost = loc.id === "salon" ? "⚡1 · 20G" : "⚡1";
      card.innerHTML = `<div class="ico">${loc.ico}</div>
        <div class="txt"><div class="nm">${loc.name}</div><div class="ds">${loc.desc}</div></div>
        <div class="cost">${cost}</div>${dot}`;
      card.onclick = () => visit(loc);
      list.appendChild(card);
    });
  }
  function meetsEventReq(req, h) {
    if (!req) return true;
    if (req.aff !== undefined && S.aff[h] < req.aff) return false;
    if (req.stat && S.stats[req.stat.key] < req.stat.val) return false;
    return true;
  }

  /* ---------------- 방문 ---------------- */
  function statRoll(base) {
    const crit = Math.random() < 0.15;
    return { n: crit ? base * 2 : base, crit };
  }
  function visit(loc) {
    if (S.ended) return;
    if (S.ap <= 0) { toast(pick(SNARK.noAp)); return; }
    if (loc.id === "salon" && S.gold < 20) { toast(pick(SNARK.broke), "gold"); return; }
    S.ap--;
    S.gains.visits++;
    S.gains.locVisited[loc.id] = 1;

    if (loc.id === "training") { const r = statRoll(2 + rnd(3)); gainStat("str", r.n); queueToast(pick(FLAVOR.training) + "  (근력 +" + r.n + ")"); if (r.crit) queueToast(pick(CRIT_LINES), "gold"); else maybeSnark(); }
    if (loc.id === "library")  { const r = statRoll(2 + rnd(3)); gainStat("int", r.n); queueToast(pick(FLAVOR.library) + "  (지능 +" + r.n + ")"); if (r.crit) queueToast(pick(CRIT_LINES), "gold"); else maybeSnark(); }
    if (loc.id === "salon")    { const r = statRoll(3 + rnd(3)); S.gold -= 20; gainStat("cha", r.n); queueToast(pick(FLAVOR.salon) + "  (매력 +" + r.n + ", -20G)"); if (r.crit) queueToast(pick(CRIT_LINES), "gold"); }
    if (loc.id === "guild")    { const r = statRoll(25 + rnd(31)); S.gold += r.n; S.gains.gold += r.n; queueToast(pick(FLAVOR.guild) + "  (+" + r.n + "G)"); if (r.crit) queueToast("【대성공】 오늘 일당이 두 배! 길드장이 당신을 눈여겨봅니다.", "gold"); }
    if (loc.id === "inn")      { const n = 1 + rnd(2); gainStat("cha", n); queueToast("따뜻한 식사로 마음의 여유가 생겼다. (매력 +" + n + ")"); }

    const h = loc.heroine;
    if (h) {
      vnHeroine = h;
      markTalked(h);
      if (S.aff[h] >= 100 && S.chain[h] >= EVENTS[h].length) { offerConfession(h, loc); return; }
      const next = EVENTS[h][S.chain[h]];
      if (next && meetsEventReq(next.req, h)) {
        startVN(next.script, () => {
          S.chain[h]++;
          addAff(h, 5);
          queueToast("♥ " + CHAR_META[h].name + " 호감도 상승 (" + S.aff[h] + "/100)", "pink");
          vnHeroine = null;
          goHub();
        }, loc.bg);
        return;
      }
      const line = pick(SMALLTALK[h]);
      startVN([{ sp: h, emo: pick(["normal", "happy"]), t: line }], () => {
        addAff(h, 2);
        queueToast("♥ " + CHAR_META[h].name + " 호감도 +2 (" + S.aff[h] + "/100)", "pink");
        vnHeroine = null;
        goHub();
      }, loc.bg);
      return;
    }

    // 길드/미용실 — 랜덤 조우 & 사건
    if (Math.random() < 0.32) {
      const roll = Math.random();
      if (roll < 0.45) { // 히로인 조우
        const cands = HUMANS.filter((x) => S.aff[x] < 100);
        const mh = cands.length ? pick(cands) : pick(HUMANS);
        vnHeroine = mh;
        markTalked(mh);
        startVN([{ sp: mh, emo: pick(["normal", "blush", "happy"]), t: pick(MEET_LINES[mh]) }], () => {
          addAff(mh, 3);
          queueToast("♥ 우연한 만남! " + CHAR_META[mh].name + " 호감도 +3 (" + S.aff[mh] + "/100)", "pink");
          vnHeroine = null;
          goHub();
        }, loc.bg);
        return;
      } else if (roll < 0.70) {
        const ev = pick(LUCKY);
        S.gold += ev.gold;
        S.gains.gold += ev.gold;
        queueToast("🍀 " + ev.t + " (+" + ev.gold + "G)", "gold");
      } else if (roll < 0.82) {
        const ev = pick(UNLUCKY);
        S.gold = Math.max(0, S.gold + ev.gold);
        queueToast("💧 " + ev.t + " (" + ev.gold + "G)");
      } else {
        const ev = pick(DAILY_EVENTS);
        if (ev.stat) { gainStat(ev.stat, 1); queueToast("✨ " + ev.t + " (" + STAT_META[ev.stat].name + " +1)"); }
        else queueToast("✨ " + ev.t);
      }
    }
    goHub();
  }
  function maybeSnark() { if (Math.random() < 0.35) queueToast("알파 시스템: " + pick(SNARK.statUp)); }

  /* ---------------- 달빛 축제 ---------------- */
  function openFestival() {
    if (S.gains.festUsed) return;
    S.gains.festUsed = true;
    const choices = HUMANS.filter((h) => S.aff[h] >= 15).map((h) => ({
      t: CHAR_META[h].name + "에게 데이트 신청 (30G)",
      req: { gold: 30 }, cost: 30, heroine: h, aff: 12, then: FESTIVAL[h],
    }));
    choices.push({
      t: "혼자 축제를 즐긴다",
      heroine: S.amor.unlocked ? "amor" : null,
      aff: S.amor.unlocked ? 5 : 0,
      then: FESTIVAL.solo,
    });
    const intro = [
      { narr: "광장에 등불이 물결친다. 일 년 중 가장 밝은 밤, 달빛 축제가 시작됐다.", bg: "bg-night" },
      { sys: "달빛 축제 개최 중. 오늘의 동행을 선택하십시오. 이런 날 혼자여도… 뭐, 그것도 낭만입니다." },
      { choices },
    ];
    vnHeroine = null;
    startVN(intro, () => {
      if (vnHeroine && HUMANS.includes(vnHeroine)) {
        markTalked(vnHeroine);
        queueToast("♥ " + CHAR_META[vnHeroine].name + "와의 축제 데이트! (" + S.aff[vnHeroine] + "/100)", "pink");
      }
      vnHeroine = null;
      goHub();
    }, "bg-night");
  }

  /* ---------------- 꿈 (아모르시아 루트) ---------------- */
  function maybeDream() {
    if (!S.amor.unlocked || S.ended) return false;
    if (S.aff.amor >= 100 && S.chain.amor >= AMOR_EVENTS.length) {
      vnHeroine = "amor";
      confessing = false;
      startVN([
        { sys: "여신의 마음이 한계에 도달했습니다. 오늘 밤 꿈에서 답하면 엔딩으로 이어집니다." },
        { choices: [
          { t: "💍 꿈에서 답한다 — 아모르시아 엔딩", action: () => { confessing = true; }, then: AMOR_CONFESS.script },
          { t: "…조금만 더, 이 꿈을 이어가고 싶다.", then: [
            { sp: "amor", emo: "shy", t: "…후후, 알았어요. 오늘은 그냥, 평범한 꿈으로 할게요. …도망치는 건 아니죠?" },
          ] },
        ] },
      ], () => {
        vnHeroine = null;
        if (confessing) { S.cleared.amor = 1; save(); showEnding("amor", AMOR_CONFESS.quote); }
        else goHub();
      }, "bg-void");
      return true;
    }
    if (S.day - S.amor.lastDream < 2) return false;
    S.amor.lastDream = S.day;
    vnHeroine = "amor";
    const next = AMOR_EVENTS[S.chain.amor];
    if (next && S.aff.amor >= next.req.aff) {
      startVN(next.script, () => {
        S.chain.amor++;
        addAff("amor", 12);
        queueToast("♥ 아모르시아와의 꿈 (" + S.aff.amor + "/100)", "pink");
        vnHeroine = null;
        goHub();
      }, "bg-void");
    } else {
      startVN([{ sp: "amor", emo: pick(["happy", "normal"]), t: pick(AMOR_DREAMTALK) }], () => {
        addAff("amor", 8);
        queueToast("♥ 아모르시아와의 꿈 (" + S.aff.amor + "/100)", "pink");
        vnHeroine = null;
        goHub();
      }, "bg-void");
    }
    return true;
  }

  /* ---------------- 고백/엔딩 ---------------- */
  let confessing = false;
  function offerConfession(h, loc) {
    const data = CONFESS[h];
    confessing = false;
    vnHeroine = h;
    startVN([
      { sys: CHAR_META[h].name + "의 호감도가 한계에 도달했습니다. 지금 마음을 전하면 엔딩으로 이어집니다. 각오는 되셨습니까." },
      { choices: [
        { t: "💍 마음을 전한다 — " + CHAR_META[h].name + " 엔딩", action: () => { confessing = true; }, then: data.script },
        { t: "…아직은. 조금 더 함께하고 싶다.", then: [
          { narr: "두근거리는 마음을 가슴에 눌러 담고, 다음을 기약했다." },
          { sys: "고백 보류. 마음이 도망가지는 않습니다. 언제든 다시 찾아가십시오." },
        ] },
      ] },
    ], () => {
      vnHeroine = null;
      if (confessing) { S.cleared[h] = 1; save(); showEnding(h, data.quote); }
      else goHub();
    }, loc.bg);
  }
  function showEnding(h, quote) {
    $("ending-portrait").innerHTML = portraitOf(h, "blush");
    $("ending-heroine").textContent = CHAR_META[h].name + " · " + CHAR_META[h].title;
    $("ending-quote").textContent = quote;
    const st = S.stats;
    $("ending-stats").innerHTML =
      `<span class="chip">DAY <b>${S.day}</b></span>` +
      `<span class="chip">근력 <b>${st.str}</b></span>` +
      `<span class="chip">지능 <b>${st.int}</b></span>` +
      `<span class="chip">매력 <b>${st.cha}</b></span>` +
      `<span class="chip">♥ <b>${S.aff[h]}</b></span>`;
    show("scr-ending");
  }

  /* ---------------- 상태창 ---------------- */
  function heroineCard(h) {
    const m = CHAR_META[h], a = S.aff[h];
    const hearts = "♥".repeat(Math.floor(a / 20)) + "♡".repeat(5 - Math.floor(a / 20));
    const card = document.createElement("div");
    card.className = "hr-card";
    let btnHtml;
    if (h === "amor") {
      btnHtml = `<span class="amor-note">꿈에서<br>만나는 사이</span>`;
    } else {
      const gifted = S.giftDay[h] === S.day;
      const disabled = gifted || S.gold < 50 || a >= 100;
      btnHtml = `<button class="gift-btn" ${disabled ? "disabled" : ""}>${gifted ? "선물 완료" : "🌹 꽃 선물 (50G)"}</button>`;
    }
    card.innerHTML = `<div class="pfp">${portraitOf(h, a >= 60 ? "happy" : "normal")}</div>
      <div class="info"><div class="hnm">${m.name}<small>${m.title} · ${m.likes === "?" ? "꿈의 인연" : m.likes + "에 끌림"}</small></div>
      <div class="hearts">${hearts}<span class="aff-num">${a}/100</span></div></div>${btnHtml}`;
    const gb = card.querySelector(".gift-btn");
    if (gb) gb.onclick = () => giveGift(h);
    return card;
  }
  function openStatus() {
    $("st-name").textContent = S.name;
    const r = rankOf(alphaScore());
    $("st-rank").textContent = r.code + " · " + r.label;
    const stEl = $("st-stats");
    stEl.innerHTML = "";
    ["str", "int", "cha"].forEach((k) => {
      const m = STAT_META[k], v = S.stats[k];
      stEl.innerHTML += `<div class="st-row"><span class="lb">${m.name}</span>
        <div class="bar"><div class="fill ${m.cls}" style="width:${v}%"></div></div>
        <span class="vl">${v}</span></div>`;
    });
    stEl.innerHTML += `<p class="st-gold">재력 — 보유 골드 <b>${S.gold}G</b></p>`;

    const hrEl = $("st-heroines");
    hrEl.innerHTML = "";
    HUMANS.forEach((h) => hrEl.appendChild(heroineCard(h)));
    if (S.amor.unlocked) hrEl.appendChild(heroineCard("amor"));
    else if (alphaScore() >= 35) {
      const t = document.createElement("div");
      t.className = "hr-card teaser";
      t.innerHTML = `<div class="pfp mystery">?</div><div class="info"><div class="hnm">???</div>
        <div class="hearts" style="color:var(--dim)">어디선가, 시선이 느껴진다…</div></div>`;
      hrEl.appendChild(t);
    }
    $("modal-status").classList.remove("hidden");
  }
  function giveGift(h) {
    if (S.giftDay[h] === S.day || S.gold < 50 || S.aff[h] >= 100) return;
    S.gold -= 50;
    S.giftDay[h] = S.day;
    S.gains.gifts++;
    markTalked(h);
    addAff(h, 8);
    toast(CHAR_META[h].name + ": " + GIFT_LINES[h], "pink");
    checkMissions();
    flushToasts();
    openStatus();
    renderHud();
    renderLocs();
    renderMissions();
  }

  /* ---------------- 하루 마무리 ---------------- */
  function sleepDay() {
    if (S.ended) return;
    const g = S.gains;
    $("sum-day").textContent = "DAY " + S.day + " 종료";
    const lines = [];
    if (g.str) lines.push(["근력", "+" + g.str]);
    if (g.int) lines.push(["지능", "+" + g.int]);
    if (g.cha) lines.push(["매력", "+" + g.cha]);
    if (g.gold) lines.push(["골드 수입", "+" + g.gold + "G"]);
    ["ely", "luna", "sera", "amor"].forEach((h) => { if (g.aff[h]) lines.push([CHAR_META[h].name + " 호감도", "+" + g.aff[h]]); });
    const doneCnt = S.missions.filter((m) => m.done).length;
    if (S.missions.length) lines.push(["알파 미션", doneCnt + "/" + S.missions.length + " 완료"]);
    if (!lines.length) lines.push(["오늘의 성과", "휴식도 성과다"]);
    $("sum-body").innerHTML = lines.map(([k, v]) => `<div class="sum-line"><span class="k">${k}</span><span class="v up">${v}</span></div>`).join("");
    $("sum-snark").textContent = "알파 시스템: " + pick(SNARK.sleep);
    $("modal-summary").classList.remove("hidden");
  }
  function nextDay() {
    $("modal-summary").classList.add("hidden");
    S.day++;
    S.ap = 3;
    S.gains = freshDaily();
    genMissions();
    save();
    if (!maybeDream()) goHub();
  }

  /* ---------------- 시작 흐름 ---------------- */
  function newGame() {
    S = freshState();
    $("inp-name").value = "";
    show("scr-naming");
    setTimeout(() => $("inp-name").focus(), 100);
  }
  function confirmName() {
    const v = $("inp-name").value.trim();
    S.name = v || "김철수";
    genMissions();
    save();
    startVN(OPENING, () => {
      queueToast("알파 시스템: 성장을 시작하십시오. 등급 F 탈출이 급선무입니다.");
      queueToast("📜 오늘의 알파 미션이 발급되었습니다. 허브 상단을 확인하십시오.");
      goHub();
    }, "bg-city");
  }

  /* ---------------- 바인딩 ---------------- */
  function bind() {
    $("btn-newgame").onclick = newGame;
    $("btn-continue").onclick = () => {
      S = load();
      if (!S) return;
      if (!S.missions.length) genMissions();
      goHub();
    };
    $("btn-name-ok").onclick = confirmName;
    $("inp-name").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmName(); });
    $("scr-vn").addEventListener("click", advance);
    $("btn-status").onclick = openStatus;
    $("btn-sleep").onclick = sleepDay;
    $("btn-sum-ok").onclick = nextDay;
    $("btn-restart").onclick = () => location.reload();
    document.querySelectorAll(".modal-close").forEach((b) => {
      b.onclick = () => $(b.dataset.close).classList.add("hidden");
    });
    $("modal-status").addEventListener("click", (e) => { if (e.target.id === "modal-status") e.target.classList.add("hidden"); });

    const saved = load();
    if (saved && !saved.ended) $("btn-continue").classList.remove("hidden");

    if (location.search.includes("debug=1")) {
      const d = document.createElement("div");
      d.style.cssText = "position:absolute;top:60px;left:8px;z-index:99;display:flex;flex-direction:column;gap:4px;";
      [["스탯+10", () => { ["str", "int", "cha"].forEach((k) => gainStat(k, 10)); S.gold += 100; goHub(); }],
       ["호감+20", () => { ["ely", "luna", "sera", "amor"].forEach((h) => addAff(h, 20)); goHub(); }],
       ["AP+3", () => { S.ap = 3; goHub(); }],
       ["날짜+1", () => { S.day++; S.ap = 3; S.gains = freshDaily(); genMissions(); if (!maybeDream()) goHub(); }]]
      .forEach(([t, fn]) => {
        const b = document.createElement("button");
        b.textContent = t;
        b.style.cssText = "font-size:10px;padding:4px 6px;opacity:.6;background:#222;color:#9fd0ff;border:1px solid #345;border-radius:6px;";
        b.onclick = fn;
        d.appendChild(b);
      });
      document.getElementById("app").appendChild(d);
    }
  }

  document.addEventListener("DOMContentLoaded", bind);
})();

/* ============ 알파톡 MVP — 메신저 엔진 v2 (리뷰 반영) ============ */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const SAVE_KEY = "alphatalk-save-v1";
  const DEBUG = location.search.includes("debug=1");
  const SUCCESS_LINE = 55;
  const MOOD_MATCH = { proud: "wit", lonely: "bold", tired: "care" };
  // 날짜별 호감도 가중치 — 초반은 천천히, 후반은 크게 기운다
  const AFF_GAIN = {
    1: { hit: 5,  miss: 2 }, 2: { hit: 6,  miss: 3 }, 3: { hit: 8,  miss: 4 },
    4: { hit: 9,  miss: 4 }, 5: { hit: 11, miss: 5 }, 6: { hit: 13, miss: 6 },
    7: { hit: 13, miss: 6 },
  };
  const TAIL = 14; // 항상 보이는 최근 메시지 수
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------------- 상태 ---------------- */
  let S = null;
  function freshState() {
    return {
      v: 1, name: "김철수", day: 1, phase: "morning",
      stats: { str: 0, int: 0 }, gold: 0, aff: 5, suit: false,
      flags: {}, seq: 0, mNoteDay: 0, hintShown: false,
      style: { bold: 0, wit: 0, care: 0 }, scout: "none", hits: 0, misses: 0,
      ai: { memos: [], fails: 0, lastError: null, used: 0 },
      clkDay: 0, clkPhase: "", clkCur: 0,
      rooms: {
        ely: { msgs: [], unread: 0, status: "검(劍)은 거짓말하지 않는다.", emo: "normal", time: "" },
        bot: { msgs: [], unread: 0, time: "" },
      },
      pending: [],
      pendingChoices: null,
      nightOpened: false, ignoredNight: false,
      milestones: {}, ended: null,
    };
  }
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} };
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d || d.v !== 1) return null;
      d.flags = d.flags || {};
      d.seq = d.seq || 0;
      d.mNoteDay = d.mNoteDay || 0;
      d.style = d.style || { bold: 0, wit: 0, care: 0 };
      d.scout = d.scout || "none";
      d.ai = d.ai || { memos: [], fails: 0, lastError: null, used: 0 };
      // 이어하기 시 잔존 '1' 정리 (read1 타이머 클로저 소실 대비)
      d.rooms.ely.msgs.forEach((m) => { if (m.read1) m.read1 = false; });
      return d;
    } catch (e) { return null; }
  }
  const wipe = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };
  const fmt = (t) => (t || "").replaceAll("{name}", S.name).replaceAll("{aff}", String(S.aff));

  /* ---------------- 화면 ---------------- */
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
  }
  // 하루 안에서 시각은 앞으로만 흐른다 (메시지마다 난수를 뽑으면 시간이 거꾸로 간다)
  function clock() {
    const START = { morning: 8 * 60 + 12, day: 14 * 60 + 5, night: 21 * 60 + 20, done: 21 * 60 + 20 };
    const base = START[S.phase] !== undefined ? START[S.phase] : 8 * 60;
    if (S.clkDay !== S.day || S.clkPhase !== S.phase || typeof S.clkCur !== "number") {
      S.clkDay = S.day; S.clkPhase = S.phase; S.clkCur = base;
    }
    S.clkCur += rnd(1, 4);
    const h = Math.floor(S.clkCur / 60) % 24, m = S.clkCur % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  /* ---------------- 호감도 ---------------- */
  function addAff(n) {
    const before = S.aff;
    S.aff = Math.max(0, Math.min(100, S.aff + n));
    if (n > 0) SND.heart(); else if (n < 0) SND.drop();
    Object.keys(AFF_MILESTONES).forEach((m) => {
      const th = Number(m);
      if (before < th && S.aff >= th && !S.milestones[m]) {
        S.milestones[m] = 1;
        botMsg(AFF_MILESTONES[m]);
      }
    });
    save();
  }

  /* ---------------- 봇 방 ---------------- */
  function botMsg(t) {
    S.rooms.bot.msgs.push({ who: "bot", t: fmt(t), time: clock(), d: S.day });
    S.rooms.bot.unread++;
    S.rooms.bot.time = "지금";
    SND.bot();
    save();
    if (currentRoom === "bot") renderRoomMsgs("bot");
    renderHome();
  }

  /* ---------------- 표시 가능 노드 판정 / 비표시 노드 소비 ---------------- */
  const hasVisible = () =>
    !!S.pendingChoices ||
    S.pending.some((n) => n.e !== undefined || n.me !== undefined || n.c !== undefined ||
      n.note !== undefined || n.choices || n.branch);
  let flushing = false;
  function flushInvisible() {
    if (flushing || currentRoom === "ely") return;
    flushing = true;
    while (S.pending.length) {
      const n = S.pending[0];
      if (n.bot !== undefined) { S.pending.shift(); botMsg(n.bot); }
      else if (n.aff !== undefined) { S.pending.shift(); addAff(n.aff); }
      else break;
    }
    if (!S.pending.length && !S.pendingChoices && S.phase === "night") S.phase = "done";
    flushing = false;
    save();
  }

  /* ---------------- 홈 ---------------- */
  let currentRoom = null;
  let sleepArmed = false, sleepArmTimer = null;
  function goHome() {
    currentRoom = null;
    show("scr-home");
    renderHome();
    save();
  }
  function renderHome() {
    flushInvisible();
    const dleft = 7 - S.day;
    $("dday").textContent = dleft <= 0 ? "건국제 무도회 D-DAY" : "건국제 무도회 D-" + dleft;
    const phaseLabel = { morning: "아침", day: "낮", night: "밤", done: "밤 · 소등 전" }[S.phase] || "";
    $("day-banner").textContent = "DAY " + S.day + " · " + phaseLabel;

    const list = $("room-list");
    list.innerHTML = "";
    const ely = S.rooms.ely;
    const incomingCnt = countIncoming();
    const elyUnread = ely.unread + incomingCnt;
    const lastEly = ely.msgs.length ? ely.msgs[ely.msgs.length - 1] : null;
    const preview = S.pendingChoices ? "엘리시아가 답장을 기다리고 있다…"
      : incomingCnt > 0 ? "새로운 메시지가 도착했다"
      : lastEly ? (lastEly.who === "me" ? "나: " : "") + lastEly.t : "…";
    list.appendChild(roomCard("ely", "엘리시아", P.title, preview, ely.time, elyUnread));
    const bot = S.rooms.bot;
    const lastBot = bot.msgs.length ? bot.msgs[bot.msgs.length - 1].t : "…";
    list.appendChild(roomCard("bot", "알파 시스템", "관전 봇", lastBot, bot.time, bot.unread));

    const morningWait = S.phase === "morning" && hasVisible();
    $("home-stats").innerHTML =
      `근력 <b>${S.stats.str}</b> · 지능 <b>${S.stats.int}</b> · 🪙 <b>${S.gold}G</b>` +
      (AI.enabled() ? ` <span class="ai-on">✨AI</span>` : "") +
      `<br><span class="hint">${generating
        ? "✨ 엘리시아가 보낼 말을 고르고 있다…"
        : morningWait
        ? "💬 엘리시아의 메시지를 모두 확인하면 일과를 정할 수 있다"
        : "호감도·판정 지수는 [알파 시스템] 채널에서만 중계됩니다"}</span>`;

    const morningDone = S.phase === "morning" && !hasVisible() && !generating;
    $("btn-daycard").classList.toggle("hidden", !morningDone);
    const nightPhase = S.phase === "night" || S.phase === "done";
    const nightUnfinished = S.phase === "night" && hasVisible();
    $("btn-sleep").classList.toggle("hidden", !nightPhase || S.day >= 7);
    $("btn-sleep").textContent = sleepArmed
      ? "⚠️ 정말 잔다? (호감도가 내려간다)"
      : nightUnfinished ? "🌙 (읽지 않은 메시지가 있다) 그냥 잔다" : "🌙 하루 마무리";
  }
  function countIncoming() {
    if (currentRoom === "ely") return 0;
    let n = S.pendingChoices ? 1 : 0;
    for (const node of S.pending) {
      if (node.e !== undefined || node.c !== undefined || node.me !== undefined || node.note !== undefined) n++;
      if (node.branch) n++;
      if (node.choices) break;
    }
    return Math.max(n, (S.pending.length || S.pendingChoices) ? 1 : 0);
  }
  function roomCard(id, nm, sub, preview, time, unread) {
    const el = document.createElement("div");
    el.className = "room";
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    const avatar = id === "ely"
      ? `<div class="avatar">${portraitSVG("ely", S.rooms.ely.emo)}</div>`
      : `<div class="avatar">📱</div>`;
    el.innerHTML = `${avatar}
      <div class="info"><div class="nm">${nm}<small>${sub}</small></div>
      <div class="preview"></div></div>
      <div class="meta"><div class="time">${time || ""}</div>${unread > 0 ? `<div class="badge">${unread}</div>` : ""}</div>`;
    el.querySelector(".preview").textContent = preview;
    el.onclick = () => openRoom(id);
    el.onkeydown = (e) => { if (e.key === "Enter") openRoom(id); };
    return el;
  }

  /* ---------------- 채팅방 ---------------- */
  let playToken = 0;
  function openRoom(id) {
    currentRoom = id;
    show("scr-chat");
    bindBack();
    if (id === "ely") {
      $("chat-name").textContent = "엘리시아";
      $("chat-status").textContent = S.rooms.ely.status;
      $("chat-avatar").innerHTML = portraitSVG("ely", S.rooms.ely.emo);
      if (!S.hintShown) {
        S.hintShown = true;
        S.rooms.ely.msgs.push({ who: "note", t: "💡 화면을 탭하면 대화가 빨라진다" });
      }
      renderRoomMsgs("ely");
      S.rooms.ely.unread = 0;
      if (S.phase === "night" || S.phase === "done") S.nightOpened = true;
      if (S.pendingChoices) showReplies(S.pendingChoices);
      else { hideReplies(); playScript(); }
    } else {
      $("chat-name").textContent = "알파 시스템";
      $("chat-status").textContent = "당신의 성장을 중계합니다";
      $("chat-avatar").innerHTML = "📱";
      renderRoomMsgs("bot");
      S.rooms.bot.unread = 0;
      hideReplies();
    }
    save();
  }
  let showAllDays = false;
  function renderRoomMsgs(id) {
    const list = $("msg-list");
    list.innerHTML = "";
    const msgs = S.rooms[id].msgs;
    // 날짜가 아니라 개수로 접는다 — 새 날에도 어제 대화의 끝자락이 항상 보인다
    const start = showAllDays ? 0 : Math.max(0, msgs.length - TAIL);
    if (start > 0) {
      const btn = document.createElement("button");
      btn.className = "day-fold";
      btn.textContent = `▲ 이전 대화 ${start}개 더 보기`;
      btn.onclick = () => { showAllDays = true; renderRoomMsgs(id); };
      list.appendChild(btn);
    }
    let lastDay = start > 0 ? (msgs[start - 1] || {}).d : null;
    for (let i = start; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.d && m.d !== lastDay) {
        const div = document.createElement("div");
        div.className = "day-divider";
        div.textContent = "— DAY " + m.d + " —";
        list.appendChild(div);
        lastDay = m.d;
      }
      list.appendChild(msgEl(m));
    }
    scrollBottom(true);
  }
  function msgEl(m) {
    if (m.who === "c" || m.who === "note") {
      const d = document.createElement("div");
      d.className = "msg-center" + (m.who === "note" ? " note" : "");
      d.textContent = m.t;
      return d;
    }
    const row = document.createElement("div");
    const mine = m.who === "me";
    row.className = "msg-row" + (mine ? " me" : "");
    if (m.id) row.dataset.mid = m.id;
    const avatar = mine ? "" :
      m.who === "bot" ? `<div class="m-avatar">📱</div>` :
      `<div class="m-avatar">${portraitSVG("ely", m.emo || "normal")}</div>`;
    row.innerHTML = `${avatar}<div class="bubble">${escapeHtml(m.t)}</div>
      <div class="stamp">${mine && m.read1 ? '<span class="read1">1</span>' : ""}<span>${m.time || ""}</span></div>`;
    return row;
  }
  const escapeHtml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function scrollBottom(instant) {
    const sc = $("msg-scroll");
    sc.scrollTo({ top: sc.scrollHeight, behavior: instant ? "auto" : "smooth" });
  }
  function pushMsg(room, m) {
    m.d = S.day;
    S.rooms[room].msgs.push(m);
    S.rooms[room].time = "지금";
    if (currentRoom === room) { $("msg-list").appendChild(msgEl(m)); scrollBottom(); }
    else if (m.who !== "me") S.rooms[room].unread++;
    save();
  }

  /* ---------------- 중단 가능한 대기 (탭 = 현재 지연 스킵) ---------------- */
  let waitSkip = null;
  function wait(ms) {
    const eff = DEBUG ? Math.min(ms, 50) : ms;
    return new Promise((r) => {
      const t = setTimeout(() => { waitSkip = null; r(); }, eff);
      waitSkip = () => { clearTimeout(t); waitSkip = null; r(); };
    });
  }

  /* ---------------- 스크립트 재생 (peek → 처리 → shift) ---------------- */
  let consecE = 0;
  async function playScript() {
    const token = ++playToken;
    while (S.pending.length) {
      if (token !== playToken || currentRoom !== "ely") return;
      const node = S.pending[0];

      if (node.choices) {
        S.pending.shift();
        S.pendingChoices = node.choices;
        save();
        showReplies(node.choices);
        return;
      }
      if (node.branch) {
        S.pending.shift();
        const hit = node.branch.find((b) => b.suit ? S.suit : b.flag ? S.flags[b.flag] : S.aff >= b.min);
        if (hit) S.pending = hit.then.concat(S.pending);
        save();
        continue;
      }
      if (node.e !== undefined) {
        consecE++;
        const base = node.d || Math.min(420 + node.e.length * 20, 1150);
        await showTyping(consecE > 1 ? Math.round(base * 0.65) : base);
        if (token !== playToken) return; // shift 전 중단 → 재입장 시 그대로 재생 (소실 방지)
        pushMsg("ely", { who: "ely", t: fmt(node.e), emo: S.rooms.ely.emo, time: clock() });
        SND.receive();
        S.pending.shift(); save();
        await wait(300);
        continue;
      }
      consecE = 0;
      if (node.me !== undefined) {
        await wait(450);
        if (token !== playToken) return;
        sendMine(fmt(node.me));
        S.pending.shift(); save();
        await wait(350);
      } else if (node.c !== undefined || node.note !== undefined) {
        await wait(400);
        if (token !== playToken) return;
        pushMsg("ely", { who: node.c !== undefined ? "c" : "note", t: fmt(node.c !== undefined ? node.c : node.note) });
        S.pending.shift(); save();
      } else if (node.bot !== undefined) {
        S.pending.shift(); save();
        botMsg(node.bot);
      } else if (node.status !== undefined) {
        S.pending.shift();
        S.rooms.ely.status = node.status;
        $("chat-status").textContent = node.status;
        pushMsg("ely", { who: "c", t: `엘리시아님이 상태메시지를 변경했습니다: “${node.status}”` });
        save();
        await wait(300);
      } else if (node.emo !== undefined) {
        S.pending.shift();
        S.rooms.ely.emo = node.emo;
        $("chat-avatar").innerHTML = portraitSVG("ely", node.emo);
        pushMsg("ely", { who: "c", t: "엘리시아님이 프로필 사진을 변경했습니다" });
        save();
        await wait(300);
      } else if (node.aff !== undefined) {
        S.pending.shift(); save();
        addAff(node.aff);
      } else if (node.end !== undefined) {
        S.pending.shift(); save();
        finishGame(node.end);
        return;
      } else {
        S.pending.shift(); save(); // 알 수 없는 노드 방어
      }
    }
    onScriptDone();
    save();
  }
  let typingEl = null;
  async function showTyping(ms) {
    const row = document.createElement("div");
    row.className = "msg-row";
    row.innerHTML = `<div class="m-avatar">${portraitSVG("ely", S.rooms.ely.emo)}</div><div class="typing"><i></i><i></i><i></i></div>`;
    $("msg-list").appendChild(row);
    typingEl = row;
    scrollBottom();
    await wait(ms);
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }
  function sendMine(text) {
    const m = { who: "me", t: text, time: clock(), read1: true, id: ++S.seq };
    pushMsg("ely", m);
    SND.send();
    const mid = m.id;
    setTimeout(() => {
      m.read1 = false;
      save();
      if (currentRoom === "ely") {
        const span = $("msg-list").querySelector(`[data-mid="${mid}"] .read1`);
        if (span) span.remove();
      }
      SND.read();
    }, DEBUG ? 120 : rnd(700, 1600));
  }

  /* ---------------- 답장 선택 ---------------- */
  const GATE_HINT = {
    str: "낮 일과 '⚔️ 왕립 훈련소'에서 근력이 오른다",
    int: "낮 일과 '📚 마탑 서고'에서 지능이 오른다",
    gold: "낮 일과 '💼 길드 알바'로 골드를 벌 수 있다",
  };
  function showReplies(choices) {
    const bar = $("reply-bar");
    bar.innerHTML = `<div class="reply-label">▼ 답장을 선택하세요</div>`;
    choices.forEach((c) => {
      const ok = checkReq(c.req);
      const btn = document.createElement("button");
      btn.className = "reply-btn " + (c.ignore ? "ghost" : ok ? (c.req ? "ok" : "") : "locked");
      let html = escapeHtml(fmt(c.t));
      if (c.req) {
        const label = c.req.stat ? (c.req.stat === "str" ? "근력" : "지능") + " " + c.req.val : c.req.gold + "G";
        html += `<span class="req">${ok ? "✦ " + label : "🔒 " + label + " 필요"}</span>`;
      }
      btn.innerHTML = html;
      if (ok) {
        if (c.ignore) {
          // 읽씹 선택은 2단계 확인 (오터치 방지)
          let armed = false, timer = null;
          btn.onclick = () => {
            if (!armed) {
              armed = true;
              btn.textContent = "…정말 답하지 않는다? (다시 탭)";
              btn.classList.add("confirm");
              timer = setTimeout(() => { armed = false; btn.classList.remove("confirm"); btn.innerHTML = escapeHtml(fmt(c.t)); }, 2500);
            } else { clearTimeout(timer); pickReply(c); }
          };
        } else btn.onclick = () => pickReply(c);
      } else {
        // 잠긴 버튼: 무반응 대신 해금 방법 안내
        btn.onclick = () => {
          btn.classList.add("shake");
          const req = btn.querySelector(".req");
          if (req) {
            const orig = req.textContent;
            req.textContent = "💡 " + GATE_HINT[c.req.stat || "gold"];
            setTimeout(() => { req.textContent = orig; btn.classList.remove("shake"); }, 1700);
          }
        };
      }
      bar.appendChild(btn);
    });
    bar.classList.remove("hidden");
    scrollBottom();
  }
  function hideReplies() { $("reply-bar").classList.add("hidden"); }
  function checkReq(req) {
    if (!req) return true;
    if (req.gold !== undefined) return S.gold >= req.gold;
    if (req.stat) return S.stats[req.stat] >= req.val;
    return true;
  }
  function pickReply(c) {
    S.pendingChoices = null;
    hideReplies();
    if (c.final) { runFinal(c); return; }
    if (c.end) { S.pending = (ENDINGS[c.end].script || []).concat([{ end: c.end }]); save(); playScript(); return; }
    if (!c.ignore) sendMine(fmt(c.t));
    else pushMsg("ely", { who: "c", t: "당신은 답장을 보류했다…" });
    if (c.req && c.req.gold) S.gold -= c.req.gold;
    if (c.suit) S.suit = true;
    if (c.flag) S.flags[c.flag] = true;
    if (c.clear) delete S.flags[c.clear];
    if (c.aff) addAff(c.aff);
    else if (c.style) {
      // 셋 다 유효한 답. 그날의 기분과 맞으면 더 깊게 꽂힌다.
      const mood = (DAYS[S.day] || {}).mood;
      const hit = MOOD_MATCH[mood] === c.style;
      const g = AFF_GAIN[S.day] || AFF_GAIN[7];
      const amount = hit ? g.hit : g.miss;
      S.style[c.style] = (S.style[c.style] || 0) + 1;
      if (hit) S.hits++; else S.misses++;
      addAff(amount);
      botMsg((hit ? "【적중】 " : "") + pick(hit ? STYLE_FEEDBACK.hit : STYLE_FEEDBACK.ok)
        + ` (${STYLE_NAME[c.style]} · 호감도 +${amount})`);
    }
    if (c.then) S.pending = c.then.concat(S.pending);
    save();
    setTimeout(() => { if (currentRoom === "ely" && !S.pendingChoices) playScript(); }, DEBUG ? 60 : 500);
  }
  function runFinal(c) {
    const m = (c.t || "").match(/「(.+?)」/);
    sendMine(m ? m[1] : "엘리시아. 무도회, 나와 함께 가자.");
    const key = S.aff >= SUCCESS_LINE ? "ok" : "fail";
    S.pending = ENDINGS[key].script.concat([{ end: key }]);
    save();
    setTimeout(() => { if (currentRoom === "ely") playScript(); }, DEBUG ? 80 : 1000);
  }

  /* ---------------- 하루 흐름 ---------------- */
  function onScriptDone() {
    if (S.phase === "morning" && currentRoom === "ely" && S.mNoteDay !== S.day && !S.pendingChoices) {
      S.mNoteDay = S.day;
      pushMsg("ely", { who: "note", t: "← 홈으로 돌아가 ☀️ 오늘의 일과를 정하자" });
    }
    if (S.phase === "night") {
      S.phase = "done";
      if (currentRoom === "ely" && S.day < 7) pushMsg("ely", { who: "note", t: "← 홈에서 🌙 하루를 마무리하자" });
    }
    renderHome();
  }
  /* ---------------- 변주 팩: 같은 사건, 다른 대사 ---------------- */
  // 직전 판에서 뽑힌 안은 피한다 (판이 끝나도 남는 별도 저장소)
  const SEEN_KEY = "alphatalk-seen-variants";
  const loadSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch (e) { return {}; } };
  const saveSeen = (o) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(o)); } catch (e) {} };

  function scriptFor(day, kind) {
    const base = (DAYS[day] || {})[kind];
    if (!base) return null;
    const alts = ((typeof VARIANTS !== "undefined" && VARIANTS[day]) || {})[kind];
    const pool = alts && alts.length ? [base].concat(alts) : [base];
    const slot = day + ":" + kind;
    const seen = loadSeen();
    let choices = pool.map((_, i) => i);
    if (pool.length > 1 && seen[slot] !== undefined) {
      const fresh = choices.filter((i) => i !== seen[slot]);
      if (fresh.length) choices = fresh;
    }
    const idx = choices[Math.floor(Math.random() * choices.length)];
    seen[slot] = idx; saveSeen(seen);
    S.variantLog = S.variantLog || {};
    S.variantLog[slot] = "ABCDEFG"[idx] || idx;
    return pool[idx].slice();
  }

  /* ---------------- AI 생성 (실패 시 변주 팩으로 폴백) ---------------- */
  let generating = false;
  async function aiOrScript(kind, scripted) {
    if (!AI.enabled()) return scripted;
    generating = true; renderHome();
    const nodes = await AI.generate(kind, S);
    generating = false;
    if (nodes) {
      S.ai.used = (S.ai.used || 0) + 1;
      save();
      return nodes;
    }
    if (S.ai.lastError) {
      botMsg("⚠️ AI 생성 실패 — 기본 대사로 진행합니다. (" + S.ai.lastError.slice(0, 90) + ")");
    }
    return scripted;
  }

  async function queueDay(day) {
    const D = DAYS[day];
    if (!D) return;
    S.phase = "morning";
    S.nightOpened = false;
    (D.bot || []).forEach((t) => botMsg(t));
    let morning = await aiOrScript("morning", scriptFor(day, "morning") || []);
    if (S.ignoredNight) { morning = IGNORE_MORNING.concat(morning); S.ignoredNight = false; }
    S.pending = S.pending.concat(morning);
    S.rooms.ely.time = "지금";
    SND.receive();
    save();
    renderHome();
  }
  function openCards() {
    const card = $("modal-cards").querySelector(".modal-card");
    card.innerHTML = `<p class="cards-sys">【오늘의 일과 — 하나만 고를 수 있다】</p>
      <p class="cards-hint">스탯이냐, 그녀의 기분을 읽을 단서냐, 돈이냐</p>
      <div id="card-list" class="card-list"></div>`;
    const list = $("card-list");
    CARDS.forEach((cd) => {
      const el = document.createElement("div");
      el.className = "day-card";
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.innerHTML = `<div class="ico">${cd.ico}</div><div><div class="nm">${cd.nm}</div><div class="ds">${cd.ds}</div></div>`;
      el.onclick = () => pickCard(cd);
      el.onkeydown = (e) => { if (e.key === "Enter") pickCard(cd); };
      list.appendChild(el);
    });
    $("modal-cards").classList.remove("hidden");
  }
  function pickCard(cd) {
    SND.card();
    S.phase = "day"; // 봇 타임스탬프가 낮 시각으로 찍히도록
    let gainLine;
    if (cd.stat) {
      const n = rnd(cd.min, cd.max);
      S.stats[cd.stat] += n;
      gainLine = (cd.stat === "str" ? "근력" : "지능") + " +" + n;
      botMsg(CARD_RESULT[cd.id] + ` (${gainLine})`);
    } else {
      const g = rnd(cd.gold[0], cd.gold[1]);
      S.gold += g;
      gainLine = "+" + g + "G";
      botMsg(CARD_RESULT[cd.id] + ` (${gainLine})`);
    }
    // 관찰 결과 — 그날 밤 그녀의 기분에 대한 단서
    S.scout = cd.scout;
    const mood = (DAYS[S.day] || {}).mood;
    const scoutText = mood ? MOOD_SCOUT[cd.scout][mood] : "";
    if (scoutText) botMsg(scoutText);
    save();
    showDayScene(cd, gainLine, scoutText);
  }
  function showDayScene(cd, gainLine, scoutText) {
    const card = $("modal-cards").querySelector(".modal-card");
    card.innerHTML =
      `<p class="cards-sys">【 ${cd.ico} ${cd.nm} 】</p>
       <div class="scene-body">${escapeHtml(pick(DAY_SCENES[cd.id]))}</div>
       <div class="scene-gain">${gainLine}</div>
       ${scoutText ? `<div class="scene-scout">${escapeHtml(scoutText)}</div>` : ""}
       <button id="btn-scene-ok" class="btn btn-primary">🌙 밤이 된다</button>`;
    card.querySelector("#btn-scene-ok").onclick = startNight;
  }
  async function startNight() {
    $("modal-cards").classList.add("hidden");
    S.phase = "night";
    const night = await aiOrScript("night", scriptFor(S.day, "night") || []);
    S.pending = S.pending.concat([{ c: "— 🌙 그날 밤 —" }]).concat(night);
    S.rooms.ely.time = "지금";
    SND.receive();
    save();
    const sb = $("btn-sleep");
    sb.style.pointerEvents = "none";
    setTimeout(() => { sb.style.pointerEvents = ""; }, 500);
    renderHome();
  }
  function trySleep() {
    const unfinished = S.phase === "night" && hasVisible();
    if (unfinished && !sleepArmed) {
      sleepArmed = true;
      clearTimeout(sleepArmTimer);
      sleepArmTimer = setTimeout(() => { sleepArmed = false; renderHome(); }, 2500);
      renderHome();
      return;
    }
    clearTimeout(sleepArmTimer);
    sleepArmed = false;
    sleepDay(unfinished);
  }
  function sleepDay(ignored) {
    if (ignored) {
      const onlyReply = !!S.pendingChoices && !S.pending.some((n) => n.e !== undefined || n.me !== undefined || n.c !== undefined || n.note !== undefined || n.choices || n.branch);
      S.ignoredNight = true;
      S.pending = [];
      S.pendingChoices = null;
      addAff(-4);
      botMsg(onlyReply
        ? "그녀의 물음에 답하지 않고 잠들었습니다. 호감도 -4. 내일 아침, 만회의 기회가 있습니다. 답장은 서툴러도 되니, 빠른 게 낫습니다."
        : "그녀의 메시지를 읽지 않고 하루를 마쳤습니다. 호감도 -4. 내일 아침, 만회의 기회가 있습니다. 세상은 아직 끝나지 않았습니다.");
    }
    S.day++;
    showAllDays = false;
    save();
    queueDay(S.day);
  }

  /* ---------------- 엔딩 ---------------- */
  function finishGame(key) {
    S.ended = key;
    save();
    const E = ENDINGS[key];
    $("ending-icon").textContent = E.icon;
    $("ending-title").textContent = E.title;
    $("ending-desc").textContent = E.desc;
    $("ending-stats").innerHTML =
      `<span class="chip">♥ 최종 호감도 <b>${S.aff}</b></span>` +
      `<span class="chip">근력 <b>${S.stats.str}</b></span>` +
      `<span class="chip">지능 <b>${S.stats.int}</b></span>` +
      `<span class="chip">🪙 <b>${S.gold}G</b></span>` +
      (S.suit ? `<span class="chip">🤵 예복 착용</span>` : "");
    if (key === "ok") SND.fanfare();
    $("share-box").classList.add("hidden");
    show("scr-ending");
  }

  /* ---------------- 결과 공유 ---------------- */
  const RANK = (aff) => aff >= 80 ? "S · 알파남" : aff >= 65 ? "A · 알파 후보"
    : aff >= 55 ? "B · 동네 인기남" : aff >= 40 ? "C · 훈남 지망생" : "D · 아직 사람입니다";
  function shareText() {
    const E = ENDINGS[S.ended] || ENDINGS.fail;
    const total = S.hits + S.misses;
    const lines = [
      "【이세계알파남 : 알파톡】 제1화 기사단장 편",
      `${E.icon} ${E.title}`,
      "",
      `최종 호감도 ${S.aff}/100 — 알파 등급 ${RANK(S.aff)}`,
    ];
    if (total > 0) lines.push(`그녀의 기분을 읽어낸 횟수 ${S.hits}/${total}`);
    lines.push(`근력 ${S.stats.str} · 지능 ${S.stats.int} · ${S.gold}G${S.suit ? " · 🤵예복" : ""}`);
    lines.push("", "— 그녀에게서, 먼저 연락이 온다 —", location.origin + location.pathname);
    return lines.join("\n");
  }
  async function doShare() {
    const txt = shareText();
    const box = $("share-box");
    box.textContent = txt;
    box.classList.remove("hidden");
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); ok = true; }
    } catch (e) {}
    if (!ok) {
      // 클립보드 권한이 없으면 사용자가 직접 복사하도록 전체 선택
      const r = document.createRange(); r.selectNodeContents(box);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
    $("btn-share").textContent = ok ? "✅ 복사됐습니다! 붙여넣기 하세요" : "👆 위 글을 길게 눌러 복사하세요";
    setTimeout(() => { $("btn-share").textContent = "📋 결과 복사해서 자랑하기"; }, 4000);
  }

  /* ---------------- 시작 ---------------- */
  function newGame() {
    S = freshState();
    $("inp-name").value = "";
    show("scr-naming");
    setTimeout(() => $("inp-name").focus(), 100);
  }
  function confirmName() {
    S.name = $("inp-name").value.trim() || "김철수";
    save();
    goHome();
    queueDay(1);
  }
  function bindBack() {
    $("btn-back").onclick = () => {
      playToken++;
      if (typingEl) { typingEl.remove(); typingEl = null; }
      if (S.ended) finishGame(S.ended); else goHome();
    };
  }

  /* ---------------- AI 설정 ---------------- */
  function renderBadge() {
    const b = $("ai-badge");
    if (!b) return;
    const on = AI.enabled();
    b.textContent = on ? "AI ON" : "AI OFF";
    b.className = "ai-badge " + (on ? "on" : "off");
  }
  function renderModels() {
    const list = $("model-list");
    const cur = AI.getCfg().model;
    list.innerHTML = "";
    AI.MODELS.forEach((m) => {
      const el = document.createElement("div");
      el.className = "model-opt" + (m.id === cur ? " sel" : "");
      el.innerHTML = `<div class="m-nm">${m.nm}</div><div class="m-ds">${m.ds}</div><div class="m-cost">${m.cost}</div>`;
      el.onclick = () => { const c = AI.getCfg(); c.model = m.id; AI.setCfg(c); renderModels(); };
      list.appendChild(el);
    });
  }
  function aiStatus(msg, kind) {
    const el = $("ai-status");
    el.textContent = msg;
    el.className = "ai-status " + (kind || "");
  }
  function bindSettings() {
    $("btn-settings").onclick = () => {
      $("inp-apikey").value = AI.getKey();
      renderModels();
      $("ai-status").className = "ai-status hidden";
      $("modal-ai").classList.remove("hidden");
    };
    $("btn-ai-close").onclick = () => { $("modal-ai").classList.add("hidden"); renderBadge(); };
    $("btn-ai-save").onclick = () => {
      const k = $("inp-apikey").value.trim();
      AI.setKey(k);
      const c = AI.getCfg(); c.on = !!k; AI.setCfg(c);
      renderBadge();
      aiStatus(k ? "저장됐습니다. AI 대화 생성이 켜졌습니다." : "키를 지웠습니다. 스크립트 모드로 플레이됩니다.", "ok");
    };
    $("btn-ai-test").onclick = async () => {
      const k = $("inp-apikey").value.trim();
      if (!k) { aiStatus("먼저 API 키를 입력하세요.", "err"); return; }
      AI.setKey(k);
      const c = AI.getCfg(); c.on = true; AI.setCfg(c);
      aiStatus("테스트 중…", "");
      const probe = {
        name: "테스터", day: 1, stats: { str: 0, int: 0 }, gold: 0, aff: 5,
        ai: { memos: [], fails: 0 },
      };
      const nodes = await AI.generate("morning", probe);
      if (nodes) {
        const first = (nodes.find((n) => n.e !== undefined) || {}).e || "";
        aiStatus("✅ 연결 성공! 엘리시아: 「" + first.slice(0, 60) + "」", "ok");
        renderBadge();
      } else {
        aiStatus("❌ 실패: " + (probe.ai.lastError || "알 수 없는 오류"), "err");
      }
    };
    renderBadge();
  }

  function bind() {
    $("btn-new").onclick = () => { SND.unlock(); newGame(); };
    $("btn-continue").onclick = () => { SND.unlock(); S = load(); if (S) { S.ended ? finishGame(S.ended) : goHome(); } };
    $("btn-name-ok").onclick = confirmName;
    $("inp-name").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmName(); });
    bindBack();
    $("btn-daycard").onclick = openCards;
    $("btn-sleep").onclick = trySleep;
    $("btn-retry").onclick = () => { wipe(); location.reload(); };
    $("btn-log").onclick = () => { showAllDays = true; openRoom("ely"); hideReplies(); };
    $("btn-share").onclick = doShare;
    $("msg-scroll").addEventListener("click", () => { if (waitSkip) waitSkip(); });
    bindSettings();
    const saved = load();
    if (saved) $("btn-continue").classList.remove("hidden");

    if (DEBUG) buildDebugPanel();
  }

  /* ---------------- 개발자 패널 (?debug=1) ---------------- */
  function skipDay() {
    if (!S || S.ended) return;
    if (S.day >= 7) { jumpFinal(); return; }
    S.pending = []; S.pendingChoices = null; S.phase = "night";
    sleepDay(false);
  }
  function jumpFinal() {
    if (!S) return;
    S.day = 7; S.phase = "night"; S.ended = null;
    S.pendingChoices = null;
    S.pending = [{ c: "— 🌙 건국제의 밤 —" }].concat((DAYS[7].night || []).slice());
    save();
    openRoom("ely");
  }
  function forceEnding(key) {
    if (!S) return;
    S.ended = null; S.pendingChoices = null;
    S.pending = ENDINGS[key].script.concat([{ end: key }]);
    save();
    openRoom("ely");
  }
  function rerollVariant() {
    if (!S) return;
    const kind = S.phase === "morning" ? "morning" : "night";
    // 오늘 대화를 지우고 다른 변주로 다시 뽑는다
    S.rooms.ely.msgs = S.rooms.ely.msgs.filter((m) => (m.d || 1) !== S.day);
    S.pendingChoices = null;
    S.pending = scriptFor(S.day, kind) || [];
    S.clkPhase = ""; // 시계 커서 초기화
    save();
    openRoom("ely");
    toastDbg(`DAY ${S.day} ${kind} → ${S.variantLog[S.day + ":" + kind]}안`);
  }
  function toastDbg(msg) {
    const el = document.getElementById("dbg-msg");
    if (el) { el.textContent = msg; setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, 2600); }
  }
  function buildDebugPanel() {
    const wrap = document.createElement("div");
    wrap.id = "dbg-panel";
    wrap.innerHTML = `<div class="dbg-head">🛠 DEV <button id="dbg-fold">▾</button></div>
      <div id="dbg-body" class="dbg-body">
        <div class="dbg-row" id="dbg-r1"></div>
        <div class="dbg-row" id="dbg-r2"></div>
        <div class="dbg-row" id="dbg-r3"></div>
        <div id="dbg-msg" class="dbg-msg"></div>
      </div>`;
    document.getElementById("app").appendChild(wrap);
    const mk = (row, label, fn) => {
      const b = document.createElement("button");
      b.className = "dbg-btn"; b.textContent = label; b.onclick = fn;
      document.getElementById(row).appendChild(b);
    };
    mk("dbg-r1", "스탯+10", () => { S.stats.str += 10; S.stats.int += 10; S.gold += 40; save(); renderHome(); toastDbg("근력·지능 +10, 골드 +40"); });
    mk("dbg-r1", "호감+10", () => { addAff(10); renderHome(); toastDbg("호감도 " + S.aff); });
    mk("dbg-r1", "호감-10", () => { addAff(-10); renderHome(); toastDbg("호감도 " + S.aff); });
    mk("dbg-r2", "하루 건너뛰기", skipDay);
    mk("dbg-r2", "🔀 변주 리롤", rerollVariant);
    mk("dbg-r2", "D7 밤으로", () => { jumpFinal(); toastDbg("D7 밤 — 최종 신청"); });
    mk("dbg-r3", "💃 성사", () => forceEnding("ok"));
    mk("dbg-r3", "🌧️ 거절", () => forceEnding("fail"));
    mk("dbg-r3", "🌙 겁쟁이", () => forceEnding("chicken"));
    document.getElementById("dbg-fold").onclick = () => {
      const b = document.getElementById("dbg-body");
      const hidden = b.style.display === "none";
      b.style.display = hidden ? "" : "none";
      document.getElementById("dbg-fold").textContent = hidden ? "▾" : "▸";
    };
  }
  document.addEventListener("DOMContentLoaded", bind);
})();

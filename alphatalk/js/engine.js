/* ============ 알파톡 — 메신저 엔진 v5 (동시형 · 히로인 다중) ============
   상태는 히로인 단위(S.h[id])로 분리되어 있고, 엔진은 특정 히로인을 알지 못한다.
   하루 구조: 아침 2슬롯 / 낮 카드 1장 / 밤 2슬롯.
   같은 사람에게 아침을 두 번 쓸 수 없다 → 3명이면 매일 한 명은 소외된다.        */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const SAVE_KEY = "alphatalk-save-v2";
  const SEEN_KEY = "alphatalk-seen-variants";
  const DEBUG = location.search.includes("debug=1");

  const SUCCESS_LINE = 80;
  // D1 은 튜토리얼이라 세 명 모두와 인사할 수 있다. D2 부터가 진짜 게임 —
  // 하루 네 번, 셋 중 하나는 반드시 답을 못 받는 구조가 그때 시작된다.
  const SLOTS = { morning: 2, night: 2 };
  const TUTORIAL_DAY = 1;
  const slotCap = (kind) => (S && S.day === TUTORIAL_DAY ? HERO.active().length : SLOTS[kind]);
  const MOOD_MATCH = { proud: "wit", lonely: "bold", tired: "care" };
  const STYLE_NM = { bold: "직진", wit: "재치", care: "배려" };
  // 밤은 무겁고 아침은 가볍다. 후반일수록 값지다.
  const AFF_NIGHT = { 1:{hit:7,miss:2}, 2:{hit:8,miss:2}, 3:{hit:10,miss:3}, 4:{hit:12,miss:4}, 5:{hit:14,miss:4}, 6:{hit:16,miss:5}, 7:{hit:16,miss:5} };
  const AFF_MORN  = { 1:{hit:2,miss:1}, 2:{hit:3,miss:1}, 3:{hit:3,miss:1},  4:{hit:4,miss:1},  5:{hit:5,miss:2},  6:{hit:5,miss:2},  7:{hit:6,miss:2} };
  const TAIL = 14;

  /* ---------------- 상태 ---------------- */
  let S = null;
  function freshHero(id) {
    const H = HERO.get(id);
    return {
      aff: 5, style: { bold: 0, wit: 0, care: 0 }, hits: 0, misses: 0,
      flags: {}, suit: false, milestones: {},
      msgs: [], unread: 0, status: H.status, emo: "normal", time: "",
      pending: [], pendingChoices: null, variantLog: {}, aiMemos: [],
      noReplyDays: 0,
      // "day:phase" — 답장할 수 없는 상태에서 방을 열어 끝까지 읽은 시점.
      // 표시 전용이다. pendingChoices 를 지우면 낮 카드 개방·취침 경고·phase 전환이 어긋난다.
      readPhase: "",
    };
  }
  function freshState() {
    const h = {};
    HERO.active().forEach((id) => { h[id] = freshHero(id); });
    return {
      v: 2, name: "김철수", day: 1, phase: "morning",
      stats: { str: 0, int: 0, cha: 0 }, gold: 0,
      seq: 0, hintShown: false, clkDay: 0, clkPhase: "", clkCur: 0,
      h, bot: { msgs: [], unread: 0, time: "" },
      used: { morning: [], night: [] },
      scouted: null,
      ended: null, endedWith: null, endedSuccess: false, outcomes: null,
      ai: { fails: 0, lastError: null, used: 0 },
    };
  }
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} };
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d || d.v !== 2 || !d.h) return null;
      // 저장 이후 히로인이 추가됐을 수 있다
      HERO.active().forEach((id) => { if (!d.h[id]) d.h[id] = freshHero(id); });
      // endedSuccess 도입 전 세이브는 엔딩 키로 성공 여부를 복원한다.
      // 이 보정이 없으면 성사 엔딩도 결과 화면과 공유문에서 실패 표식으로 표시된다.
      if (d.ended && typeof d.endedSuccess !== "boolean") {
        d.endedSuccess = d.ended === "truelove" || d.ended === "ok";
      }
      Object.keys(d.h).forEach((id) => d.h[id].msgs.forEach((m) => { if (m.read1) m.read1 = false; }));
      return d;
    } catch (e) { return null; }
  }
  const wipe = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} };
  const fmt = (t, id) => (t || "")
    .replaceAll("{name}", S.name)
    .replaceAll("{aff}", id ? String(S.h[id].aff) : "");

  /* ---------------- 슬롯 ---------------- */
  const slotKind = () => (S.phase === "morning" ? "morning" : "night");
  const slotsLeft = (kind) => slotCap(kind) - (S.used[kind] || []).length;
  const canReply = (id) => {
    const k = slotKind();
    if (S.phase === "day") return false;
    if ((S.used[k] || []).indexOf(id) >= 0) return false; // 이미 이 시간대에 답장함
    return slotsLeft(k) > 0;
  };
  function consumeSlot(id) {
    const k = slotKind();
    if ((S.used[k] || []).indexOf(id) < 0) S.used[k].push(id);
  }
  /* 읽음 기록은 날짜·시간대 단위다. 다음 아침/밤이 되면 저절로 무효가 된다.
     done 은 밤의 연장이므로 같은 칸으로 본다. */
  const phaseKey = () => S.day + ":" + (S.phase === "done" ? "night" : S.phase);
  /* 이 시간대에 답장하지 못한 채 지나간 상대. 이미 답장한 상대는 해당 없다. */
  const missedTurn = (id) => !canReply(id) && (S.used[slotKind()] || []).indexOf(id) < 0;
  /* 그중 끝까지 읽기까지 한 상태 — "읽었지만 답장하지 못했다" */
  const readNoReply = (id) => missedTurn(id) && S.h[id].readPhase === phaseKey();

  /* ---------------- 화면 ---------------- */
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(id).classList.add("active");
  }
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
  function addAff(id, n) {
    const st = S.h[id], H = HERO.get(id);
    const before = st.aff;
    st.aff = Math.max(0, Math.min(100, st.aff + n));
    if (n > 0) SND.heart(); else if (n < 0) SND.drop();
    const ms = H.milestones || {};
    Object.keys(ms).forEach((k) => {
      const th = Number(k);
      if (before < th && st.aff >= th && !st.milestones[k]) {
        st.milestones[k] = 1;
        botMsg(`[${H.name}] ` + ms[k], id);
      }
    });
    save();
  }

  /* ---------------- 봇 방 ---------------- */
  /* id 를 받아야 {aff} 가 그 히로인의 호감도로 치환된다.
     엔진 v5 에서 S.aff → S.h[id].aff 로 쪼갤 때 여기만 누락돼 "호감도 /100" 이 나왔다. */
  function botMsg(t, id) {
    S.bot.msgs.push({ who: "bot", t: fmt(t, id), time: clock(), d: S.day });
    S.bot.unread++;
    S.bot.time = "지금";
    SND.bot();
    save();
    if (currentRoom === "bot") renderRoomMsgs("bot");
    renderHome();
  }

  /* ---------------- 대본 선택 (변주 + 직전 판 회피) ---------------- */
  const loadSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch (e) { return {}; } };
  const saveSeen = (o) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(o)); } catch (e) {} };
  function scriptFor(id, day, kind) {
    const H = HERO.get(id);
    const base = ((H.days || {})[day] || {})[kind];
    if (!base) return null;
    const alts = (((H.variants || {})[day]) || {})[kind];
    const pool = alts && alts.length ? [base].concat(alts) : [base];
    const slot = id + ":" + day + ":" + kind;
    const seen = loadSeen();
    let idx2 = pool.map((_, i) => i);
    if (pool.length > 1 && seen[slot] !== undefined) {
      const fresh = idx2.filter((i) => i !== seen[slot]);
      if (fresh.length) idx2 = fresh;
    }
    const idx = idx2[Math.floor(Math.random() * idx2.length)];
    seen[slot] = idx; saveSeen(seen);
    S.h[id].variantLog[day + ":" + kind] = "ABCDE"[idx] || idx;
    return pool[idx].slice();
  }

  /* ---------------- AI (실패 시 대본 폴백) ---------------- */
  let generating = 0;
  async function aiOrScript(id, kind, scripted) {
    if (!AI.enabled()) return scripted;
    const H = HERO.get(id);
    if (!H.ai || !H.ai.card) return scripted;
    generating++; renderHome();
    const probe = {
      name: S.name, day: S.day, stats: S.stats, gold: S.gold,
      aff: S.h[id].aff, ai: { memos: S.h[id].aiMemos, fails: 0 },
      heroine: H,
    };
    const nodes = await AI.generate(kind, probe);
    generating--;
    if (nodes) {
      S.ai.used++; S.h[id].aiMemos = probe.ai.memos; save();
      return preserveScriptContracts(nodes, scripted);
    }
    if (probe.ai.lastError) {
      S.ai.lastError = probe.ai.lastError;
      botMsg("⚠️ AI 생성 실패 — 기본 대사로 진행합니다. (" + String(probe.ai.lastError).slice(0, 80) + ")");
    }
    return scripted;
  }

  /* AI는 대사만 생성한다. 사진 연출과 진행에 영향을 주는 선택지 메타데이터는
     본 대본에서 되살려야 D1·D3 읽씹, D5·D6 분기가 AI 모드에서도 유지된다. */
  function preserveScriptContracts(generated, scripted) {
    const result = generated.slice();
    const sourceChoiceNode = scripted.find((n) => n && Array.isArray(n.choices));
    const generatedChoiceNode = result.find((n) => n && Array.isArray(n.choices));
    if (sourceChoiceNode && generatedChoiceNode) {
      const structural = ["req", "flag", "ignore", "suit", "clear", "aff", "final", "end"];
      generatedChoiceNode.choices = generatedChoiceNode.choices.map((choice) => {
        const source = sourceChoiceNode.choices.find((c) => c.style === choice.style && !c.ignore);
        if (!source) return choice;
        const merged = Object.assign({}, choice);
        structural.forEach((key) => { if (source[key] !== undefined) merged[key] = source[key]; });
        return merged;
      });
      sourceChoiceNode.choices.filter((c) => c.ignore).forEach((c) => generatedChoiceNode.choices.push(c));
    }
    const photos = scripted.filter((n) => n && n.photo !== undefined);
    if (photos.length) {
      const at = result.indexOf(generatedChoiceNode);
      result.splice(at < 0 ? result.length : at, 0, ...photos);
    }
    return result;
  }

  /* ---------------- 홈 ---------------- */
  let currentRoom = null;
  let sleepArmed = false, sleepArmTimer = null;
  function goHome() { currentRoom = null; show("scr-home"); renderHome(); save(); }

  const hasVisible = (id) => {
    const st = S.h[id];
    return !!st.pendingChoices || st.pending.some((n) =>
      n.e !== undefined || n.me !== undefined || n.c !== undefined || n.note !== undefined ||
      n.photo !== undefined || n.choices || n.branch);
  };
  const anyVisible = () => HERO.active().some(hasVisible);

  function flushInvisible() {
    HERO.active().forEach((id) => {
      if (currentRoom === id) return;
      const st = S.h[id];
      while (st.pending.length) {
        const n = st.pending[0];
        if (n.bot !== undefined) { st.pending.shift(); botMsg(n.bot, id); }
        else if (n.aff !== undefined) { st.pending.shift(); addAff(id, n.aff); }
        else break;
      }
    });
    save();
  }

  function renderHome() {
    flushInvisible();
    const dleft = 7 - S.day;
    $("dday").textContent = dleft <= 0 ? "건국제 무도회 D-DAY" : "건국제 무도회 D-" + dleft;
    const label = { morning: "아침", day: "낮", night: "밤", done: "밤 · 소등 전" }[S.phase] || "";
    const k = slotKind();
    const slotTxt = (S.phase === "morning" || S.phase === "night")
      ? `　${S.phase === "morning" ? "☀️" : "🌙"} 답장 <b>${slotsLeft(k)}</b>/${slotCap(k)}` : "";
    const tuto = S.day === TUTORIAL_DAY ? `<span class="tuto-tag">TUTORIAL</span>` : "";
    $("day-banner").innerHTML = `DAY ${S.day} · ${label}${slotTxt}${tuto}`;

    const list = $("room-list");
    list.innerHTML = "";
    HERO.active().forEach((id) => {
      const H = HERO.get(id), st = S.h[id];
      /* 답장을 못 하고 지나간 상대는 읽었는지로 갈린다.
         읽었으면 배지를 지우고, 안 읽었으면 진짜 안읽음이므로 배지를 그대로 둔다. */
      const read = readNoReply(id);
      const missed = !read && missedTurn(id) && (!!st.pendingChoices || st.pending.length > 0);
      const incoming = (currentRoom === id || read) ? 0 : countIncoming(id);
      const unread = read ? 0 : st.unread + incoming;
      const last = st.msgs.length ? st.msgs[st.msgs.length - 1] : null;
      const replied = (S.used[k] || []).indexOf(id) >= 0;
      const preview = read ? "✓ 읽었지만 답장하지 못했다"
        : missed ? "읽지 않았다"
        : st.pendingChoices ? "답장을 기다리고 있다…"
        : incoming > 0 ? "새로운 메시지가 도착했다"
        : replied ? "✓ 오늘 답장함"
        : last ? (last.photo ? "📷 사진" : (last.who === "me" ? "나: " : "") + last.t) : "…";
      list.appendChild(roomCard(id, H.name, H.title, preview, st.time, unread, replied,
        avatarHTML(id, st.emo), read || missed));
    });
    const lastBot = S.bot.msgs.length ? S.bot.msgs[S.bot.msgs.length - 1].t : "…";
    list.appendChild(roomCard("bot", "알파 시스템", "관전 봇", lastBot, S.bot.time, S.bot.unread, false, null));

    const morningWait = S.phase === "morning" && anyVisible();
    $("home-stats").innerHTML =
      `근력 <b>${S.stats.str}</b> · 지능 <b>${S.stats.int}</b> · 매력 <b>${S.stats.cha}</b> · 🪙 <b>${S.gold}G</b>` +
      (AI.enabled() ? ` <span class="ai-on">✨AI</span>` : "") +
      `<br><span class="hint">${generating > 0
        ? "✨ 그녀가 보낼 말을 고르고 있다…"
        : morningWait ? "💬 메시지를 확인하고 답장할 상대를 고르세요"
        : "호감도·판정 지수는 [알파 시스템] 채널에서만 중계됩니다"}</span>`;

    const morningDone = S.phase === "morning" && (slotsLeft("morning") === 0 || !anyVisible()) && generating === 0;
    $("btn-daycard").classList.toggle("hidden", !morningDone);
    const nightPhase = S.phase === "night" || S.phase === "done";
    $("btn-sleep").classList.toggle("hidden", !nightPhase || S.day >= 7);
    const unfinished = S.phase === "night" && slotsLeft("night") > 0 && anyVisible();
    $("btn-sleep").textContent = sleepArmed ? "⚠️ 정말 잔다? (답장 기회가 남아 있다)"
      : unfinished ? "🌙 (답장 기회가 남았다) 그냥 잔다" : "🌙 하루 마무리";
    // D7 밤 = 최종 신청
    $("btn-final") && $("btn-final").classList.toggle("hidden", !(S.day >= 7 && (S.phase === "night" || S.phase === "done")));
  }

  function countIncoming(id) {
    const st = S.h[id];
    let n = st.pendingChoices ? 1 : 0;
    for (const node of st.pending) {
      if (node.e !== undefined || node.c !== undefined || node.me !== undefined ||
          node.note !== undefined || node.photo !== undefined) n++;
      if (node.branch) n++;
      if (node.choices) break;
    }
    return Math.max(n, (st.pending.length || st.pendingChoices) ? 1 : 0);
  }

  /* unanswered 는 replied 와 뜻이 정반대라 스타일을 공유하면 안 된다.
     흐리게 하는 건 같지만 프리뷰 색은 초록(답장함)이 아니라 회색으로 간다. */
  function roomCard(id, nm, sub, preview, time, unread, replied, svg, unanswered) {
    const el = document.createElement("div");
    el.className = "room" + (replied ? " replied" : "") + (unanswered ? " unanswered" : "");
    el.setAttribute("role", "button"); el.setAttribute("tabindex", "0");
    el.innerHTML = `<div class="avatar">${svg || "📱"}</div>
      <div class="info"><div class="nm">${nm}<small>${sub}</small></div>
      <div class="preview"></div></div>
      <div class="meta"><div class="time">${time || ""}</div>${unread > 0 ? `<div class="badge">${unread}</div>` : ""}</div>`;
    el.querySelector(".preview").textContent = preview;
    el.onclick = () => openRoom(id);
    el.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRoom(id); }
    };
    return el;
  }

  /* ---------------- 채팅방 ---------------- */
  let playToken = 0, showAllDays = false;
  function openRoom(id) {
    currentRoom = id; showAllDays = false; stickBottom = true;
    show("scr-chat"); bindBack(); initScrollKeeper();
    if (id === "bot") {
      $("chat-name").textContent = "알파 시스템";
      $("chat-status").textContent = "당신의 성장을 중계합니다";
      $("chat-avatar").innerHTML = "📱";
      renderRoomMsgs("bot"); S.bot.unread = 0; hideReplies();
    } else {
      const H = HERO.get(id), st = S.h[id];
      $("chat-name").textContent = H.name;
      $("chat-status").textContent = st.status;
      $("chat-avatar").innerHTML = avatarHTML(id, st.emo);
      if (!S.hintShown) { S.hintShown = true; st.msgs.push({ who: "note", t: "💡 화면을 탭하면 대화가 빨라진다", d: S.day }); }
      renderRoomMsgs(id); st.unread = 0;
      if (st.pendingChoices) showReplies(id, st.pendingChoices);
      else { hideReplies(); playScript(id); }
    }
    save();
  }
  function msgsOf(id) { return id === "bot" ? S.bot.msgs : S.h[id].msgs; }
  function renderRoomMsgs(id, revealOld) {
    const list = $("msg-list"); list.innerHTML = "";
    const msgs = msgsOf(id);
    const start = showAllDays ? 0 : Math.max(0, msgs.length - TAIL);
    if (start > 0) {
      const btn = document.createElement("button");
      btn.className = "day-fold";
      btn.textContent = `▲ 이전 대화 ${start}개 더 보기`;
      btn.onclick = () => { showAllDays = true; renderRoomMsgs(id, true); };
      list.appendChild(btn);
    }
    let lastDay = start > 0 ? (msgs[start - 1] || {}).d : null;
    for (let i = start; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.d && m.d !== lastDay) {
        const div = document.createElement("div");
        div.className = "day-divider"; div.textContent = "— DAY " + m.d + " —";
        list.appendChild(div); lastDay = m.d;
      }
      list.appendChild(msgEl(id, m));
    }
    if (revealOld) { $("msg-scroll").scrollTop = 0; stickBottom = false; }
    else { stickBottom = true; scrollBottom(true); }
  }
  function msgEl(id, m) {
    if (m.who === "c" || m.who === "note") {
      const d = document.createElement("div");
      d.className = "msg-center" + (m.who === "note" ? " note" : "");
      d.textContent = m.t; return d;
    }
    const row = document.createElement("div");
    const mine = m.who === "me";
    row.className = "msg-row" + (mine ? " me" : "");
    if (m.id) row.dataset.mid = m.id;
    let avatar = "";
    if (!mine) {
      if (id === "bot") avatar = `<div class="m-avatar">📱</div>`;
      else avatar = `<div class="m-avatar">${avatarHTML(id, m.emo || "normal")}</div>`;
    }
    const body = m.photo
      ? `<div class="bubble photo"><img src="${esc(m.photo)}" alt="${esc(m.cap || "그녀가 보낸 사진")}" decoding="async" role="button" tabindex="0" aria-label="사진 크게 보기">` +
        (m.cap ? `<div class="photo-cap">${esc(m.cap)}</div>` : "") + `</div>`
      : `<div class="bubble">${esc(m.t)}</div>`;
    row.innerHTML = `${avatar}${body}
      <div class="stamp">${mine && m.read1 ? '<span class="read1">1</span>' : ""}<span>${m.time || ""}</span></div>`;
    if (m.photo) {
      const im = row.querySelector("img");
      im.onerror = () => { row.remove(); };            // 파일이 없어도 게임은 계속된다
      im.onclick = () => openPhoto(m.photo);            // 탭하면 크게 본다
      im.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPhoto(m.photo); }
      };
      // 사진이 늦게 뜨면 smooth 스크롤이 어긋난다. 캐시로 이미 완료된 경우까지 함께 처리.
      const settle = () => { if (currentRoom && stickBottom) scrollBottom(true); };
      if (im.complete) setTimeout(settle, 0); else im.onload = settle;
    }
    return row;
  }
  const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* ---------------- 아바타 ----------------
     히로인에 faces 가 있으면 그림을, 없으면 기존 SVG 초상화를 쓴다.
     대본의 emo 는 happy/angry 도 쓰므로 파일이 있는 표정으로 매핑한다.
     이미지가 깨져도 그 자리에서 SVG 로 되돌아가므로 아바타가 비지 않는다. */
  const FACE_OF = { happy: "smile", angry: "normal", "": "normal" };
  function avatarHTML(id, emo) {
    const H = HERO.get(id); if (!H) return "";
    const e = emo || "normal";
    const faces = H.faces || {};
    const src = faces[e] || faces[FACE_OF[e] || e] || faces.normal;
    if (!src) return portraitSVG(H.portrait, e);
    return `<img class="face" src="${esc(src)}" alt="" draggable="false"` +
      ` onerror="window.__avatarFallback&&window.__avatarFallback(this,'${esc(id)}','${esc(e)}')">`;
  }
  // 인라인 onerror 에서 부르므로 전역에 하나만 노출한다.
  window.__avatarFallback = function (img, id, emo) {
    const H = HERO.get(id); if (!H || !img.parentNode) return;
    img.parentNode.innerHTML = portraitSVG(H.portrait, emo);
  };
  /* 사진 크게 보기 — 아무 데나 누르면 닫힌다 */
  function openPhoto(src) {
    let ov = $("photo-view");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "photo-view"; ov.className = "photo-view hidden";
      ov.innerHTML = `<img alt="사진"><button class="photo-close" aria-label="닫기">✕</button>`;
      ov.onclick = () => ov.classList.add("hidden");
      ov.onkeydown = (e) => { if (e.key === "Escape") ov.classList.add("hidden"); };
      $("app").appendChild(ov);
    }
    ov.querySelector("img").src = src;
    ov.classList.remove("hidden");
  }
  function scrollBottom(instant) {
    const sc = $("msg-scroll");
    sc.scrollTo({ top: sc.scrollHeight, behavior: instant ? "auto" : "smooth" });
  }
  /* 답장 바가 열리면 대화 영역이 그만큼(200px 이상) 줄어든다. 그런데 그 축소가
     반영되는 시점이 rAF 몇 프레임 뒤인지 보장되지 않아, 미리 스크롤하면 마지막
     대사가 바 뒤에 가려진 채로 남았다. 높이 변화를 직접 감지해 다시 붙인다.
     (모바일 키보드가 올라올 때도 같은 문제가 생긴다) */
  let stickBottom = true;
  function initScrollKeeper() {
    const sc = $("msg-scroll");
    if (!sc || sc.dataset.keeper) return;
    sc.dataset.keeper = "1";
    sc.addEventListener("scroll", () => {
      stickBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80;
    }, { passive: true });
    if (window.ResizeObserver) {
      new ResizeObserver(() => { if (stickBottom) scrollBottom(true); }).observe(sc);
    }
  }
  function scrollBottomSoon() {
    if (!stickBottom) return;
    scrollBottom(true);
    requestAnimationFrame(() => scrollBottom(true));
  }
  /* 선택지가 열리는 순간은 "지금 읽고 답하라"는 자리다. 유저가 위를 올려 읽던 중이면
     stickBottom 이 false 라 scrollBottomSoon 이 그냥 빠져나가고, 마지막 대사가 답장 바
     뒤에 가린 채 남았다. 여기서는 stickBottom 을 무시하고 강제로 붙인다.
     scrollHeight 로 계산하면 바 높이가 확정되기 전이라 목표를 놓치므로, 마지막 요소를
     직접 scrollIntoView 시켜 브라우저가 실제 가시 영역 기준으로 맞추게 한다. */
  function revealLastMessage() {
    stickBottom = true;
    const last = $("msg-list").lastElementChild;
    if (last && last.scrollIntoView) last.scrollIntoView({ block: "end", behavior: "auto" });
    else scrollBottom(true);
    requestAnimationFrame(() => scrollBottom(true));
  }
  function pushMsg(id, m) {
    m.d = S.day;
    msgsOf(id).push(m);
    if (id !== "bot") S.h[id].time = "지금";
    // 메시지는 한 줄씩 간격을 두고 도착하므로 즉시 스크롤로 충분하다.
    // smooth 는 사진이 늦게 로드돼 높이가 바뀌면 목표를 놓치고 마지막 줄을 화면 밖에 남긴다.
    if (currentRoom === id) {
      $("msg-list").appendChild(msgEl(id, m));
      if (stickBottom) scrollBottom(true);
    }
    else if (m.who !== "me") { if (id === "bot") S.bot.unread++; else S.h[id].unread++; }
    save();
  }

  /* ---------------- 중단 가능한 대기 ---------------- */
  let waitSkip = null;
  function wait(ms) {
    const eff = DEBUG ? Math.min(ms, 50) : ms;
    return new Promise((r) => {
      const t = setTimeout(() => { waitSkip = null; r(); }, eff);
      waitSkip = () => { clearTimeout(t); waitSkip = null; r(); };
    });
  }

  /* ---------------- 스크립트 재생 ---------------- */
  let typingEl = null, consecE = 0;
  async function playScript(id) {
    const token = ++playToken;
    const st = S.h[id], H = HERO.get(id);
    while (st.pending.length) {
      if (token !== playToken || currentRoom !== id) return;
      const node = st.pending[0];

      if (node.choices) {
        st.pending.shift(); st.pendingChoices = node.choices; save();
        showReplies(id, node.choices); return;
      }
      if (node.branch) {
        st.pending.shift();
        const hit = node.branch.find((b) => b.suit ? st.suit : b.flag ? st.flags[b.flag] : st.aff >= b.min);
        if (hit) st.pending = hit.then.concat(st.pending);
        save(); continue;
      }
      if (node.e !== undefined) {
        consecE++;
        const base = node.d || Math.min(420 + node.e.length * 20, 1150);
        await showTyping(id, consecE > 1 ? Math.round(base * 0.65) : base);
        if (token !== playToken) return;
        pushMsg(id, { who: "her", t: fmt(node.e, id), emo: st.emo, time: clock() });
        SND.receive(); st.pending.shift(); save();
        await wait(300); continue;
      }
      consecE = 0;
      /* 사진 전송 — 메신저다운 이벤트 연출. cap 은 사진 밑 한 줄 설명(선택) */
      if (node.photo !== undefined) {
        await showTyping(id, node.d || 900);
        if (token !== playToken) return;
        pushMsg(id, { who: "her", photo: node.photo, cap: node.cap ? fmt(node.cap, id) : "", time: clock() });
        SND.receive(); st.pending.shift(); save();
        await wait(500); continue;
      }
      if (node.me !== undefined) {
        await wait(450); if (token !== playToken) return;
        sendMine(id, fmt(node.me, id)); st.pending.shift(); save(); await wait(350);
      } else if (node.c !== undefined || node.note !== undefined) {
        await wait(400); if (token !== playToken) return;
        pushMsg(id, { who: node.c !== undefined ? "c" : "note", t: fmt(node.c !== undefined ? node.c : node.note, id) });
        st.pending.shift(); save();
      } else if (node.bot !== undefined) {
        st.pending.shift(); save(); botMsg(`[${H.name}] ` + node.bot, id);
      } else if (node.status !== undefined) {
        st.pending.shift(); st.status = node.status;
        $("chat-status").textContent = node.status;
        pushMsg(id, { who: "c", t: `${H.name}님이 상태메시지를 변경했습니다: “${node.status}”` });
        save(); await wait(300);
      } else if (node.emo !== undefined) {
        st.pending.shift(); st.emo = node.emo;
        $("chat-avatar").innerHTML = avatarHTML(id, node.emo);
        pushMsg(id, { who: "c", t: `${H.name}님이 프로필 사진을 변경했습니다` });
        save(); await wait(300);
      } else if (node.aff !== undefined) {
        st.pending.shift(); save(); addAff(id, node.aff);
      } else if (node.end !== undefined) {
        st.pending.shift(); save(); finishGame(id, node.end); return;
      } else { st.pending.shift(); save(); }
    }
    onScriptDone(id);
    save();
  }
  async function showTyping(id, ms) {
    const row = document.createElement("div");
    row.className = "msg-row";
    row.innerHTML = `<div class="m-avatar">${avatarHTML(id, S.h[id].emo)}</div><div class="typing"><i></i><i></i><i></i></div>`;
    $("msg-list").appendChild(row); typingEl = row;
    if (stickBottom) scrollBottom();
    await wait(ms);
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }
  function sendMine(id, text) {
    const m = { who: "me", t: text, time: clock(), read1: true, id: ++S.seq };
    pushMsg(id, m); SND.send();
    const mid = m.id;
    setTimeout(() => {
      m.read1 = false; save();
      if (currentRoom === id) {
        const span = $("msg-list").querySelector(`[data-mid="${mid}"] .read1`);
        if (span) span.remove();
      }
      SND.read();
    }, DEBUG ? 120 : rnd(700, 1600));
  }

  /* ---------------- 답장 ---------------- */
  const GATE_HINT = {
    str: "낮 일과 '⚔️ 왕립 훈련소'에서 근력이 오른다",
    int: "낮 일과 '📚 마탑 서고'에서 지능이 오른다",
    cha: "낮 일과 '🍺 달빛 정원'에서 매력이 오른다",
    gold: "낮 일과 '💼 길드 알바'로 골드를 벌 수 있다",
  };
  function showReplies(id, choices) {
    const bar = $("reply-bar");
    bar.innerHTML = "";
    if (!canReply(id)) {
      // 슬롯 소진 — 읽을 수는 있지만 답할 수 없다.
      // 이 안내를 띄웠다는 건 유저가 여기까지 실제로 읽었다는 뜻이므로 그때 기록한다.
      if (missedTurn(id)) { S.h[id].readPhase = phaseKey(); save(); }
      bar.innerHTML = `<div class="reply-none">오늘은 ${HERO.get(id).name}에게 답장할 여유가 없다.<br>
        <small>${S.phase === "morning" ? "아침" : "밤"} 답장 기회를 모두 썼다.</small></div>`;
      bar.classList.remove("hidden"); revealLastMessage(); return;
    }
    bar.innerHTML = `<div class="reply-label">▼ 답장을 선택하세요 (${slotsLeft(slotKind())}회 남음)</div>`;
    choices.forEach((c) => {
      const ok = checkReq(c.req);
      const btn = document.createElement("button");
      btn.className = "reply-btn " + (c.ignore ? "ghost" : ok ? (c.req ? "ok" : "") : "locked");
      let html = esc(fmt(c.t, id));
      if (c.req) {
        const label = c.req.stat ? ({ str: "근력", int: "지능", cha: "매력" }[c.req.stat] + " " + c.req.val) : c.req.gold + "G";
        html += `<span class="req">${ok ? "✦ " + label : "🔒 " + label + " 필요"}</span>`;
      }
      btn.innerHTML = html;
      if (ok) {
        if (c.ignore) {
          let armed = false, timer = null;
          btn.onclick = () => {
            if (!armed) {
              armed = true; btn.textContent = "…정말 답하지 않는다? (다시 탭)";
              btn.classList.add("confirm");
              timer = setTimeout(() => { armed = false; btn.classList.remove("confirm"); btn.innerHTML = esc(fmt(c.t, id)); }, 2500);
            } else { clearTimeout(timer); pickReply(id, c); }
          };
        } else btn.onclick = () => pickReply(id, c);
      } else {
        btn.onclick = () => {
          btn.classList.add("shake");
          const req = btn.querySelector(".req");
          if (req) {
            const orig = req.textContent;
            req.textContent = "💡 " + GATE_HINT[(c.req && c.req.stat) || "gold"];
            setTimeout(() => { req.textContent = orig; btn.classList.remove("shake"); }, 1700);
          }
        };
      }
      bar.appendChild(btn);
    });
    bar.classList.remove("hidden"); revealLastMessage();
  }
  function hideReplies() { $("reply-bar").classList.add("hidden"); }
  function checkReq(req) {
    if (!req) return true;
    if (req.gold !== undefined) return S.gold >= req.gold;
    if (req.stat) return S.stats[req.stat] >= req.val;
    return true;
  }
  function pickReply(id, c) {
    const st = S.h[id];
    st.pendingChoices = null; hideReplies();
    if (c.final) { runFinal(id, c); return; }
    if (c.end) { st.pending = ((HERO.get(id).endings[c.end] || {}).script || []).concat([{ end: c.end }]); save(); playScript(id); return; }
    if (!c.ignore) sendMine(id, fmt(c.t, id));
    else pushMsg(id, { who: "c", t: "당신은 답장을 보류했다…" });
    consumeSlot(id);
    if (c.req && c.req.gold) S.gold -= c.req.gold;
    if (c.suit) st.suit = true;
    if (c.flag) st.flags[c.flag] = true;
    if (c.clear) delete st.flags[c.clear];
    if (c.aff) addAff(id, c.aff);
    else if (c.style) {
      const mood = HERO.moodOf(id, S.day);
      const hit = MOOD_MATCH[mood] === c.style;
      const tbl = (S.phase === "morning" ? AFF_MORN : AFF_NIGHT)[S.day] || AFF_NIGHT[7];
      const amount = hit ? tbl.hit : tbl.miss;
      st.style[c.style] = (st.style[c.style] || 0) + 1;
      if (hit) st.hits++; else st.misses++;
      addAff(id, amount);
      botMsg(`[${HERO.get(id).name}] ` + (hit ? "【적중】 " : "") +
        pick(hit ? STYLE_FEEDBACK.hit : STYLE_FEEDBACK.ok) + ` (${STYLE_NM[c.style]} · +${amount})`);
    }
    if (c.then) st.pending = c.then.concat(st.pending);
    save();
    setTimeout(() => { if (currentRoom === id && !st.pendingChoices) playScript(id); }, DEBUG ? 60 : 500);
  }
  function runFinal(id, c) {
    const m = (c.t || "").match(/「(.+?)」/);
    sendMine(id, m ? m[1] : `${HERO.get(id).name}. 무도회, 나와 함께 가자.`);
    const key = S.h[id].aff >= SUCCESS_LINE ? "ok" : "fail";
    S.h[id].pending = HERO.get(id).endings[key].script.concat([{ end: key }]);
    save();
    setTimeout(() => { if (currentRoom === id) playScript(id); }, DEBUG ? 80 : 1000);
  }

  /* ---------------- 하루 흐름 ---------------- */
  function onScriptDone(id) {
    const st = S.h[id];
    // 선택지가 아예 없는 대화(회수된 아침 등)를 끝까지 본 경우도 "읽음"이다.
    if (!st.pendingChoices && missedTurn(id)) { st.readPhase = phaseKey(); save(); }
    if (!st.pendingChoices && canReply(id) === false && S.phase === "night" && S.day >= 7) { /* 최종일 */ }
    if (S.phase === "night" && !anyVisible()) S.phase = "done";
    renderHome();
  }
  /* 시간대가 끝나면 답하지 못한 대화의 선택지를 회수한다.
     이걸 안 하면 밤에 방을 열었을 때 아침 선택지가 그대로 떠서
     ① 아침 대화가 밤 슬롯을 잡아먹고 ② 아침 대사가 밤 호감도 표(AFF_NIGHT)로 계산되고
     ③ 정작 밤 대화는 슬롯이 없어 답장 불가가 된다.
     대사 노드는 남겨 나중에 읽을 수 있게 하고, 선택지 자리에는 지나간 표시만 남긴다.
     hurt 회복 분기처럼 선택지가 branch 안에 숨은 대본이 있어 재귀로 훑어야 한다. */
  const MISSED_MARK = "…답장하지 못한 채 아침이 지나갔다";
  function retireChoices(nodes) {
    return (nodes || []).map((n) => {
      if (n.choices) return { c: MISSED_MARK };
      if (n.branch) return { branch: n.branch.map((b) => Object.assign({}, b, { then: retireChoices(b.then) })) };
      return n;
    });
  }
  function retireUnanswered(id) {
    const st = S.h[id];
    if (!st.pendingChoices && !st.pending.some((n) => n.choices || n.branch)) return;
    if (st.pendingChoices) {
      // 선택지를 봤다는 건 이미 읽었다는 뜻이다. 배지가 다시 뜨지 않게 unread 는 건드리지 않는다.
      st.pendingChoices = null;
      msgsOf(id).push({ who: "c", t: MISSED_MARK, d: S.day });
    }
    st.pending = retireChoices(st.pending);
    save();
  }

  async function queueDay(day) {
    S.phase = "morning";
    S.used = { morning: [], night: [] };
    S.scouted = null;
    const ids = HERO.active();
    // 튜토리얼 → 본편 전환을 명시한다. 슬롯이 줄어드는 걸 모르면 D2 에서 당황한다.
    if (day === TUTORIAL_DAY) {
      botMsg(`【튜토리얼】 첫날은 ${ids.length}명 모두와 인사할 수 있습니다. 아침 ${ids.length}회, 밤 ${ids.length}회.\n` +
        "답장에는 직진·재치·배려 세 갈래가 있고 셋 다 유효합니다. 다만 그날 그 사람의 기분과 맞으면 훨씬 깊게 꽂힙니다.");
    } else if (day === TUTORIAL_DAY + 1) {
      botMsg(`【안내】 튜토리얼 종료. 오늘부터 답장은 아침 ${SLOTS.morning}회, 밤 ${SLOTS.night}회로 줄어듭니다.\n` +
        `${ids.length}명 중 최소 한 명은 매일 답을 받지 못합니다. 누구를 비울지가 이 게임의 전부입니다.`);
    }
    // 전원에게서 아침 메시지가 온다
    for (const id of ids) {
      const H = HERO.get(id), st = S.h[id];
      const dayData = (H.days || {})[day];
      if (!dayData) continue;
      (dayData.bot || []).forEach((t) => botMsg(`[${H.name}] ` + t, id));
      let morning = await aiOrScript(id, "morning", scriptFor(id, day, "morning") || []);
      if (st.flags.__ignored) { morning = (H.ignoreMorning || []).concat(morning); delete st.flags.__ignored; }
      st.pending = st.pending.concat(morning);
      st.time = "지금";
    }
    SND.receive(); save(); renderHome();
  }

  /* ---------------- 낮 일과 ---------------- */
  function openCards() {
    const card = $("modal-cards").querySelector(".modal-card");
    card.innerHTML = `<p class="cards-sys">【오늘의 일과 — 하나만 고를 수 있다】</p>
      <p class="cards-hint">스탯을 올리고, 그 자리에 있는 사람의 기분을 읽는다</p>
      <div id="card-list" class="card-list"></div>`;
    const list = $("card-list");
    CARDS.forEach((cd) => {
      const target = HERO.active().find((id) => HERO.get(id).likes === cd.stat);
      const who = target ? HERO.get(target).name : null;
      const el = document.createElement("div");
      el.className = "day-card";
      el.setAttribute("role", "button"); el.setAttribute("tabindex", "0");
      el.innerHTML = `<div class="ico">${cd.ico}</div><div><div class="nm">${cd.nm}</div>
        <div class="ds">${cd.ds}${who ? ` · <b>${who}</b>의 기분을 읽는다` : ""}</div></div>`;
      el.onclick = () => pickCard(cd, target);
      el.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickCard(cd, target); }
      };
      list.appendChild(el);
    });
    $("modal-cards").classList.remove("hidden");
  }
  function pickCard(cd, target) {
    SND.card();
    // 아침은 여기서 확정 종료된다(카드를 고르지 않으면 밤으로 갈 수 없다).
    HERO.active().forEach(retireUnanswered);
    S.phase = "day";
    let gain;
    if (cd.stat) {
      const n = rnd(cd.min, cd.max);
      S.stats[cd.stat] = (S.stats[cd.stat] || 0) + n;
      gain = ({ str: "근력", int: "지능", cha: "매력" }[cd.stat]) + " +" + n;
    } else {
      const g = rnd(cd.gold[0], cd.gold[1]);
      S.gold += g; gain = "+" + g + "G";
    }
    botMsg(CARD_RESULT[cd.id] + ` (${gain})`);
    S.scouted = target || null;
    let scoutText = "";
    if (target) {
      const H = HERO.get(target);
      const mood = HERO.moodOf(target, S.day);
      const sc = (H.scout || MOOD_SCOUT).clear;
      scoutText = (sc && sc[mood]) ? `[${H.name}] ` + sc[mood] : "";
      if (scoutText) botMsg(scoutText);
    }
    save();
    showDayScene(cd, gain, scoutText);
  }
  function showDayScene(cd, gain, scoutText) {
    const card = $("modal-cards").querySelector(".modal-card");
    card.innerHTML =
      `<p class="cards-sys">【 ${cd.ico} ${cd.nm} 】</p>
       <div class="scene-body">${esc(pick(DAY_SCENES[cd.id]))}</div>
       <div class="scene-gain">${gain}</div>
       ${scoutText ? `<div class="scene-scout">${esc(scoutText)}</div>` : ""}
       <button id="btn-scene-ok" class="btn btn-primary">🌙 밤이 된다</button>`;
    card.querySelector("#btn-scene-ok").onclick = startNight;
  }
  async function startNight() {
    $("modal-cards").classList.add("hidden");
    S.phase = "night";
    for (const id of HERO.active()) {
      const st = S.h[id];
      const night = await aiOrScript(id, "night", scriptFor(id, S.day, "night") || []);
      if (night.length) { st.pending = st.pending.concat([{ c: "— 🌙 그날 밤 —" }]).concat(night); st.time = "지금"; }
    }
    SND.receive(); save();
    const sb = $("btn-sleep");
    sb.style.pointerEvents = "none";
    setTimeout(() => { sb.style.pointerEvents = ""; }, 500);
    renderHome();
  }

  /* ---------------- 취침 ---------------- */
  function trySleep() {
    const unfinished = S.phase === "night" && slotsLeft("night") > 0 && anyVisible();
    if (unfinished && !sleepArmed) {
      sleepArmed = true;
      clearTimeout(sleepArmTimer);
      sleepArmTimer = setTimeout(() => { sleepArmed = false; renderHome(); }, 2500);
      renderHome(); return;
    }
    clearTimeout(sleepArmTimer); sleepArmed = false;
    sleepDay(unfinished);
  }
  function sleepDay(ignored) {
    HERO.active().forEach((id) => {
      const st = S.h[id];
      const talked = (S.used.morning || []).indexOf(id) >= 0 || (S.used.night || []).indexOf(id) >= 0;
      if (!talked) {
        st.noReplyDays = (st.noReplyDays || 0) + 1;
        if (st.noReplyDays >= 2) { st.flags.__ignored = true; st.noReplyDays = 0; addAff(id, -3); }
      } else st.noReplyDays = 0;
      st.pending = []; st.pendingChoices = null;
    });
    if (ignored) botMsg("답장 기회를 남긴 채 하루를 마쳤습니다. 남은 기회는 이월되지 않습니다.");
    S.day++; showAllDays = false; save();
    queueDay(S.day);
  }

  /* ---------------- 최종 신청 ---------------- */
  function openFinal() {
    const box = $("modal-final").querySelector(".modal-card");
    const ids = HERO.active();
    box.innerHTML = `<p class="cards-sys">【 건국제의 밤 】</p>
      <p class="final-desc">광장 분수 앞. 오늘 밤, 단 한 사람에게만 파트너를 신청할 수 있다.</p>
      <div id="final-list" class="card-list"></div>
      <button id="btn-final-none" class="btn btn-ghost">…아무에게도 말하지 못했다</button>`;
    const list = $("final-list");
    ids.forEach((id) => {
      const H = HERO.get(id);
      const el = document.createElement("div");
      el.className = "day-card";
      el.setAttribute("role", "button"); el.setAttribute("tabindex", "0");
      el.innerHTML = `<div class="avatar-sm">${avatarHTML(id, S.h[id].emo)}</div>
        <div><div class="nm">${H.name}</div><div class="ds">${H.title}</div></div>`;
      el.onclick = () => { $("modal-final").classList.add("hidden"); confessTo(id); };
      el.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); }
      };
      list.appendChild(el);
    });
    box.querySelector("#btn-final-none").onclick = () => {
      $("modal-final").classList.add("hidden");
      chickenOut();
    };
    $("modal-final").classList.remove("hidden");
  }

  /* 호감도 → 엔딩 키. 히로인이 그 구간 텍스트를 안 가졌으면 성사선 기준으로 폴백 */
  function endingKeyFor(id, aff) {
    const E = HERO.get(id).endings || {};
    const want = aff >= 90 ? "truelove" : aff >= 80 ? "ok" : aff >= 65 ? "near" : aff >= 45 ? "fail" : "stranger";
    if (E[want]) return want;
    return aff >= SUCCESS_LINE ? (E.ok ? "ok" : want) : (E.fail ? "fail" : want);
  }
  /* 미선택 히로인의 그날 밤 결말.
     전용 텍스트(endings.unpicked)는 "그의 선택이 그녀가 아니었다"를 전제로 쓰였으므로
     실제로 누군가에게 신청한 밤에만 쓴다. 신청 없이 끝난 밤(chicken/night)은
     그 전제가 거짓이라 기존 엔딩(night/chicken/stranger)으로 폴백한다. */
  function unpickedEnding(id, confessed) {
    const E = HERO.get(id).endings || {};
    const tier = S.h[id].aff >= 65 ? "high" : S.h[id].aff >= 45 ? "mid" : "low";
    if (confessed && E.unpicked && E.unpicked[tier]) return E.unpicked[tier];
    return tier === "high" ? (E.night || E.chicken || E.stranger || null)
         : tier === "mid" ? (E.chicken || E.stranger || null)
         : (E.stranger || E.chicken || null);
  }
  /* 가장 호감이 높은 히로인 */
  function topHeroine() {
    let top = null, best = -1;
    HERO.active().forEach((id) => { if (S.h[id].aff > best) { best = S.h[id].aff; top = id; } });
    return top;
  }
  function endWithScript(id, key) {
    const st = S.h[id];
    st.pendingChoices = null;
    st.pending = ((HERO.get(id).endings[key] || {}).script || []).concat([{ end: key }]);
    save();
    openRoom(id);
  }
  function confessTo(id) {
    endWithScript(id, endingKeyFor(id, S.h[id].aff));
  }
  /* 아무에게도 신청하지 못한 밤 — 호감이 남아 있으면 「밤에만 오는 연락」 */
  function chickenOut() {
    const top = topHeroine();
    if (top === null) { finishGame(null, "chicken"); return; }
    const key = (S.h[top].aff >= 65 && (HERO.get(top).endings || {}).night) ? "night" : "chicken";
    if (((HERO.get(top).endings || {})[key] || {}).script) endWithScript(top, key);
    else finishGame(null, "chicken");
  }

  /* ---------------- 엔딩 ---------------- */
  /* 축 2·3 — 스타일 최다 / 최고 스탯으로 후일담 문단을 고른다 */
  function epilogueFor(id) {
    const EP = (HERO.get(id) || {}).epilogue;
    if (!EP) return [];
    const sv = S.h[id].style || {};
    let topStyle = "none", n = 0;
    ["bold", "wit", "care"].forEach((k) => { if ((sv[k] || 0) > n) { n = sv[k] || 0; topStyle = k; } });
    let topStat = "none", v = 0;
    ["str", "int", "cha"].forEach((k) => { if ((S.stats[k] || 0) > v) { v = S.stats[k] || 0; topStat = k; } });
    if (v < 10 && S.gold >= 60) topStat = "gold";
    return [(EP.style || {})[topStyle], (EP.stat || {})[topStat]].filter(Boolean);
  }
  function outcomeMark(o) {
    if (o.picked) return S.endedSuccess ? "💞" : "💧";
    return o.aff >= SUCCESS_LINE ? "💔" : o.aff >= 40 ? "🌱" : "·";
  }

  function finishGame(id, key) {
    const confessed = key !== "chicken" && key !== "night";
    S.ended = key; S.endedWith = id;
    S.endedSuccess = key === "truelove" || key === "ok";
    // 나머지 히로인의 결말
    S.outcomes = HERO.active().map((hid) => ({
      id: hid, name: HERO.get(hid).name, aff: S.h[hid].aff,
      picked: confessed && hid === id,
    }));
    save();
    const E = (id && (HERO.get(id).endings || {})[key]) ||
      { icon: "🌙", title: "말하지 못한 밤", desc: "자정. 분수의 물이 멎었다. 당신은 끝내 광장에 나가지 못했다." };
    $("ending-icon").textContent = E.icon;
    $("ending-title").textContent = E.title;
    $("ending-desc").textContent = E.desc;
    // 엔딩 일러스트 (있으면) — 없으면 이모지 아이콘만
    const art = $("ending-art");
    if (art) {
      const src = E.art || (id ? (HERO.get(id).endingArt || null) : null);
      if (src) {
        art.innerHTML = `<img src="${esc(src)}" alt="">`;
        art.querySelector("img").onerror = () => { art.classList.add("hidden"); };
        art.classList.remove("hidden");
      } else art.classList.add("hidden");
    }
    // 후일담 (스타일 축 + 스탯 축)
    const epi = $("ending-epilogue");
    if (epi) {
      const parts = id ? epilogueFor(id) : [];
      epi.innerHTML = parts.map((p) =>
        `<p class="epi">${esc(p).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>")}</p>`).join("");
      epi.classList.toggle("hidden", !parts.length);
    }
    // 나머지 히로인의 그날 밤 — 호감도 내림차순. 동시형의 마무리는 여기까지가 한 세트다.
    const others = $("ending-others");
    if (others) {
      const rest = HERO.active().filter((hid) => hid !== id)
        .sort((a, b) => S.h[b].aff - S.h[a].aff);
      const cards = rest.map((hid) => {
        const E2 = unpickedEnding(hid, confessed);
        if (!E2) return "";
        const H2 = HERO.get(hid);
        return `<div class="other-ending">
          <div class="oe-head">${E2.icon || "·"} <b>${esc(H2.name)}</b><span class="oe-title"> · ${esc(E2.title || "")}</span></div>
          <p class="oe-desc">${esc(E2.desc || "").replace(/\n/g, "<br>")}</p></div>`;
      }).filter(Boolean);
      others.innerHTML = cards.length
        ? `<p class="oe-sys">— 같은 밤, 다른 곳에서 —</p>` + cards.join("")
        : "";
      others.classList.toggle("hidden", !cards.length);
    }
    const chips = [];
    S.outcomes.forEach((o) => {
      chips.push(`<span class="chip">${outcomeMark(o)} ${o.name} <b>${o.aff}</b></span>`);
    });
    chips.push(`<span class="chip">근력 <b>${S.stats.str}</b></span>`);
    chips.push(`<span class="chip">지능 <b>${S.stats.int}</b></span>`);
    chips.push(`<span class="chip">매력 <b>${S.stats.cha}</b></span>`);
    $("ending-stats").innerHTML = chips.join("");
    if (S.endedSuccess) SND.fanfare();
    $("share-box").classList.add("hidden");
    show("scr-ending");
  }

  /* ---------------- 결과 공유 ---------------- */
  const RANK = (a) => a >= 90 ? "S · 알파남" : a >= 80 ? "A · 알파 후보" : a >= 60 ? "B · 동네 인기남"
    : a >= 40 ? "C · 훈남 지망생" : "D · 아직 사람입니다";
  function shareText() {
    const id = S.endedWith;
    const E = (id && (HERO.get(id).endings || {})[S.ended]) || { icon: "🌙", title: "말하지 못한 밤" };
    const best = Math.max.apply(null, (S.outcomes || []).map((o) => o.aff).concat([0]));
    const lines = [
      "【이세계알파남 : 알파톡】",
      `${E.icon} ${E.title}`,
      "",
      `알파 등급 ${RANK(best)}`,
    ];
    (S.outcomes || []).forEach((o) => {
      lines.push(`${outcomeMark(o)} ${o.name} ${o.aff}/100`);
    });
    lines.push(`근력 ${S.stats.str} · 지능 ${S.stats.int} · 매력 ${S.stats.cha}`);
    lines.push("", "— 그녀들에게서, 먼저 연락이 온다 —", location.origin + location.pathname);
    return lines.join("\n");
  }
  async function doShare() {
    const txt = shareText(), box = $("share-box");
    box.textContent = txt; box.classList.remove("hidden");
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(txt); ok = true; } } catch (e) {}
    if (!ok) {
      const r = document.createRange(); r.selectNodeContents(box);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    $("btn-share").textContent = ok ? "✅ 복사됐습니다! 붙여넣기 하세요" : "👆 위 글을 길게 눌러 복사하세요";
    setTimeout(() => { $("btn-share").textContent = "📋 결과 복사해서 자랑하기"; }, 4000);
  }

  /* ---------------- AI 설정 ---------------- */
  function renderBadge() {
    const b = $("ai-badge"); if (!b) return;
    const on = AI.enabled();
    b.textContent = on ? "AI ON" : "AI OFF";
    b.className = "ai-badge " + (on ? "on" : "off");
  }
  function renderModels() {
    const list = $("model-list"), cur = AI.getCfg().model;
    list.innerHTML = "";
    AI.MODELS.forEach((m) => {
      const el = document.createElement("div");
      el.className = "model-opt" + (m.id === cur ? " sel" : "");
      el.setAttribute("role", "radio"); el.setAttribute("tabindex", "0");
      el.setAttribute("aria-checked", String(m.id === cur));
      el.innerHTML = `<div class="m-nm">${m.nm}</div><div class="m-ds">${m.ds}</div><div class="m-cost">${m.cost}</div>`;
      el.onclick = () => { const c = AI.getCfg(); c.model = m.id; AI.setCfg(c); renderModels(); };
      el.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.click(); }
      };
      list.appendChild(el);
    });
  }
  const aiStatus = (m, k) => { const el = $("ai-status"); el.textContent = m; el.className = "ai-status " + (k || ""); };
  function bindSettings() {
    $("btn-settings").onclick = () => {
      $("inp-apikey").value = AI.getKey(); renderModels();
      $("ai-status").className = "ai-status hidden";
      $("modal-ai").classList.remove("hidden");
    };
    $("btn-ai-close").onclick = () => { $("modal-ai").classList.add("hidden"); renderBadge(); };
    $("btn-ai-save").onclick = () => {
      const k = $("inp-apikey").value.trim();
      AI.setKey(k); const c = AI.getCfg(); c.on = !!k; AI.setCfg(c); renderBadge();
      aiStatus(k ? "저장됐습니다. AI 대화 생성이 켜졌습니다." : "키를 지웠습니다. 대본 모드로 플레이됩니다.", "ok");
    };
    $("btn-ai-test").onclick = async () => {
      const k = $("inp-apikey").value.trim();
      if (!k) { aiStatus("먼저 API 키를 입력하세요.", "err"); return; }
      AI.setKey(k); const c = AI.getCfg(); c.on = true; AI.setCfg(c);
      aiStatus("테스트 중…", "");
      const probe = { name: "테스터", day: 1, stats: { str: 0, int: 0 }, gold: 0, aff: 5,
                      ai: { memos: [], fails: 0 }, heroine: HERO.get(HERO.active()[0]) };
      const nodes = await AI.generate("morning", probe);
      if (nodes) {
        const first = (nodes.find((n) => n.e !== undefined) || {}).e || "";
        aiStatus("✅ 연결 성공! 「" + first.slice(0, 55) + "」", "ok"); renderBadge();
      } else aiStatus("❌ 실패: " + (probe.ai.lastError || "알 수 없는 오류"), "err");
    };
    renderBadge();
  }

  /* ---------------- 시작 ---------------- */
  function newGame() {
    S = freshState(); $("inp-name").value = "";
    show("scr-naming"); setTimeout(() => $("inp-name").focus(), 100);
  }
  function confirmName() {
    S.name = $("inp-name").value.trim() || "김철수";
    save(); goHome(); queueDay(1);
  }
  function bindBack() {
    $("btn-back").onclick = () => {
      playToken++;
      if (typingEl) { typingEl.remove(); typingEl = null; }
      if (S.ended) finishGame(S.endedWith, S.ended); else goHome();
    };
  }
  function bind() {
    $("btn-new").onclick = () => { SND.unlock(); newGame(); };
    $("btn-continue").onclick = () => { SND.unlock(); S = load(); if (S) { S.ended ? finishGame(S.endedWith, S.ended) : goHome(); } };
    $("btn-name-ok").onclick = confirmName;
    $("inp-name").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmName(); });
    bindBack();
    $("btn-daycard").onclick = openCards;
    $("btn-sleep").onclick = trySleep;
    if ($("btn-final")) $("btn-final").onclick = openFinal;
    $("btn-retry").onclick = () => { wipe(); location.reload(); };
    $("btn-log").onclick = () => { showAllDays = true; openRoom(S.endedWith || HERO.active()[0]); hideReplies(); };
    $("btn-share").onclick = doShare;
    $("msg-scroll").addEventListener("click", () => { if (waitSkip) waitSkip(); });
    bindSettings();
    if (load()) $("btn-continue").classList.remove("hidden");
    if (DEBUG) buildDebugPanel();
  }

  /* ---------------- 개발자 패널 ---------------- */
  function toastDbg(m) {
    const el = $("dbg-msg");
    if (el) { el.textContent = m; setTimeout(() => { if (el.textContent === m) el.textContent = ""; }, 2600); }
  }
  function skipDay() {
    if (!S || S.ended) return;
    if (S.day >= 7) { openFinal(); return; }
    HERO.active().forEach((id) => { S.h[id].pending = []; S.h[id].pendingChoices = null; });
    S.phase = "night"; sleepDay(false);
  }
  function buildDebugPanel() {
    const w = document.createElement("div");
    w.id = "dbg-panel";
    w.innerHTML = `<div class="dbg-head">🛠 DEV <button id="dbg-fold">▾</button></div>
      <div id="dbg-body" class="dbg-body">
        <div class="dbg-row" id="dbg-r1"></div><div class="dbg-row" id="dbg-r2"></div>
        <div class="dbg-row" id="dbg-r3"></div><div id="dbg-msg" class="dbg-msg"></div></div>`;
    $("app").appendChild(w);
    const mk = (row, label, fn) => {
      const b = document.createElement("button");
      b.className = "dbg-btn"; b.textContent = label; b.onclick = fn;
      $(row).appendChild(b);
    };
    mk("dbg-r1", "스탯+10", () => { S.stats.str += 10; S.stats.int += 10; S.stats.cha += 10; S.gold += 40; save(); renderHome(); toastDbg("전 스탯 +10, 골드 +40"); });
    mk("dbg-r1", "호감+15", () => { HERO.active().forEach((id) => addAff(id, 15)); renderHome(); toastDbg(HERO.active().map((i) => S.h[i].aff).join(" / ")); });
    mk("dbg-r1", "슬롯 리필", () => { S.used = { morning: [], night: [] }; save(); renderHome(); toastDbg("답장 기회 초기화"); });
    mk("dbg-r2", "하루 건너뛰기", skipDay);
    mk("dbg-r2", "D7로", () => { S.day = 7; S.phase = "night"; S.used = { morning: [], night: [] }; save(); renderHome(); toastDbg("D7 밤 — 최종 신청 가능"); });
    mk("dbg-r2", "최종 신청", openFinal);
    const END_BTNS = [["truelove", "💞진"], ["ok", "💃성사"], ["near", "🌧️반걸음"],
                      ["fail", "🌱아직"], ["stranger", "🌫️남"], ["night", "🌙밤연락"]];
    HERO.active().forEach((id) => {
      END_BTNS.forEach(([key, label]) => {
        if (!((HERO.get(id).endings || {})[key] || {}).script) return;
        mk("dbg-r3", label, () => endWithScript(id, key));
      });
    });
    mk("dbg-r3", "🌙겁쟁이", chickenOut);
    mk("dbg-r3", "🔎후일담", () => {
      const id = topHeroine(); if (id === null) return;
      const sv = S.h[id].style || {};
      const st = ["str", "int", "cha"].map((k) => k + S.stats[k]).join(" ");
      toastDbg(`호감 ${S.h[id].aff} → ${endingKeyFor(id, S.h[id].aff)} · 스타일 b${sv.bold || 0}/w${sv.wit || 0}/c${sv.care || 0} · ${st} · ${S.gold}G`);
    });
    $("dbg-fold").onclick = () => {
      const b = $("dbg-body"), hid = b.style.display === "none";
      b.style.display = hid ? "" : "none";
      $("dbg-fold").textContent = hid ? "▾" : "▸";
    };
  }

  document.addEventListener("DOMContentLoaded", bind);
})();

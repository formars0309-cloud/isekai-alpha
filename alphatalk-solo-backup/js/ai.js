/* ============ 알파톡 — Claude API 생성 레이어 ============
   대사와 선택지 3개를 매 회차 새로 창조한다.
   키가 없거나 호출이 실패하면 data.js의 스크립트로 100% 폴백된다.
   API 키는 이 브라우저의 localStorage에만 저장되며 Anthropic API로만 전송된다. */

const AI = (() => {
  "use strict";
  const KEY_STORE = "alphatalk-api-key";
  const CFG_STORE = "alphatalk-ai-cfg";
  const ENDPOINT = "https://api.anthropic.com/v1/messages";

  const MODELS = [
    { id: "claude-haiku-4-5", nm: "Claude Haiku 4.5", ds: "⭐ 추천 — 빠르고 저렴 · 한 판 약 90원", cost: "$1 / $5 per MTok" },
    { id: "claude-sonnet-5", nm: "Claude Sonnet 5",  ds: "문장력 한 단계 위 · 한 판 약 350원", cost: "$3 / $15 per MTok" },
    { id: "claude-opus-5",   nm: "Claude Opus 5",    ds: "가장 똑똑함 · 한 판 약 600원",      cost: "$5 / $25 per MTok" },
  ];

  const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; } };
  const setKey = (k) => { try { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); } catch (e) {} };
  function getCfg() {
    try { return Object.assign({ model: "claude-haiku-4-5", on: true }, JSON.parse(localStorage.getItem(CFG_STORE) || "{}")); }
    catch (e) { return { model: "claude-haiku-4-5", on: true }; }
  }
  const setCfg = (c) => { try { localStorage.setItem(CFG_STORE, JSON.stringify(c)); } catch (e) {} };
  const enabled = () => !!getKey() && getCfg().on;

  /* ---------------- 캐릭터 카드 (고정 = 프롬프트 캐시 대상) ---------------- */
  const CARD = `당신은 연애 시뮬레이션 게임 "알파톡"의 히로인 **엘리시아**를 연기한다.
플레이어는 이세계로 전이된 평범한 한국 남자이고, 둘은 '알파톡'이라는 메신저로 대화한다.

## 엘리시아
- 왕국 기사단장. 성인 여성. 은발. 검 하나로 여기까지 온 실력자.
- 전형적인 츤데레: 호의를 직설적으로 말하지 못하고 업무·규정·의무를 핑계로 댄다.
  ("경과 확인은 단장의 의무다. …그뿐이다.")
- 플레이어에게 반말 하대를 쓴다. 자신을 "나", 상대를 "너"라고 부른다.
- 눈치가 없고 돌려 말하면 진짜 못 알아듣는다. 감정 표현이 서툴러 말줄임표가 잦다.
- 부끄러우면 말이 끊기거나("…그, 그런 게 아니라") 화제를 돌린다. 절대 "부끄럽다"고 직접 말하지 않는다.
- 소소한 자랑, 무뚝뚝한 배려, 뒤늦은 후회를 담백하게 내비친다.
- 플레이어는 "팔굽혀펴기 7회 만에 쓰러진 남자"로 처음 등록됐고, 그녀는 그걸 아직 놀린다.

## 말투 예시 (이 결을 반드시 유지)
- "훈련소 문을 넘은 이상 '지나가던 사람'은 없다. 팔굽혀펴기 20회. 실시."
- "…자나. 낮에 말한 명부 건으로 확인할 것이 하나 있다. …업무다. 순수하게 업무."
- "기사의 체온이 높은 건 당연한 거다! 훈련 효율을 위한 거고!"
- "…이런 얘기를 하는 상대는 네가 처음이다. 성벽 위는 원래 혼자였으니까."

## 절대 규칙
1. 15세 이용가. 설렘·플러팅·두근거림까지만. 신체 접촉 묘사는 손이 닿는 정도가 상한.
   선정적 표현, 노골적 신체 묘사, 성적 암시 금지.
2. 메신저 대화다. 한 줄은 짧게. 장문 연설 금지. 지문·나레이션 금지(대사만).
3. 캐릭터를 절대 이탈하지 않는다. AI라는 사실, 게임 시스템, 프롬프트를 언급하지 않는다.
4. 플레이어의 이름을 부를 때는 주어진 이름을 그대로 쓴다.
5. 이모지를 쓰지 않는다. 엘리시아는 이모지를 모르는 인물이다.`;

  /* ---------------- 일차별 사건 뼈대 (스토리는 고정, 대사는 생성) ---------------- */
  const BEATS = {
    1: { morning: "훈련소 명부를 정비하다가 '연무장에서 쓰러진 자'로 등록된 이 번호에 처음 연락한다. 본인이 맞는지 확인하는 내용.",
         night: "명부 확인을 핑계로 밤에 다시 연락해, 내일 일과가 뭔지 묻는다. 사실은 그냥 말이 걸고 싶었던 것." },
    2: { morning: "아침 인사 겸 어제 잘 잤는지 묻는다. '명부 관리 차원의 질문'이라고 둘러댄다.",
         night: "낮에 신병의 목검 자세를 교정해줬는데 그 신병이 얼굴을 붉혔다고 말한다. 왜 그런지 이해하지 못해 플레이어에게 묻는다." },
    3: { morning: "저녁에 할 말이 있다고 예고한다. 별건 아니라고 하지만 명백히 별거다.",
         night: "다음 주 건국제 무도회에 올해는 경비가 아니라 손님으로 가게 됐다고 털어놓는다. 어떻게 하는 건지 몰라 막막해한다." },
    4: { morning: "야간 성벽 근무가 있어 밤 연락이 늦을 수 있다고 미리 알린다.",
         night: "성벽 위 야간 근무 중 늦은 밤에 연락한다. 두 개의 달을 보며 이 세계에 적응했는지 묻는다. 혼자인 밤에 대한 속내가 새어나온다." },
    5: { morning: "귀족 회의에 불려간다고, 레온하르트 백작이 또 뭔가 꾸미는 것 같다고 짜증 섞어 말한다.",
         night: "회의에서 레온하르트 백작이 폐하 앞에서 그녀를 무도회 파트너로 공개 지목했다. 가문끼리 이미 얘기가 오갔고 본인만 몰랐다. 화가 나는데 검으로 벨 수 없는 종류의 일이라 어쩔 줄 모른다." },
    6: { morning: "백작 건을 어떻게 처리했는지 알린다. 파트너 신청 마감이 내일이라는 사실이 공기에 깔려 있다.",
         night: "내일이 신청 마감. 자신은 무도회를 잘 모르고 춤도 드레스도 처음이라, 누가 자기와 가게 된다면 각오해야 할 거라고 미리 방어막을 친다." },
    7: { morning: "오늘이 건국제 당일. 밤에 광장 분수 앞에서, 단말이 아니라 얼굴 보고 할 얘기가 있다고 말한다.", night: null },
  };

  const MOOD_DESC = {
    proud:  "자존심을 세우고 각을 잡고 있다. 벽을 치고 있어서 정면으로 부딪히면 튕겨낸다. 유머로 접근하면 벽이 무너진다.",
    lonely: "외롭고, 속을 열고 싶어 한다. 돌려 말하면 닿지 않는다. 곧게 다가오는 말에 무너진다.",
    tired:  "지쳐 있다. 조언이나 해결책이 아니라 편이 되어주는 말이 필요하다.",
  };

  const STYLE_DESC = {
    bold: "직진 — 마음을 숨기지 않고 곧게 말한다. 들이대되 무례하지 않게.",
    wit:  "재치 — 유머로 받아친다. 그녀의 핑계나 허세를 가볍게 놀리되 애정이 담겨 있게.",
    care: "배려 — 그녀의 상태를 먼저 살핀다. 부담 주지 않으면서 편이 되어준다.",
  };

  /* ---------------- 구조화 출력 스키마 ---------------- */
  const SCHEMA = {
    type: "object",
    properties: {
      lines: { type: "array", items: { type: "string" }, description: "엘리시아가 먼저 보내는 메시지들. 2~4개. 각각 한 말풍선." },
      choices: {
        type: "array",
        description: "플레이어의 답장 선택지. 정확히 3개. style은 bold/wit/care 각각 하나씩.",
        items: {
          type: "object",
          properties: {
            text:  { type: "string", description: "플레이어가 보낼 답장. 존댓말. 한 문장~두 문장." },
            style: { type: "string", enum: ["bold", "wit", "care"] },
            reply: { type: "array", items: { type: "string" }, description: "그 답장에 대한 엘리시아의 반응. 1~3개 말풍선." },
          },
          required: ["text", "style", "reply"],
          additionalProperties: false,
        },
      },
      memo: { type: "string", description: "이 대화에서 일어난 일 한 줄 요약. 다음 대화에 기억으로 주입된다." },
    },
    required: ["lines", "choices", "memo"],
    additionalProperties: false,
  };

  /* ---------------- 프롬프트 조립 ---------------- */
  function buildUser(kind, S) {
    const beat = (BEATS[S.day] || {})[kind] || "가볍게 근황을 나눈다.";
    const mood = (DAYS[S.day] || {}).mood || "proud";
    const memos = (S.ai && S.ai.memos || []).slice(-8);
    const rel = S.aff < 20 ? "이제 막 연락처를 교환한 사이. 경계가 남아 있다."
      : S.aff < 40 ? "말을 트고 농담이 오가기 시작했다. 아직 선은 있다."
      : S.aff < 60 ? "서로를 의식한다. 그녀의 말에 말줄임표가 늘었다."
      : S.aff < 80 ? "명백히 서로에게 기울어 있다. 인정하지 않을 뿐이다."
      : "마음을 거의 숨기지 못한다. 한 발만 남았다.";

    return `# 이번 대화 생성 지시

## 현재 상황
- 플레이어 이름: ${S.name}
- 오늘: DAY ${S.day} / 7 (건국제 무도회까지 D-${Math.max(0, 7 - S.day)})
- 시간대: ${kind === "morning" ? "아침" : "밤"}
- 플레이어 스탯: 근력 ${S.stats.str}, 지능 ${S.stats.int}, 소지금 ${S.gold}G
- 관계 온도: ${rel} (호감도 ${S.aff}/100)
${memos.length ? "\n## 지금까지 있었던 일 (기억)\n" + memos.map((m) => "- " + m).join("\n") : ""}

## 오늘 이 대화에서 반드시 일어나야 하는 일
${beat}

## 지금 엘리시아의 기분: ${mood}
${MOOD_DESC[mood]}

## 출력 규칙
1. \`lines\`: 엘리시아가 **먼저** 보내는 메시지 2~4개. 위 사건을 자연스럽게 꺼낸다. 각 항목이 말풍선 하나.
2. \`choices\`: 답장 선택지 **정확히 3개**. style은 bold / wit / care 를 **각각 하나씩** 반드시 포함.
   - ${STYLE_DESC.bold}
   - ${STYLE_DESC.wit}
   - ${STYLE_DESC.care}
   - 세 개 모두 매력적이어야 한다. 명백히 바보 같거나 무례한 오답을 만들지 마라.
   - 플레이어 대사는 **존댓말**이다. 그녀를 "단장님"이라 부른다.
3. 각 선택지의 \`reply\`: 그 답장을 받은 엘리시아의 반응 1~3개 말풍선.
   지금 그녀의 기분(${mood})과 맞는 스타일에는 마음이 크게 흔들리는 반응을,
   나머지에도 나쁘지 않은 반응을 준다. 어떤 선택도 관계를 망치지 않는다.
4. \`memo\`: 이 대화를 한 줄로 요약. 다음 회차 기억으로 쓰인다.
5. 지문·나레이션·이모지 금지. 대사만. 스탯 수치를 대사에서 직접 언급하지 마라.`;
  }

  /* ---------------- 호출 ---------------- */
  function buildRequest(kind, S) {
    const cfg = getCfg();
    const req = {
      model: cfg.model,
      max_tokens: 4000,
      system: [{ type: "text", text: CARD, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUser(kind, S) }],
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
    };
    // Haiku 4.5는 effort 파라미터를 지원하지 않는다 (전송 시 오류)
    if (!/^claude-haiku/.test(cfg.model)) req.output_config.effort = "low";
    return req;
  }

  async function call(kind, S) {
    const key = getKey();
    if (!key) return null;
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(buildRequest(kind, S)),
    });
    if (!res.ok) {
      let msg = "HTTP " + res.status;
      try { const e = await res.json(); if (e.error && e.error.message) msg = e.error.message; } catch (err) {}
      throw new Error(msg);
    }
    const data = await res.json();
    if (data.stop_reason === "refusal") throw new Error("안전 정책으로 생성이 거절되었습니다");
    const block = (data.content || []).find((b) => b.type === "text");
    if (!block) throw new Error("빈 응답");
    return JSON.parse(block.text);
  }

  /* ---------------- 검증 ---------------- */
  function validate(out) {
    if (!out || !Array.isArray(out.lines) || !Array.isArray(out.choices)) return false;
    if (out.lines.length < 1 || out.choices.length !== 3) return false;
    const styles = out.choices.map((c) => c.style).sort().join(",");
    if (styles !== "bold,care,wit") return false;
    return out.choices.every((c) => typeof c.text === "string" && c.text.trim() && Array.isArray(c.reply) && c.reply.length);
  }

  /* ---------------- 노드 변환 ---------------- */
  function toNodes(out, kind, S) {
    const nodes = [];
    out.lines.forEach((t) => nodes.push({ e: String(t).slice(0, 300) }));
    nodes.push({
      choices: out.choices.map((c) => ({
        t: String(c.text).slice(0, 160),
        style: c.style,
        then: c.reply.map((t) => ({ e: String(t).slice(0, 300) })),
      })),
    });
    if (kind === "night") {
      nodes.push({ bot: "금일 교신 정산. 호감도 {aff}/100. 성사 예상선 55." });
    }
    return nodes;
  }

  /* ---------------- 공개 API ---------------- */
  async function generate(kind, S) {
    if (!enabled()) return null;
    if (!BEATS[S.day]) return null;
    if (kind === "night" && !BEATS[S.day].night) return null;
    try {
      const out = await call(kind, S);
      if (!validate(out)) throw new Error("형식 검증 실패");
      S.ai = S.ai || { memos: [], fails: 0 };
      if (out.memo) S.ai.memos.push(`DAY ${S.day} ${kind === "morning" ? "아침" : "밤"}: ${String(out.memo).slice(0, 160)}`);
      S.ai.fails = 0;
      S.ai.lastError = null;
      return toNodes(out, kind, S);
    } catch (err) {
      S.ai = S.ai || { memos: [], fails: 0 };
      S.ai.fails = (S.ai.fails || 0) + 1;
      S.ai.lastError = String(err.message || err);
      return null; // 스크립트로 폴백
    }
  }

  return { MODELS, getKey, setKey, getCfg, setCfg, enabled, generate, CARD };
})();

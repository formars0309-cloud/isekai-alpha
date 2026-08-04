/* ============ 알파톡 — 히로인 레지스트리 ============
   엔진은 이 파일만 보고 돌아간다. 특정 히로인을 알지 못한다.
   새 히로인을 추가하려면 여기에 항목 하나를 더 얹으면 된다.

   각 히로인이 제공해야 하는 것:
     name/title/portrait/status  기본 표시
     faces   {normal,shy,blush,smile}  표정별 아바타 이미지 (없으면 SVG 초상화 사용)
     likes                       끌리는 스탯 ("str" | "int") — 낮 카드 정찰과 연동
     moods   {1..7: mood}        날짜별 기분 (proud/lonely/tired)
     days    {1..7: {morning, night}}   본 대본
     variants{1..7: {morning?, night?: [...]}}  변주 (없어도 됨)
     endings {key: {icon,title,script,desc,art?}}  구간 키: truelove/ok/near/fail/stranger/night/chicken
     epilogue{style:{bold,wit,care,none}, stat:{str,int,cha,gold,none}}  엔딩 후일담 2문단
     endingArt                   엔딩 공통 일러스트 경로 (엔딩별 art 가 우선)
     ignoreMorning               무응답 다음날 회복 대화
     milestones                  호감도 구간 봇 코멘트
     scout                       낮 관측 문구 (clear/vague/none × mood)
     ai      {card, beats}       AI 생성용 페르소나·사건 뼈대                      */

const HEROINES = {

  ely: {
    id: "ely",
    name: "엘리시아",
    title: "왕국 기사단장",
    portrait: "ely",
    // 표정별 아바타 이미지. 없거나 로드에 실패하면 portraits.js 의 SVG 로 자동 폴백된다.
    faces: {
      normal: "img/face-normal.jpg",
      shy:    "img/face-shy.jpg",
      blush:  "img/face-blush.jpg",
      smile:  "img/face-smile.jpg",
    },
    status: "검(劍)은 거짓말하지 않는다.",
    likes: "str",
    // 날짜별 기분 — 무드×스타일 매칭의 기준
    moods: { 1: "proud", 2: "lonely", 3: "tired", 4: "lonely", 5: "tired", 6: "proud", 7: "lonely" },
    days: null,        // 아래에서 주입
    variants: null,
    endings: null,
    ignoreMorning: null,
    milestones: null,
    scout: null,
    ai: null,
  },

  /* ── 루나 · 마탑의 현자 (쿨데레) ── 콘텐츠 작업 예정 ── */
  luna: {
    id: "luna",
    name: "루나",
    title: "마탑의 현자",
    portrait: "luna",
    faces: {
      normal: "img/luna-normal.jpg",
      shy:    "img/luna-shy.jpg",
      blush:  "img/luna-blush.jpg",
      smile:  "img/luna-smile.jpg",
    },
    status: "관측되지 않은 것은 존재하지 않는다.",
    likes: "int",
    moods: { 1: "proud", 2: "tired", 3: "lonely", 4: "proud", 5: "lonely", 6: "tired", 7: "lonely" },
    days: null, variants: null, endings: null,
    ignoreMorning: null, milestones: null, scout: null, ai: null,
    pending: true,     // 아직 콘텐츠 없음 — 목록에서 숨김
  },

  /* ── 세라핀 · 여관 간판딸 (밝음) ── 콘텐츠 작업 예정 ── */
  sera: {
    id: "sera",
    name: "세라핀",
    title: "달빛 정원 간판딸",
    portrait: "sera",
    status: "오늘의 수프는 양파예요~",
    likes: "cha",
    moods: { 1: "lonely", 2: "proud", 3: "tired", 4: "tired", 5: "proud", 6: "lonely", 7: "lonely" },
    days: null, variants: null, endings: null,
    ignoreMorning: null, milestones: null, scout: null, ai: null,
    pending: true,
  },
};

/* ---------- 엘리시아 데이터 주입 (기존 data.js / variants*.js) ---------- */
(function () {
  const e = HEROINES.ely;
  if (typeof DAYS !== "undefined") e.days = DAYS;
  if (typeof VARIANTS !== "undefined") e.variants = VARIANTS;
  if (typeof ENDINGS !== "undefined") e.endings = ENDINGS;
  if (typeof EPILOGUE !== "undefined") e.epilogue = EPILOGUE;
  if (typeof IGNORE_MORNING !== "undefined") e.ignoreMorning = IGNORE_MORNING;
  if (typeof AFF_MILESTONES !== "undefined") e.milestones = AFF_MILESTONES;
  if (typeof MOOD_SCOUT !== "undefined") e.scout = MOOD_SCOUT;
  if (typeof AI !== "undefined" && AI.CARD) e.ai = { card: AI.CARD };
  // days[n].mood 는 레지스트리의 moods 로 일원화
  if (e.days) Object.keys(e.moods).forEach((d) => { if (e.days[d]) e.days[d].mood = e.moods[d]; });
})();

/* ---------- 헬퍼 ---------- */
const HERO = {
  get: (id) => HEROINES[id],
  // 실제로 플레이 가능한 히로인 (콘텐츠가 있는 쪽만)
  active: () => Object.keys(HEROINES).filter((k) => !HEROINES[k].pending),
  all: () => Object.keys(HEROINES),
  moodOf: (id, day) => (HEROINES[id] && HEROINES[id].moods[day]) || "proud",
};

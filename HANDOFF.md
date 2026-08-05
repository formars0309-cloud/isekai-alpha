# 알파톡 수정 작업 인수인계

새 세션 시작할 때 아래 `---` 아래 전문을 붙여넣으세요.
맨 끝 「이번에 고칠 것」 칸에 수정 요청을 적으면 됩니다.

---

## 프로젝트

**이세계알파남 : 알파톡** — 세로 모바일 전용 메신저형 연애 시뮬레이션.
이세계로 전이된 주인공에게 세 여자가 **먼저** 메시지를 보내온다.
건국제 무도회까지 7일, 답장은 하루 네 번(아침 2·밤 2)뿐이라 매일 한 명은 답을 못 받는다.
**"욕심내면 다 잃는다"가 이 게임의 핵심이다.**

- 작업 폴더: `C:\Users\김지섭\Documents\isekai-alpha` (게임 본체는 `alphatalk/`)
- 저장소: https://github.com/formars0309-cloud/isekai-alpha (main, Public)
- 배포: **https://isekai-alpha.vercel.app/** (주력) + GitHub Pages (둘 다 push하면 자동 갱신)
- 바닐라 JS, **빌드 도구 없음**. 정적 파일만.

## 지금 상태 (전부 완성·배포됨)

- 히로인 3인 동시 진행: **엘리시아**(기사단장·근력) / **루나**(마탑 현자·지능) / **세라핀**(여관 간판딸·매력)
- 각 7일 대본 + 엔딩 7종 + 후일담(말투축·스탯축) + **변주 30개씩**
- D1은 튜토리얼(슬롯 3), D2부터 본편(슬롯 2)
- 표정 아바타, 대화 중 사진 전송, 엔딩 일러스트
- 선택 기능: Claude API 대사 생성(기본 OFF, 엘리시아만 지원)

## 파일 구조

```
alphatalk/
  index.html            화면 구조 + 스크립트 로드 순서
  css/style.css
  img/                  아바타·엔딩·이벤트 이미지 (넣는 법은 img/README.md)
  js/heroines.js        ★ 히로인 레지스트리. 엔진은 이 파일만 본다
  js/engine.js          ★ 메신저 엔진·상태·저장·렌더 (슬롯/밸런스 상수도 여기)
  js/data.js            엘리시아 본 대본 + 낮 일과 카드 + 무드 정의
  js/variants.js        엘리시아 변주 B·C
  js/variants2.js       엘리시아 변주 D·E
  js/endings.js         엘리시아 엔딩·후일담
  js/luna.js            루나 대본·엔딩·후일담 (한 파일)
  js/luna-variants.js   루나 변주 B~E
  js/sera.js            세라핀 대본·엔딩·후일담 (한 파일)
  js/sera-variants.js   세라핀 변주 B~E
  js/portraits.js       SVG 초상화 (이미지 없을 때 폴백)
  js/ai.js              Claude API 연동 (선택)
```

저장소 루트의 `index.html`·`js/`·`css/`와 `alphatalk-solo-backup/`은 **보존용 구버전이니 건드리지 말 것.**

## 대본 노드 문법

`{e}` 그녀 대사 · `{me}` 내 강제발화 · `{c}` 중앙지문 · `{bot}` 봇방 중계
`{photo, cap?}` 사진 전송 · `{emo}` 표정(normal/shy/blush/happy) · `{status}` 상태메시지
`{branch:[{flag|min, then:[]}]}` 조건분기
`{choices:[{t, style, req?, flag?, clear?, suit?, ignore?, aff?, final?, end?, then:[]}]}`

## 절대 깨면 안 되는 계약

어기면 조용히 망가진다. 수정 후 반드시 재검사할 것.

1. **선택지는 bold/wit/care 각 1개씩 정확히 3개** (+ 일부 밤은 ignore 1개)
   - 예외: hurt·d5bad 회복 분기와 `IGNORE_MORNING`은 2개다. 이건 의도된 설계.
2. **무드 적중**: `proud→wit`, `lonely→bold`, `tired→care`.
   각 선택지 묶음에 **그날 무드의 적중 스타일이 반드시 하나** 있어야 한다.
   - 엘리시아 `1 proud·2 lonely·3 tired·4 lonely·5 tired·6 proud·7 lonely`
   - 루나 `1 proud·2 tired·3 lonely·4 proud·5 lonely·6 tired·7 lonely`
   - 세라핀 `1 lonely·2 proud·3 tired·4 tired·5 proud·6 lonely·7 lonely`
3. **구조 플래그**: D5밤 = 전 선택지 `flag:"d5good"` / ignore `flag:"d5bad"` / bold에 스탯 게이트
   (엘리시아 str12, 루나 int12, 세라핀 cha12). D6밤 bold = `req:{gold:30}` + `suit:true`.
   D1·D3밤 ignore = `flag:"hurt"`.
4. **밸런스 수치는 절대 임의로 바꾸지 말 것.** 성사선 80. 정확한 값은 `engine.js`의
   `AFF_NIGHT`/`AFF_MORN` 상수를 **직접 열어서 확인**할 것(기억이나 문서로 적지 말 것 — 과거에 틀린 적 있음).
5. **변주는 묶음 단위.** A~E안의 선택지를 서로 교차 조합하면 문맥이 붕괴한다.
6. **엔딩 구간**: 90+ `truelove` / 80~89 `ok` / 65~79 `near` / 45~64 `fail` / ~44 `stranger`
   / 신청안함·65+ `night` / 그외 `chicken`

## 캐릭터 톤 (평범하게 다듬지 말 것)

- **엘리시아**: 말줄임표 + 퉁명한 단정. "…그뿐이다" — 츤데레
- **루나**: 존댓말·숫자·학술 용어, 이모지 없음. 감정이 흔들릴 때만 말줄임표가 나온다(유일한 균열)
- **세라핀**: 감탄사·`ㅋㅋ`·짧은 문장 연발. **진심을 말한 직후에만 `ㅎㅎ`** 를 붙인다(웃음으로 덮는 습관)

**15세 이용가 유지.** 노골적 성적 묘사 금지, 은유까지만.

## 개발·검증 방법

```bash
cd alphatalk && python -m http.server 5500
# http://localhost:5500/alphatalk/?debug=1   ← debug=1 이면 개발자 패널
```
(유저가 이미 5500을 띄워둔 상태일 수 있음. 그러면 그 서버를 그대로 쓸 것)

- **개발자 패널**: 스탯/호감 조작, 슬롯 리필, 하루 건너뛰기, D7 점프, 엔딩 즉시 재생, 🔎후일담(현재 판정)
- **세이브**: `localStorage["alphatalk-save-v2"]`. 직접 고치고 새로고침하면 원하는 상태로 간다.
- **특정 변주 강제**: `S.h.luna.pending = LUNA_VARIANTS[5].night[3]` 처럼 주입 +
  `pendingChoices=null`, `used={morning:[],night:[]}` 로 맞춘 뒤 reload → 이어하기
- **계약 전수 검사**: 브라우저 콘솔에서 `HERO`, `LUNA_VARIANTS` 등이 전역이므로
  전 히로인·전 변주를 순회하며 위 계약을 직접 검사하는 스크립트를 짜서 돌릴 것

## 알려진 함정 (전부 실제로 겪은 것)

1. **`{bot:"..."}` 노드에 히로인 이름을 쓰지 말 것.** 엔진이 `[이름] `을 자동으로 붙여 중복된다.
2. **회복 분기(hurt/d5bad)에도 그날 무드의 적중 스타일이 있어야 한다.** 2개짜리라고
   방심하면 적중 불가가 된다(루나 D4에서 실제로 발생).
3. **PowerShell 스크립트에 한글을 쓰지 말 것.** PS 5.1이 BOM 없는 UTF-8을 ANSI로 읽어
   경로가 깨지고, 한글 주석은 항목을 **조용히 건너뛴다**(에러도 안 남). 경로는
   `$env:USERPROFILE` + `Join-Path`로.
4. **js 수정이 브라우저에 반영 안 될 때**: 콘솔에서 각 파일을 `fetch(url,{cache:"reload"})` 후
   `location.reload()`. `?v=` 쿼리는 script src에 안 붙어서 효과 없음.
5. **`.screen`의 flex 오버플로**: `flex-direction:column`인데 `justify-content:center`면
   내용이 길 때 위쪽이 잘리고 **스크롤로도 접근 불가**. `flex-start` + 내부 `margin:auto`로 풀 것.
   (타이틀·이름·홈·모달·엔딩은 이미 수정됨)
6. **채팅 사진**: `loading="lazy"`는 이 스크롤 컨테이너에서 로드가 안 된다. 쓰지 말 것.
   캐시된 이미지는 `onload`가 등록 전에 지나가므로 `img.complete`도 함께 처리해야 한다.
7. **이미지 생성은 유저가 한다.** Claude는 Grok 접근 불가. 프롬프트는
   `alphatalk/img/PROMPTS.md`, `PROMPTS-luna-sera.md`에 있다. 유저가 Downloads에 받아두면
   Claude가 확인·리사이즈·배치한다.
8. **Node/npm/Vercel CLI 없음.** 배포는 push하면 자동. CLI 설치·로그인은 시도하지 말 것.

## 작업 절차

1. 수정 전에 관련 파일을 읽고, 계약에 걸리는지 먼저 확인
2. 수정
3. **브라우저로 실제 재생해서 검증** (코드만 읽고 "될 것 같다"로 끝내지 말 것)
4. 계약 전수 검사 재실행
5. 콘솔 에러 0 확인
6. 커밋 + push (커밋 메시지는 한국어로, 무엇이 왜 문제였는지 설명)
7. 배포 반영 확인

---

## 이번에 고칠 것

<!-- 여기에 수정 요청을 적으세요. 예:
- D3 밤 루나 대사에서 "…" 가 너무 많다
- 세라핀 D5 선택지 2번 문구가 어색함
- 낮 카드에서 골드 카드가 너무 손해라 아무도 안 고른다
-->



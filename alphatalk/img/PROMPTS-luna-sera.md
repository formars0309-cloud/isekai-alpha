# 루나 · 세라핀 이미지 생성 프롬프트 (Grok)

엘리시아와 **한눈에 구분되어야** 합니다. 기존 SVG 초상화 설정에 맞췄으니
아래 `[캐릭터]` 블록을 그대로 쓰세요. 색을 바꾸면 게임 안 초상화와 어긋납니다.

| | 머리 | 눈 | 특징 |
|---|---|---|---|
| 엘리시아 | 짙은 남색 장발 | 회청색 | 은백색 판금 갑옷 |
| **루나** | **연보라 단발** | **금색** | **안경**, 별무늬 로브 |
| **세라핀** | **구리빛 트윈테일** | **초록** | **리본**, 앞치마 |

---

## 루나 · 마탑의 현자

### [캐릭터] — 매번 그대로 복사

```
anime illustration, a quiet young woman scholar in her twenties,
short lavender bob hair, golden amber eyes, pale skin, thin silver-rimmed glasses,
calm expressionless face, deep indigo mage robe with silver star embroidery,
high collar, medieval fantasy wizard tower interior, candlelight and floating runes,
soft cinematic lighting, highly detailed, vertical composition, portrait orientation 2:3
```

### 우선순위 1 — 아바타 4종 (대화 내내 보이므로 가장 중요)

**정사각형 1:1**로 뽑아야 합니다. 아래를 캐릭터 블록 뒤에 붙이세요.

```
upper body close-up, simple blurred background, face clearly visible, square composition 1:1
```

- `luna-normal` → `neutral analytical expression, looking straight ahead`
- `luna-shy` → `looking away, faint blush, slightly parted lips, unsettled`
- `luna-blush` → `deep blush, eyes widened, visibly flustered, glasses slightly askew`
- `luna-smile` → `very faint small smile, barely there, eyes softened` ← **활짝 웃기면 캐릭터가 깨집니다**

### 우선순위 2 — 엔딩 3종 (2:3)

- `luna-truelove` → `standing outside the tower for the first time, night sky with two moons, wind in her robe, wide astonished eyes, tower far behind her`
- `luna-ok` → `standing awkwardly at the edge of a grand ballroom, holding a glass she does not drink, out of place but present`
- `luna-night` → `alone in a dark observation room at night, only a glowing crystal lighting her face, writing in a journal`

### 우선순위 3 — 이벤트 사진 (2:3)

- `luna-ev-obs` → `night observation room, star charts and open journals, glowing measurement crystal in hand`
- `luna-ev-dress` → `holding an unfamiliar formal dress at arm's length, still in her robe, examining it like a specimen`
- `luna-ev-stairs` → `standing at the top of a long spiral tower staircase, looking down, hesitating`

---

## 세라핀 · 달빛 정원 간판딸

### [캐릭터] — 매번 그대로 복사

```
anime illustration, a cheerful young woman in her twenties,
copper brown hair in twin tails with a ribbon, bright green eyes, healthy warm complexion,
simple cream blouse with a linen apron, medieval fantasy tavern interior,
warm lantern light, wooden tables, cozy atmosphere,
soft cinematic lighting, highly detailed, vertical composition, portrait orientation 2:3
```

### 우선순위 1 — 아바타 4종 (1:1)

```
upper body close-up, simple blurred background, face clearly visible, square composition 1:1
```

- `sera-normal` → `friendly relaxed expression, small everyday smile`
- `sera-shy` → `looking down, blushing, fidgeting with her apron`
- `sera-blush` → `deep blush, surprised wide eyes, hands raised near her face`
- `sera-smile` → `big bright genuine smile, eyes closed with joy` ← **여기선 활짝 웃겨야 합니다**

### 우선순위 2 — 엔딩 3종 (2:3)

- `sera-truelove` → `wearing a simple but beautiful dress at a grand ballroom, crying while smiling, overwhelmed, out of her element and happy`
- `sera-ok` → `standing at the tavern door at night, apron off, holding an invitation card with both hands`
- `sera-night` → `alone in the closed empty tavern after hours, chairs on tables, sitting by a window, small tired smile`

### 우선순위 3 — 이벤트 사진 (2:3)

- `sera-ev-broken` → `crouching over a broken plate on the tavern floor, laughing at herself, embarrassed`
- `sera-ev-soup` → `proudly holding up a bowl of soup with both hands, beaming`
- `sera-ev-empty` → `wiping the last table in an empty tavern late at night, alone, quiet expression`

---

## 두 캐릭터 공통 — 마지막에 붙일 것

```
--no text, watermark, signature, multiple girls, modern clothing, modern city
```

**엘리시아용 제외 항목과 다릅니다.** 세라핀은 트윈테일이 공식 설정이라
`twin tails`를 빼면 안 됩니다. (엘리시아 때는 제외 대상이었습니다)

## 뽑은 뒤

`alphatalk/img/` 에 넣고 "루나 이미지 뽑았어" 라고만 알려주세요.
파일명은 아무거나 상관없습니다 — 제가 보고 판단해서 이름 붙이고
640×960(장면) / 256×256(아바타)로 리사이즈한 뒤 대본에 연결합니다.

**아바타 4종만 먼저 뽑아도 충분합니다.** 대화 내내 보이는 게 그거라
체감이 가장 크고, 엔딩·이벤트는 없어도 게임이 멈추지 않습니다.

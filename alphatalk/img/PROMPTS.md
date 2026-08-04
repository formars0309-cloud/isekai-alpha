# 엘리시아 이미지 생성 프롬프트 (Grok)

기존 20장과 **같은 인물로 보이게** 하는 게 핵심입니다.
아래 `[캐릭터]` 블록을 항상 앞에 붙이고, `[장면]`만 갈아끼우세요.

---

## [캐릭터] — 매번 그대로 복사

```
anime illustration, a beautiful tall woman knight in her twenties,
long straight dark navy-blue hair, gray-blue eyes, fair skin, calm dignified expression,
ornate silver-white plate armor with gold filigree and blue gemstone accents,
deep blue cloak with gold trim, medieval European fantasy kingdom,
soft cinematic lighting, highly detailed, vertical composition, portrait orientation 2:3
```

## 남자를 같이 넣을 때 — 반드시 실루엣으로

플레이어 분신이라 얼굴이 보이면 안 됩니다. 아래 문장을 덧붙이세요.

```
beside her stands a man rendered as a completely black featureless silhouette,
no face, no details, pure black shape
```

## 빼야 할 것

```
--no text, watermark, signature, multiple girls, twin tails, modern clothing, modern city
```

> 기존 20장 중 2장(현대 도시 배경, 트윈테일 미니스커트)은 세계관·톤이 맞지 않아
> 게임에 넣지 않았습니다. 위 제외 항목이 그 재발을 막습니다.

---

## 지금 필요한 장면들

밤 대화 변주(D1~D6 각 5종)에는 아직 사진이 없습니다.
아래 장면이 있으면 밤에도 사진을 넣을 수 있습니다. 하나당 1장이면 충분합니다.

| 쓸 곳 | 파일명 | [장면] 프롬프트에 붙일 내용 |
|---|---|---|
| D1 밤 · 첫 대화 | `ev-night-desk.jpg` | `sitting alone at a desk in a candlelit office at night, paperwork stacked high, tired but composed, looking at a small glowing communication crystal` |
| D3 밤 · 무도회 예고 | `ev-dress-try.jpg` | `standing in a fitting room holding an elegant blue ball gown against herself, still wearing armor underneath, awkward and unused to it, faint blush, mirror in background` |
| D5 밤 · 사건의 밤 | `ev-balcony.jpg` | `standing alone on a castle balcony at night looking up at two moons, cloak in the wind, conflicted expression` |
| D6 밤 · 전야 | `ev-suit.jpg` | `holding a formal black dress suit on a hanger, examining it with a small private smile, in a castle corridor at dusk` |
| 아무 날 · 훈련 | `ev-training.jpg` | `in a training yard at midday, sweaty, wooden practice sword in hand, breathing hard, genuine bright smile` |

### 아바타로 쓸 표정 세트 (선택)

채팅방 프로필을 SVG 대신 그림으로 바꾸려면 같은 구도·같은 옷으로 4장이 필요합니다.
**상반신 클로즈업, 배경 단순**으로 뽑아야 작은 원형 아바타에서 알아볼 수 있습니다.

```
upper body close-up, simple blurred background, face clearly visible
```

- `face-normal.jpg` → `neutral calm expression`
- `face-shy.jpg` → `looking away, embarrassed, slight blush`
- `face-blush.jpg` → `deep blush, flustered, wide eyes`
- `face-smile.jpg` → `warm genuine smile, softened eyes`

---

## 뽑은 뒤

1. 파일을 이 폴더(`alphatalk/img/`)에 넣습니다. 이름은 위 표대로.
2. Claude에게 "이미지 넣었어"라고 알려주면 대본에 배치하고 리사이즈까지 처리합니다.
   (원본 그대로 둬도 됩니다 — 640×960으로 줄이는 건 자동입니다)

# 엔딩 일러스트 넣는 곳

이미지를 이 폴더에 넣고 `js/endings.js`의 해당 엔딩에 `art` 한 줄만 추가하면 끝입니다.

```js
truelove: {
  icon: "💞", title: "두 개의 달 아래",
  art: "img/ely-truelove.png",   // ← 이 줄만 추가
  script: [ ... ],
}
```

## 파일명 규칙 (권장)

| 엔딩 | 구간 | 파일명 |
|---|---|---|
| truelove | 호감 90+ | `ely-truelove.png` |
| ok | 80~89 | `ely-ok.png` |
| near | 65~79 | `ely-near.png` |
| fail | 45~64 | `ely-fail.png` |
| stranger | ~44 | `ely-stranger.png` |
| night | 신청 안 함·65+ | `ely-night.png` |
| chicken | 신청 안 함 | `ely-chicken.png` |

전 엔딩에 같은 그림 하나만 쓰려면 `js/heroines.js`의 히로인 항목에
`endingArt: "img/ely.png"` 를 넣으면 됩니다. (엔딩별 `art` 가 있으면 그쪽이 우선)

## 사양

- **가로:세로 3:2 권장** (600×400 이상). 화면에서 최대 폭 300px로 축소되고 모서리가 16px 둥글게 깎입니다.
- png / jpg / webp 아무거나 됩니다.
- 파일이 없거나 깨져도 게임은 안 멈춥니다 — 이미지 자리만 조용히 숨겨지고 이모지 아이콘으로 표시됩니다.

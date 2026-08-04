/* ============ 캐릭터 SVG 일러스트 (플랫 애니메 스타일) ============ */
/* portraitSVG(charId, emotion) → svg string
   emotion: normal | happy | blush | angry | shy                    */

(function () {
  const SKIN = "#ffe3d0", SKIN_SH = "#f6c9ae";

  const CHARS = {
    ely:  { hair: "#d7deef", hairSh: "#aeb9d6", eye: "#4f7dd9", style: "long",  acc: "knight" },
    luna: { hair: "#b9a3e3", hairSh: "#907ac2", eye: "#e0a13f", style: "bob",   acc: "glasses" },
    sera: { hair: "#c98d52", hairSh: "#a56a35", eye: "#5fae6e", style: "twin",  acc: "ribbon" },
    amor: { hair: "#ffb3d1", hairSh: "#e987b2", eye: "#b06fd8", style: "wavy",  acc: "halo" },
  };

  // ----- 뒷머리 -----
  function backHair(c) {
    const s = c.style;
    if (s === "long")
      return `<path d="M42 96 Q30 150 40 214 L74 208 Q60 150 66 104 Z" fill="${c.hairSh}"/>
              <path d="M158 96 Q170 150 160 214 L126 208 Q140 150 134 104 Z" fill="${c.hairSh}"/>
              <ellipse cx="100" cy="92" rx="62" ry="60" fill="${c.hairSh}"/>`;
    if (s === "bob")
      return `<path d="M40 92 Q36 146 52 158 L148 158 Q164 146 160 92 Q160 40 100 38 Q40 40 40 92 Z" fill="${c.hairSh}"/>`;
    if (s === "twin")
      return `<ellipse cx="100" cy="90" rx="58" ry="56" fill="${c.hairSh}"/>
              <path d="M34 96 Q18 130 30 172 Q40 150 44 128 Q50 150 54 166 Q64 130 52 98 Z" fill="${c.hair}"/>
              <path d="M166 96 Q182 130 170 172 Q160 150 156 128 Q150 150 146 166 Q136 130 148 98 Z" fill="${c.hair}"/>
              <circle cx="46" cy="92" r="9" fill="#e85f8a"/><circle cx="154" cy="92" r="9" fill="#e85f8a"/>`;
    // wavy (여신)
    return `<path d="M38 92 Q22 160 44 212 Q54 200 56 184 Q62 204 74 214 Q80 190 78 170 L122 170 Q120 190 126 214 Q138 204 144 184 Q146 200 156 212 Q178 160 162 92 Z" fill="${c.hairSh}"/>
            <ellipse cx="100" cy="90" rx="62" ry="58" fill="${c.hairSh}"/>`;
  }

  // ----- 앞머리 -----
  function bangs(c) {
    const s = c.style;
    if (s === "long")
      return `<path d="M40 92 Q38 46 100 42 Q162 46 160 92 Q150 66 132 82 Q128 60 106 74 Q96 58 82 76 Q66 62 60 86 Q50 70 40 92 Z" fill="${c.hair}"/>
              <path d="M40 92 Q44 110 50 118 Q54 96 52 84 Z" fill="${c.hair}"/>
              <path d="M160 92 Q156 110 150 118 Q146 96 148 84 Z" fill="${c.hair}"/>`;
    if (s === "bob")
      return `<path d="M42 90 Q42 44 100 40 Q158 44 158 90 Q146 70 134 84 Q130 62 108 76 Q98 60 84 78 Q70 64 62 88 Q52 72 42 90 Z" fill="${c.hair}"/>
              <path d="M42 90 Q46 116 54 126 Q58 100 54 84 Z" fill="${c.hair}"/>
              <path d="M158 90 Q154 116 146 126 Q142 100 146 84 Z" fill="${c.hair}"/>`;
    if (s === "twin")
      return `<path d="M42 90 Q44 44 100 40 Q156 44 158 90 Q144 72 130 84 Q126 62 104 76 Q92 60 80 78 Q68 66 60 88 Q52 74 42 90 Z" fill="${c.hair}"/>`;
    return `<path d="M38 92 Q40 42 100 38 Q160 42 162 92 Q150 66 134 84 Q128 58 104 74 Q94 56 80 76 Q64 60 56 88 Q48 70 38 92 Z" fill="${c.hair}"/>
            <path d="M38 92 Q40 118 50 130 Q56 104 52 86 Z" fill="${c.hair}"/>
            <path d="M162 92 Q160 118 150 130 Q144 104 148 86 Z" fill="${c.hair}"/>`;
  }

  // ----- 몸통 -----
  function body(c) {
    if (c.acc === "knight")
      return `<path d="M64 196 Q100 176 136 196 L142 240 L58 240 Z" fill="#39466e"/>
              <path d="M58 206 Q46 210 44 226 L60 232 Q64 214 66 206 Z" fill="#8e9cc0"/>
              <path d="M142 206 Q154 210 156 226 L140 232 Q136 214 134 206 Z" fill="#8e9cc0"/>
              <path d="M92 200 L100 214 L108 200 L100 194 Z" fill="#f5c451"/>`;
    if (c.acc === "glasses")
      return `<path d="M64 196 Q100 176 136 196 L142 240 L58 240 Z" fill="#3a2d66"/>
              <path d="M94 198 Q100 208 106 198 L106 240 L94 240 Z" fill="#241c4d"/>
              <circle cx="100" cy="214" r="5" fill="#f5c451"/>`;
    if (c.acc === "ribbon")
      return `<path d="M64 196 Q100 176 136 196 L142 240 L58 240 Z" fill="#f3e6d8"/>
              <path d="M64 196 Q100 180 136 196 L138 214 Q100 198 62 214 Z" fill="#b8563f"/>
              <path d="M90 206 Q100 214 110 206 L106 220 Q100 216 94 220 Z" fill="#e85f8a"/>`;
    return `<path d="M64 196 Q100 176 136 196 L142 240 L58 240 Z" fill="#fff"/>
            <path d="M64 196 Q100 176 136 196 L136 204 Q100 186 64 204 Z" fill="#ffd9ea"/>
            <circle cx="100" cy="212" r="4" fill="#f5c451"/>`;
  }

  // ----- 액세서리(머리 위) -----
  function accTop(c) {
    if (c.acc === "halo")
      return `<ellipse cx="100" cy="30" rx="34" ry="9" fill="none" stroke="#ffe9ad" stroke-width="5"/>`;
    if (c.acc === "ribbon")
      return `<path d="M86 44 Q100 36 114 44 L110 54 Q100 48 90 54 Z" fill="#e85f8a"/>`;
    return "";
  }
  function accFace(c) {
    if (c.acc === "glasses")
      return `<g stroke="#5a4a8a" stroke-width="3" fill="rgba(255,255,255,.12)">
                <rect x="58" y="112" width="34" height="24" rx="9"/>
                <rect x="108" y="112" width="34" height="24" rx="9"/>
                <line x1="92" y1="122" x2="108" y2="122"/>
              </g>`;
    return "";
  }

  // ----- 눈 -----
  function eyes(c, emo) {
    if (emo === "happy")
      return `<path d="M62 124 Q75 112 88 124" stroke="#3a3550" stroke-width="4.5" fill="none" stroke-linecap="round"/>
              <path d="M112 124 Q125 112 138 124" stroke="#3a3550" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
    if (emo === "shy")
      return `<g>
                <path d="M62 118 L88 118 L88 126 Q75 132 62 126 Z" fill="#fff"/>
                <circle cx="76" cy="123" r="6" fill="${c.eye}"/>
                <path d="M112 118 L138 118 L138 126 Q125 132 112 126 Z" fill="#fff"/>
                <circle cx="124" cy="123" r="6" fill="${c.eye}"/>
                <line x1="60" y1="115" x2="90" y2="115" stroke="#3a3550" stroke-width="3.5"/>
                <line x1="110" y1="115" x2="140" y2="115" stroke="#3a3550" stroke-width="3.5"/>
              </g>`;
    // normal / blush / angry : 뜬 눈
    return `<g>
              <ellipse cx="75" cy="122" rx="13" ry="14" fill="#fff"/>
              <circle cx="76" cy="123" r="8.5" fill="${c.eye}"/>
              <circle cx="76" cy="123" r="4" fill="#221f33"/>
              <circle cx="79.5" cy="119" r="2.6" fill="#fff"/>
              <ellipse cx="125" cy="122" rx="13" ry="14" fill="#fff"/>
              <circle cx="124" cy="123" r="8.5" fill="${c.eye}"/>
              <circle cx="124" cy="123" r="4" fill="#221f33"/>
              <circle cx="127.5" cy="119" r="2.6" fill="#fff"/>
              <path d="M60 112 Q75 104 90 112" stroke="#3a3550" stroke-width="4" fill="none" stroke-linecap="round"/>
              <path d="M110 112 Q125 104 140 112" stroke="#3a3550" stroke-width="4" fill="none" stroke-linecap="round"/>
            </g>`;
  }

  // ----- 눈썹 -----
  function brows(emo) {
    if (emo === "angry")
      return `<line x1="60" y1="98" x2="88" y2="106" stroke="#3a3550" stroke-width="4" stroke-linecap="round"/>
              <line x1="140" y1="98" x2="112" y2="106" stroke="#3a3550" stroke-width="4" stroke-linecap="round"/>`;
    if (emo === "shy" || emo === "blush")
      return `<path d="M62 100 Q75 96 88 102" stroke="#3a3550" stroke-width="3.5" fill="none" stroke-linecap="round"/>
              <path d="M138 100 Q125 96 112 102" stroke="#3a3550" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    return `<path d="M62 102 Q75 97 88 102" stroke="#3a3550" stroke-width="3.5" fill="none" stroke-linecap="round"/>
            <path d="M138 102 Q125 97 112 102" stroke="#3a3550" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  }

  // ----- 입 -----
  function mouth(emo) {
    if (emo === "happy") return `<path d="M90 152 Q100 162 110 152" stroke="#c0576b" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    if (emo === "angry") return `<path d="M92 156 Q100 150 108 156" stroke="#c0576b" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    if (emo === "blush") return `<ellipse cx="100" cy="154" rx="5.5" ry="6.5" fill="#c0576b"/>`;
    if (emo === "shy")   return `<path d="M94 154 Q97 157 100 154 Q103 151 106 154" stroke="#c0576b" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
    return `<path d="M93 153 Q100 158 107 153" stroke="#c0576b" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  }

  // ----- 볼터치/이펙트 -----
  function cheeks(emo) {
    if (emo === "blush" || emo === "shy")
      return `<ellipse cx="64" cy="140" rx="11" ry="6" fill="#ff9db8" opacity=".75"/>
              <ellipse cx="136" cy="140" rx="11" ry="6" fill="#ff9db8" opacity=".75"/>
              <g stroke="#e87a9a" stroke-width="2" opacity=".8">
                <line x1="58" y1="134" x2="62" y2="144"/><line x1="64" y1="133" x2="68" y2="143"/>
                <line x1="132" y1="133" x2="136" y2="143"/><line x1="138" y1="134" x2="142" y2="144"/>
              </g>`;
    if (emo === "angry")
      return `<g stroke="#e0567a" stroke-width="3.5" stroke-linecap="round">
                <path d="M148 84 Q154 88 150 94"/><path d="M156 82 Q162 86 158 92"/>
              </g>`;
    return `<ellipse cx="64" cy="140" rx="9" ry="5" fill="#ffb8c9" opacity=".4"/>
            <ellipse cx="136" cy="140" rx="9" ry="5" fill="#ffb8c9" opacity=".4"/>`;
  }

  window.portraitSVG = function (id, emo) {
    const c = CHARS[id];
    if (!c) return "";
    emo = emo || "normal";
    return `<svg viewBox="0 0 200 245" xmlns="http://www.w3.org/2000/svg">
      ${backHair(c)}
      <rect x="88" y="164" width="24" height="26" fill="${SKIN_SH}"/>
      ${body(c)}
      <ellipse cx="100" cy="118" rx="56" ry="58" fill="${SKIN}"/>
      <path d="M44 118 Q44 168 100 176 Q156 168 156 118 Q156 150 100 158 Q44 150 44 118 Z" fill="${SKIN}"/>
      <path d="M70 168 Q100 182 130 168 Q118 178 100 178 Q82 178 70 168 Z" fill="${SKIN_SH}" opacity=".5"/>
      ${cheeks(emo)}
      ${eyes(c, emo)}
      ${brows(emo)}
      ${mouth(emo)}
      ${accFace(c)}
      ${bangs(c)}
      ${accTop(c)}
    </svg>`;
  };
})();

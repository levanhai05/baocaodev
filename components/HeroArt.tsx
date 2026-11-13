export default function HeroArt() {
  const f = { fontFamily: "var(--d)" } as const;
  return (
    <div className="hero-art" aria-hidden>
      <svg viewBox="0 0 460 440" role="img" aria-label="Burger bò phô mai">
        <circle cx="230" cy="220" r="200" fill="#FFF4D1" />
        <circle cx="230" cy="220" r="214" fill="none" stroke="#1F1A17" strokeOpacity=".25" strokeWidth="2" strokeDasharray="3 9" />
        <ellipse cx="230" cy="402" rx="140" ry="12" fill="#1F1A17" opacity=".14" />
        <g transform="translate(0,6)">
          <path d="M95 318h270v12c0 26-22 40-48 40H143c-26 0-48-14-48-40z" fill="#D98E2B" />
          <rect x="85" y="262" width="290" height="50" rx="25" fill="#5B3A29" />
          <rect x="108" y="272" width="120" height="8" rx="4" fill="#fff" opacity=".12" />
          <path d="M92 244H368L338 282L310 262L272 296L236 262L200 290L168 262L128 284Z" fill="#FFC21A" />
          <rect x="96" y="226" width="268" height="20" rx="10" fill="#E3302B" />
          <path d="M84 232c14-16 28-16 42 0s28 16 42 0 28-16 42 0 28 16 42 0 28-16 42 0 28 16 42 0 28-16 42 0v14H84z" fill="#5FA84A" />
          <path d="M92 226C92 140 138 96 230 96s138 44 138 130z" fill="#E8A33D" />
          <path d="M132 192c10-40 48-68 98-72" stroke="#fff" strokeOpacity=".35" strokeWidth="10" strokeLinecap="round" fill="none" />
          <g fill="#FFF4D1">
            <ellipse cx="190" cy="150" rx="9" ry="5" transform="rotate(-20 190 150)" />
            <ellipse cx="240" cy="132" rx="9" ry="5" transform="rotate(10 240 132)" />
            <ellipse cx="288" cy="158" rx="9" ry="5" transform="rotate(30 288 158)" />
            <ellipse cx="226" cy="184" rx="9" ry="5" transform="rotate(-8 226 184)" />
            <ellipse cx="170" cy="196" rx="9" ry="5" transform="rotate(24 170 196)" />
            <ellipse cx="310" cy="204" rx="9" ry="5" transform="rotate(-24 310 204)" />
          </g>
        </g>
        <g transform="rotate(-12 80 90)">
          <circle cx="80" cy="90" r="48" fill="#1F1A17" />
          <text x="80" y="88" textAnchor="middle" fill="#FFC21A" fontSize="28" fontWeight="800" style={f}>30'</text>
          <text x="80" y="108" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="600" style={f}>giao nhanh</text>
        </g>
        <g transform="rotate(10 390 340)">
          <circle cx="390" cy="340" r="52" fill="#E3302B" />
          <text x="390" y="334" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700" style={f}>FREESHIP</text>
          <text x="390" y="358" textAnchor="middle" fill="#FFC21A" fontSize="22" fontWeight="800" style={f}>150K</text>
        </g>
      </svg>
    </div>
  );
}

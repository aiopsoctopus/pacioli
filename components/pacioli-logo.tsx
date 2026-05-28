/**
 * PacioliLogo — house + upward trend mark
 *
 * Props:
 *   size   — tile size in px (default 32)
 *   variant — "mark" (icon only) | "wordmark" (icon + name + subtitle)
 *   theme  — "dark" | "light" (defaults to "dark" for standalone use;
 *             the nav reads this from useTheme())
 */

type LogoProps = {
  size?: number;
  variant?: "mark" | "wordmark";
  theme?: "dark" | "light";
  className?: string;
};

export default function PacioliLogo({
  size = 32,
  variant = "mark",
  theme = "dark",
  className = "",
}: LogoProps) {
  const isDark = theme === "dark";

  // Palette
  const tileBg    = "#534AB7";
  const house     = "#EEEDFE";
  const trendLine = isDark ? "#7F77DD" : "#AFA9EC";
  const trendDot  = isDark ? "#AFA9EC" : "#AFA9EC";
  const wordmarkColor   = isDark ? "#EEEDFE" : "#3C3489";
  const subtitleColor   = isDark ? "#7F77DD" : "#888780";

  // Scale everything relative to size
  const s = size / 32; // 1.0 at 32px

  const r = Math.max(2, Math.round(4 * s));   // tile corner radius
  const w = size;
  const h = size;

  if (variant === "wordmark") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <LogoMark size={size} tileBg={tileBg} house={house} trendLine={trendLine} trendDot={trendDot} r={r} w={w} h={h} s={s} />
        <div>
          <p style={{ fontSize: Math.round(18 * s), fontWeight: 500, color: wordmarkColor, lineHeight: 1.1, margin: 0 }}>
            Pacioli
          </p>
          <p style={{ fontSize: Math.round(10 * s), color: subtitleColor, marginTop: 2, margin: 0 }}>
            Household Financial OS
          </p>
        </div>
      </div>
    );
  }

  return (
    <LogoMark
      size={size} tileBg={tileBg} house={house}
      trendLine={trendLine} trendDot={trendDot}
      r={r} w={w} h={h} s={s}
      className={className}
    />
  );
}

type MarkProps = {
  size: number; tileBg: string; house: string;
  trendLine: string; trendDot: string;
  r: number; w: number; h: number; s: number;
  className?: string;
};

function LogoMark({ tileBg, house, trendLine, trendDot, r, w, h, s, className = "" }: MarkProps) {
  // All coordinates designed at 32×32 then scaled by s
  const p = (x: number, y: number) => `${x * s},${y * s}`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Pacioli logo"
      role="img"
    >
      {/* Tile background */}
      <rect width={w} height={h} rx={r} fill={tileBg} />

      {/* Trend line rising behind the house */}
      <polyline
        points={`${p(4,25)} ${p(9,20)} ${p(14,17)} ${p(20,12)} ${p(28,7)}`}
        stroke={trendLine}
        strokeWidth={Math.max(1, 1.5 * s)}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.75"
      />
      {/* Trend dots */}
      {([[4,25],[9,20],[14,17],[20,12],[28,7]] as [number,number][]).map(([x,y], i) => (
        <circle key={i} cx={x * s} cy={y * s} r={Math.max(1, 1.5 * s)} fill={trendDot} opacity="0.8" />
      ))}

      {/* House body */}
      <rect
        x={8 * s} y={18 * s}
        width={16 * s} height={11 * s}
        rx={Math.max(1, 1.5 * s)}
        fill={house}
      />
      {/* Door */}
      <rect
        x={13 * s} y={22 * s}
        width={5 * s} height={7 * s}
        rx={Math.max(1, s)}
        fill={tileBg}
      />
      {/* Roof */}
      <polygon
        points={`${p(5,18)} ${p(16,8)} ${p(27,18)}`}
        fill={house}
      />
    </svg>
  );
}

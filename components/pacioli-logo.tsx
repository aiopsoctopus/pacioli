/**
 * PacioliLogo — uses the real brand PNG assets
 *
 * Props:
 *   size    — icon height in px (default 32)
 *   variant — "mark" (icon only) | "wordmark" (full lockup PNG)
 *   theme   — "dark" | "light" — picks primary-dark.png or primary-light.png for wordmark
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
  if (variant === "wordmark") {
    // Use the real lockup PNG — sized proportionally (original is ~740×200, ratio ~3.7)
    const height = Math.round(size * 1.4);
    const width = Math.round(height * 3.7);
    const src = theme === "light" ? "/primary-light.png" : "/primary-dark.png";
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt="Pacioli — Household Financial OS"
        width={width}
        height={height}
        className={className}
        style={{ objectFit: "contain" }}
      />
    );
  }

  // Mark only — the square icon
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon.png"
      alt="Pacioli"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: "contain", borderRadius: Math.round(size * 0.22) }}
    />
  );
}

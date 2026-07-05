// Pure formatting helpers — no React, safe to import from server routes.
// (lib/data.ts imports React hooks, so anything needed by API routes or
// lib/scenario.ts must live here instead.)

export function formatCurrency(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

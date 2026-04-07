export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatScore(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

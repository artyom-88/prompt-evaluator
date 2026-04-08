export const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

export const formatScore = (value: number): string => (Number.isInteger(value) ? `${value}` : value.toFixed(1));

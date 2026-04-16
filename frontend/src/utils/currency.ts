const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatCurrencyFromCents(cents: number | null | undefined): string {
  const value = Number(cents || 0) / 100;
  return formatter.format(value);
}

export function formatCurrency(value: number | null | undefined): string {
  return formatter.format(Number(value || 0));
}

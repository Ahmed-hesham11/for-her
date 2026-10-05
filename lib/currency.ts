const egpFormatter = new Intl.NumberFormat("en-EG", {
  style: "currency",
  currency: "EGP",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEgp(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return egpFormatter.format(Number.isFinite(amount) ? amount : 0);
}

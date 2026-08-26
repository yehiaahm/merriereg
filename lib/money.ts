// All monetary values are stored and computed in piastres (1 EGP = 100 piastres)
// as integers, so we never do float arithmetic with money.

export function egpToPiastres(egp: number): number {
  return Math.round(egp * 100);
}

export function piastresToEgp(piastres: number): number {
  return piastres / 100;
}

export function formatEGP(piastres: number): string {
  const egp = piastresToEgp(piastres);
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
    minimumFractionDigits: egp % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(egp);
}

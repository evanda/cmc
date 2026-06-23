// Capital-replacement forecast (plan §9). For major assets with an install
// date, expected life, and replacement cost, project the replacement year and
// sum cost by year — the multi-year capital plan leadership cares about ("the
// roofs/units are different ages — when, and how much?").

export interface CapitalAssetInput {
  name?: string;
  install_date: string | null;
  expected_life_years: number | null;
  replacement_cost: number | null;
}

export interface CapitalForecastRow {
  year: number;
  /** Assets due for replacement in this year (overdue ones bucket into `fromYear`). */
  count: number;
  total: number;
}

/**
 * Bucket replacement cost by projected year over a window.
 * @param assets  candidate assets (need install_date + expected_life_years + replacement_cost).
 * @param fromYear first year of the window (default: current year).
 * @param years   window length (default 15).
 */
export function capitalForecast(
  assets: CapitalAssetInput[],
  fromYear: number,
  years = 15,
): CapitalForecastRow[] {
  const rows: CapitalForecastRow[] = Array.from({ length: years }, (_, i) => ({
    year: fromYear + i,
    count: 0,
    total: 0,
  }));
  const lastYear = fromYear + years - 1;

  for (const a of assets) {
    if (!a.install_date || a.expected_life_years == null || a.replacement_cost == null) continue;
    const installYear = new Date(a.install_date).getUTCFullYear();
    if (Number.isNaN(installYear)) continue;
    let replacementYear = installYear + a.expected_life_years;
    // Already past due → fold into the first year of the window.
    if (replacementYear < fromYear) replacementYear = fromYear;
    if (replacementYear > lastYear) continue; // beyond the window
    const row = rows[replacementYear - fromYear];
    row.count += 1;
    row.total += a.replacement_cost;
  }
  return rows;
}

/** Total projected spend across the forecast window. */
export function capitalForecastTotal(rows: CapitalForecastRow[]): number {
  return rows.reduce((sum, r) => sum + r.total, 0);
}

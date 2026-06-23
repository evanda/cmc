import { describe, expect, it } from 'vitest';
import { capitalForecast, capitalForecastTotal, type CapitalAssetInput } from './capital.js';

const assets: CapitalAssetInput[] = [
  { name: 'RTU installed 2014, 15yr, $9k', install_date: '2014-06-01', expected_life_years: 15, replacement_cost: 9000 }, // due 2029
  { name: 'Boiler 2009, 20yr, $12k', install_date: '2009-01-01', expected_life_years: 20, replacement_cost: 12000 }, // due 2029
  { name: 'Roof 2005, 25yr, $40k', install_date: '2005-01-01', expected_life_years: 25, replacement_cost: 40000 }, // due 2030
  { name: 'Overdue unit 1990, 20yr, $5k', install_date: '1990-01-01', expected_life_years: 20, replacement_cost: 5000 }, // due 2010 → folds to fromYear
  { name: 'No data', install_date: null, expected_life_years: null, replacement_cost: null },
  { name: 'Beyond window 2024, 30yr', install_date: '2024-01-01', expected_life_years: 30, replacement_cost: 99999 }, // due 2054
];

describe('capitalForecast', () => {
  const rows = capitalForecast(assets, 2026, 15); // 2026–2040

  it('buckets cost by projected replacement year', () => {
    const y2029 = rows.find((r) => r.year === 2029)!;
    expect(y2029.count).toBe(2);
    expect(y2029.total).toBe(21000); // 9k + 12k
    expect(rows.find((r) => r.year === 2030)!.total).toBe(40000);
  });

  it('folds overdue assets into the first window year', () => {
    const first = rows.find((r) => r.year === 2026)!;
    expect(first.count).toBe(1); // the 1990 unit (due 2010)
    expect(first.total).toBe(5000);
  });

  it('skips assets missing data or beyond the window', () => {
    // 2054 replacement is outside 2026–2040; "No data" is skipped.
    expect(capitalForecastTotal(rows)).toBe(5000 + 21000 + 40000);
  });
});

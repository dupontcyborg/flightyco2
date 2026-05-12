<script lang="ts">
  import { REFERENCE_BUDGETS, type CabinClass } from "~/lib/index.ts";
  import type { ProcessedBundle, ScopeKey, ScopeView } from "~/lib/app/process.ts";
  import { createTween } from "~/lib/app/tween.svelte.ts";
  import YearStrip from "./YearStrip.svelte";
  import CabinAssumptionBanner from "./CabinAssumptionBanner.svelte";
  import MonthlyBars from "./MonthlyBars.svelte";
  import YearBars from "./YearBars.svelte";
  import FlightList from "./FlightList.svelte";

  interface Props {
    bundle: ProcessedBundle;
    scopeView: ScopeView;
    cabinFallback: CabinClass;
    onChangeCabinFallback: (next: CabinClass) => void;
    rfi: boolean;
    scope: ScopeKey;
  }
  let {
    bundle,
    scopeView,
    cabinFallback,
    onChangeCabinFallback,
    rfi = $bindable(),
    scope = $bindable(),
  }: Props = $props();

  const knownAircraft = $derived(scopeView.byAircraft.filter((a) => a.aircraft !== "(unknown)"));

  // RFI-live headline.
  const headlineKg = $derived.by(() => {
    let sum = 0;
    for (const f of scopeView.flights) sum += rfi ? f.result.kgCo2e : f.result.kgCo2;
    return sum;
  });
  const headlineT = $derived(headlineKg / 1000);

  // Per-year Paris budget multiple — divides by the year span so lifetime
  // and single-year views stay directly comparable.
  const parisMult = $derived(
    headlineKg / (REFERENCE_BUDGETS.paris15AnnualKg * scopeView.yearSpan),
  );

  // Coverage = share of flights where TIM ran successfully (no DEFRA fallback).
  // That's the most honest "trust this number" signal: TIM is per-aircraft,
  // DEFRA is a per-passenger-km estimate. The cabin-assumption banner
  // covers the orthogonal cabin-coverage concern.
  const coverage = $derived.by(() => {
    let tim = 0;
    let defra = 0;
    let assumed = 0;
    for (const f of scopeView.flights) {
      if (f.result.method === "TIM-2024") tim++;
      else defra++;
      if (f.result.cabinSource === "fallback") assumed++;
    }
    const total = scopeView.flights.length;
    return { tim, defra, assumed, total, pct: total > 0 ? tim / total : 0 };
  });

  const title = $derived(scope === null ? "Your flying, all-time" : "Your year in the air");

  // Coordinated tween of the four top stat cards. Initial mount uses
  // `firstDuration` with a small per-card delay so the row "cascades" into
  // place; subsequent changes (year switch, RFI toggle) use the shorter
  // re-target `duration` so navigation feels snappy.
  const tHeadline = createTween(() => headlineT, { firstDuration: 900 });
  const tParis = createTween(() => parisMult, { firstDuration: 850, delay: 80 });
  const tDistance = createTween(() => scopeView.totalDistanceKm / 1000, {
    firstDuration: 850,
    delay: 160,
  });
  const tCoverage = createTween(() => coverage.pct * 100, {
    firstDuration: 850,
    delay: 240,
  });
  const tDriving = createTween(() => headlineKg / REFERENCE_BUDGETS.carPerKm / 1000, {
    firstDuration: 900,
    delay: 80,
  });
</script>

<main class="dash">
  <YearStrip years={bundle.years} bind:scope />

  <header class="dash-head">
    <div>
      <h1 class="ft-rounded headline-title">{title}</h1>
    </div>
    <div class="ft-toggle" role="group" aria-label="Non-CO2 effects">
      <button class:on={rfi} onclick={() => (rfi = true)}>Non-CO₂ on</button>
      <button class:on={!rfi} onclick={() => (rfi = false)}>CO₂ only</button>
    </div>
  </header>

  {#if coverage.assumed > 0}
    <CabinAssumptionBanner
      assumedCount={coverage.assumed}
      totalCount={coverage.total}
      {cabinFallback}
      onChange={onChangeCabinFallback}
    />
  {/if}

  <div class="stat-grid">
    <div class="stat headline">
      <div class="ft-eyebrow eyebrow-light">TOTAL EMISSIONS{scope === null ? " · LIFETIME" : ""}</div>
      <div class="ft-rounded ft-num headline-num">
        {tHeadline.value.toFixed(1)}<span class="unit">t&nbsp;CO₂e</span>
      </div>
      <div class="headline-sub">
        {#if rfi}
          Includes 1.9× non-CO₂ warming uplift
        {:else}
          CO₂ only — non-CO₂ warming excluded
        {/if}
      </div>
    </div>

    <div class="stat">
      <div class="ft-eyebrow">PARIS BUDGET</div>
      <div class="ft-rounded ft-num stat-num" class:over={parisMult > 1}>
        {tParis.value.toFixed(1)}<span class="stat-unit">×</span>
      </div>
      <div class="stat-foot">
        {scope === null ? "per-year " : ""}1.5°C-aligned individual budget
      </div>
    </div>

    <div class="stat stat-distance">
      <div class="ft-eyebrow">DISTANCE</div>
      <div class="ft-rounded ft-num stat-num">
        {tDistance.value.toFixed(1)}<span class="stat-unit">k km</span>
      </div>
      <div class="stat-foot">
        ≈ driving {tDriving.value.toFixed(0)}k km
      </div>
    </div>

    <div class="stat">
      <div class="ft-eyebrow">METHODOLOGY</div>
      <div class="ft-rounded ft-num stat-num">
        {Math.round(tCoverage.value)}<span class="stat-unit">% TIM</span>
      </div>
      <div class="stat-foot">
        {#if coverage.defra > 0}
          {coverage.tim} TIM · {coverage.defra} DEFRA fallback
        {:else}
          all {coverage.total} flights computed with TIM
        {/if}
      </div>
    </div>
  </div>

  <FlightList flights={scopeView.flights} {rfi} />

  <div class="below">
    <div class="ft-card">
      <header class="card-head">
        <h2 class="ft-rounded card-title">
          {scope === null ? "Emissions by year" : "Emissions by month"}
        </h2>
        <span class="ft-eyebrow">tCO₂e</span>
      </header>
      {#if scope === null}
        <YearBars flights={scopeView.flights} {rfi} />
      {:else}
        <MonthlyBars flights={scopeView.flights} {rfi} />
      {/if}
    </div>

    <div class="ft-card">
      <h2 class="ft-rounded card-title">Top emissions by aircraft</h2>
      {#if knownAircraft.length === 0}
        <p class="empty">No aircraft data in this view.</p>
      {:else}
        <table class="actable">
          <thead>
            <tr>
              <th class="ac-aircraft">Aircraft</th>
              <th class="ac-num">Flights</th>
              <th class="ac-num ac-distance">Distance</th>
              <th class="ac-num">tCO₂e</th>
            </tr>
          </thead>
          <tbody>
            {#each knownAircraft.slice(0, 8) as a (a.aircraft)}
              <tr>
                <td class="ac-aircraft" title={a.aircraft}>{a.aircraft}</td>
                <td class="ac-num ft-num">{a.flightCount}</td>
                <td class="ac-num ac-distance ft-num">{Math.round(a.totalDistanceKm).toLocaleString()}<span class="ac-unit">km</span></td>
                <td class="ac-num ft-num">{(a.totalKgCo2e / 1000).toFixed(2)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
</main>

<style>
  .dash {
    flex: 1;
    width: 100%;
    max-width: 1160px;
    margin: 0 auto;
    padding: 24px 24px 32px;
  }
  .dash-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 18px;
  }
  .headline-title {
    font-size: clamp(28px, 4vw, 40px);
    font-weight: 700;
    margin: 4px 0 0;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
  }
  .stat {
    padding: 18px 20px;
    background: var(--color-card);
    border: 1px solid var(--color-line);
    border-radius: 16px;
  }
  .stat.headline {
    background: linear-gradient(160deg, #0b1d59 0%, #1844c2 60%, #2f6ff0 100%);
    border: none;
    color: #fff;
  }
  .eyebrow-light {
    color: rgba(255, 255, 255, 0.78);
  }
  .headline-num {
    font-size: clamp(40px, 7vw, 64px);
    font-weight: 700;
    line-height: 1;
    margin-top: 6px;
  }
  .unit {
    font-size: 22px;
    opacity: 0.85;
    margin-left: 4px;
  }
  .headline-sub {
    font-size: 13px;
    opacity: 0.85;
    margin-top: 10px;
  }
  .stat-num {
    font-size: clamp(24px, 3.4vw, 36px);
    font-weight: 700;
    line-height: 1;
    margin-top: 6px;
  }
  .stat-num.over {
    color: var(--color-warn);
  }
  .stat-unit {
    font-size: 14px;
    color: var(--color-text3);
    margin-left: 4px;
    font-weight: 600;
  }
  .stat-foot {
    font-size: 12px;
    color: var(--color-text2);
    margin-top: 8px;
  }

  .below {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    margin-top: 16px;
  }
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 16px;
  }
  .card-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 14px;
  }

  .actable {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .actable thead th {
    text-align: right;
    font-weight: 600;
    color: var(--color-text3);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 4px 8px 8px;
    border-bottom: 1px solid var(--color-line);
  }
  .actable thead th.ac-aircraft {
    text-align: left;
  }
  .actable tbody td {
    padding: 8px;
    border-bottom: 1px solid var(--color-line);
  }
  .actable tbody tr:last-child td {
    border-bottom: none;
  }
  .actable .ac-aircraft {
    color: var(--color-text);
    font-weight: 600;
    text-align: left;
    white-space: nowrap;
    width: 100%;
  }
  .actable .ac-num {
    text-align: right;
    color: var(--color-text);
    font-weight: 600;
    white-space: nowrap;
  }
  .ac-unit {
    font-size: 11px;
    color: var(--color-text3);
    margin-left: 2px;
    font-weight: 600;
  }
  .empty {
    color: var(--color-text3);
    font-size: 13px;
    margin: 0;
  }

  @media (max-width: 900px) {
    .stat-grid {
      grid-template-columns: 1fr 1fr;
    }
    .stat.headline {
      grid-column: span 2;
    }
    .below {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 540px) {
    .dash-head {
      flex-direction: column;
      align-items: flex-start;
    }
    .stat-distance {
      display: none;
    }
    .ac-distance {
      display: none;
    }
    .dash {
      padding: 16px 12px 24px;
    }
  }
</style>

<script lang="ts">
  import type { EnrichedFlight } from "~/lib/index.ts";

  interface Props {
    flights: EnrichedFlight[];
    rfi: boolean;
    onPick?: (f: EnrichedFlight) => void;
  }
  let { flights, rfi, onPick }: Props = $props();

  type Sort = "date" | "emissions";
  let sort: Sort = $state("emissions");
  let limit: number = $state(10);

  const sorted = $derived.by(() => {
    const list = [...flights];
    if (sort === "emissions") {
      list.sort((a, b) => (rfi ? b.result.kgCo2e - a.result.kgCo2e : b.result.kgCo2 - a.result.kgCo2));
    } else {
      list.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
    return list;
  });
  const visible = $derived(sorted.slice(0, limit));
  const remaining = $derived(Math.max(0, sorted.length - visible.length));

  const monthLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();

  // Heavy = top decile in this dataset.
  const heavyThreshold = $derived.by(() => {
    if (flights.length === 0) return Infinity;
    const sortedKg = flights
      .map((f) => (rfi ? f.result.kgCo2e : f.result.kgCo2))
      .sort((a, b) => b - a);
    return sortedKg[Math.floor(sortedKg.length * 0.1)] ?? Infinity;
  });

  function kg(f: EnrichedFlight): number {
    return rfi ? f.result.kgCo2e : f.result.kgCo2;
  }
</script>

<div class="ft-card list-card">
  <header class="list-head">
    <h2 class="ft-rounded list-title">All flights</h2>
    <div class="ft-toggle">
      <button class:on={sort === "date"} onclick={() => (sort = "date")}>By date</button>
      <button class:on={sort === "emissions"} onclick={() => (sort = "emissions")}>By emissions</button>
    </div>
  </header>

  <ul class="list-rows" role="list">
    {#each visible as f (f.flight.id)}
      <li>
        <button
          class="row"
          type="button"
          onclick={() => onPick?.(f)}
          aria-label="{f.flight.from} to {f.flight.actualTo} on {f.date.toDateString()}"
        >
          <div class="datebox ft-mono">
            <div class="day">{String(f.date.getUTCDate()).padStart(2, "0")}</div>
            <div class="mon">{monthLabel(f.date)}</div>
          </div>
          <div class="midcol">
            <div class="meta">
              <span class="ft-quality-dot {f.flight.quality}" title="data quality: {f.flight.quality}"></span>
              <span class="flightno">{f.flight.airline ?? ""} {f.flight.flightNumber ?? ""}</span>
              <span class="dot">·</span>
              <span class="ac">{f.flight.aircraft ?? "unknown aircraft"}</span>
              <span class="dot">·</span>
              <span class="cab">{f.result.cabinClass}{f.result.cabinSource === "fallback" ? "*" : ""}</span>
            </div>
            <div class="route ft-rounded">
              <span class="iata">{f.flight.from}</span>
              <span class="arrow">→</span>
              <span class="iata">{f.flight.actualTo}</span>
            </div>
          </div>
          <div class="km ft-mono">{Math.round(f.distanceKm).toLocaleString()} km</div>
          <div class="kg ft-rounded ft-num" class:heavy={kg(f) >= heavyThreshold}>
            {(kg(f) / 1000).toFixed(2)}<span class="kg-unit">t</span>
          </div>
        </button>
      </li>
    {/each}
  </ul>

  {#if remaining > 0}
    <div class="show-more">
      <button class="link" onclick={() => (limit += 25)}>Show {Math.min(25, remaining)} more →</button>
    </div>
  {/if}
</div>

<style>
  .list-card {
    padding: 0;
  }
  .list-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 18px 22px 8px;
  }
  .list-title {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
  }
  .list-rows {
    list-style: none;
    margin: 0;
    padding: 0 6px 6px;
  }
  .row {
    width: 100%;
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) 100px 100px;
    gap: 16px;
    align-items: center;
    padding: 14px 14px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-line);
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font: inherit;
    transition: background 120ms;
  }
  .row:hover {
    background: var(--color-card2);
  }
  .list-rows li:last-child .row {
    border-bottom: none;
  }
  .datebox {
    font-size: 12px;
    color: var(--color-text3);
    letter-spacing: 0.04em;
  }
  .day {
    font-size: 16px;
    color: var(--color-text);
    font-weight: 600;
  }
  .meta {
    display: flex;
    gap: 6px;
    align-items: center;
    color: var(--color-text2);
    font-size: 12px;
    margin-bottom: 4px;
  }
  .flightno {
    font-weight: 700;
    color: var(--color-text);
  }
  .ac, .cab {
    color: var(--color-text3);
  }
  .dot {
    color: var(--color-text3);
  }
  .route {
    font-size: 18px;
    font-weight: 600;
  }
  .arrow {
    color: var(--color-text3);
    margin: 0 4px;
  }
  .iata {
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .km {
    font-size: 12px;
    color: var(--color-text3);
    text-align: right;
  }
  .kg {
    font-size: 22px;
    font-weight: 700;
    text-align: right;
  }
  .kg.heavy {
    color: var(--color-warn);
  }
  .kg-unit {
    font-size: 11px;
    color: var(--color-text3);
    margin-left: 2px;
  }
  .show-more {
    text-align: center;
    padding: 14px 0 18px;
  }
  .link {
    background: none;
    border: none;
    color: var(--color-accent);
    font: inherit;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
  }

  @media (max-width: 720px) {
    .row {
      grid-template-columns: 44px minmax(0, 1fr) 84px;
    }
    .km {
      display: none;
    }
    .route {
      font-size: 16px;
    }
  }
</style>

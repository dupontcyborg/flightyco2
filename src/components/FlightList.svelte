<script lang="ts">
  import { AVAILABLE_AIRLINE_LOGOS } from "~/lib/airlines/available.ts";
  import { type EnrichedFlight, icaoToIata } from "~/lib/index.ts";

  interface Props {
    flights: EnrichedFlight[];
    rfi: boolean;
    distanceUnit?: "km" | "mi";
    distanceFactor?: number;
    onPick?: (f: EnrichedFlight) => void;
  }
  let { flights, rfi, distanceUnit = "km", distanceFactor = 1, onPick }: Props = $props();

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

  // "premium economy" is the only cabin label long enough to push the meta
  // row onto a second line on narrow screens. Render a short form on mobile
  // (CSS toggles which span is shown).
  const shortCabin = (c: string) => (c.toLowerCase().startsWith("premium") ? "premium" : c);

  const dateLabel = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const dateLabelShort = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone: "UTC" });

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
    {#each visible as f, i (`${f.flight.id}-${i}`)}
      {@const iata = icaoToIata(f.flight.airline) ?? f.flight.airline ?? ""}
      <li>
        <button
          class="row"
          type="button"
          onclick={() => onPick?.(f)}
          aria-label="{f.flight.from} to {f.flight.actualTo} on {f.date.toDateString()}"
        >
          <div class="airline" title={iata}>
            {#if iata && AVAILABLE_AIRLINE_LOGOS.has(iata)}
              <img class="airline-logo" src="/airlines/{iata}.svg" alt="" loading="lazy" />
            {:else}
              <span class="airline-fallback">{iata || "??"}</span>
            {/if}
          </div>
          <div class="midcol">
            <div class="meta">
              <span class="date date-long">{dateLabel(f.date)}</span>
              <span class="date date-short">{dateLabelShort(f.date)}</span>
              <span class="dot">·</span>
              <span class="flightno">{iata} {f.flight.flightNumber ?? ""}</span>
              <span class="dot ac-dot">·</span>
              <span class="ac">{f.flight.aircraft ?? "unknown aircraft"}</span>
              <span class="dot">·</span>
              <span class="cab cab-long">{f.result.cabinClass}{f.result.cabinSource === "fallback" ? "*" : ""}</span>
              <span class="cab cab-short">{shortCabin(f.result.cabinClass)}{f.result.cabinSource === "fallback" ? "*" : ""}</span>
            </div>
            <div class="route ft-rounded">
              <span class="iata">{f.flight.from}</span>
              <span class="arrow">→</span>
              <span class="iata">{f.flight.actualTo}</span>
            </div>
          </div>
          <div class="km ft-mono">{Math.round(f.distanceKm * distanceFactor).toLocaleString()} {distanceUnit}</div>
          <div class="kg ft-rounded ft-num">
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
  .airline {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    background: #3a3a3a;
    border: 1px solid var(--color-line);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  }
  .airline-logo {
    width: 28px;
    height: 28px;
    object-fit: contain;
    display: block;
  }
  .airline-fallback {
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.02em;
  }
  .date {
    color: var(--color-text3);
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    color: var(--color-text2);
    font-size: 12px;
    margin-bottom: 4px;
  }
  .meta > span {
    white-space: nowrap;
  }
  .date-short {
    display: none;
  }
  .cab-short {
    display: none;
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
      grid-template-columns: 44px minmax(0, 1fr) 72px;
      gap: 12px;
      padding: 12px 8px;
    }
    .km {
      display: none;
    }
    .route {
      font-size: 16px;
    }
    .date-long,
    .ac,
    .ac-dot,
    .cab-long {
      display: none;
    }
    .date-short,
    .cab-short {
      display: inline;
    }
    .kg {
      font-size: 20px;
    }
  }
</style>

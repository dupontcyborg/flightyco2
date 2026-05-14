<script lang="ts">
  import {
    calculateDefra,
    calculateTim,
    CABIN_CLASSES,
    type CabinClass,
    type EmissionInput,
    type EmissionOptions,
    type EmissionResult,
    type EnrichedFlight,
    icaoToIata,
  } from "~/lib/index.ts";
  import { AVAILABLE_AIRLINE_LOGOS } from "~/lib/airlines/available.ts";
  import Modal from "./Modal.svelte";

  interface Props {
    flight: EnrichedFlight;
    options: EmissionOptions;
    rfi: boolean;
    onClose: () => void;
  }
  let { flight, options, rfi, onClose }: Props = $props();

  const iata = $derived(icaoToIata(flight.flight.airline) ?? flight.flight.airline ?? "");
  const dateLabel = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  const CABIN_LABEL: Record<CabinClass, string> = {
    economy: "Economy",
    "premium-economy": "Premium Economy",
    business: "Business",
    first: "First",
  };

  const calculator = $derived(flight.result.method === "TIM-2024" ? calculateTim : calculateDefra);

  // Re-run the same calculator with each cabin class for the comparison strip.
  const variants = $derived.by(() => {
    const baseInput: EmissionInput = {
      distanceKm: flight.distanceKm,
      cabinClass: flight.flight.cabinClass,
      aircraft: flight.flight.aircraft,
      aircraftId: flight.flight.aircraftId,
      fromIcao: undefined,
      toIcao: undefined,
      fromCountry: undefined,
      toCountry: undefined,
    };
    return CABIN_CLASSES.map((c) => {
      const r: EmissionResult = calculator({ ...baseInput, cabinClass: c }, options);
      return { cabin: c, result: r };
    });
  });

  function fmt(kg: number): string {
    return (kg / 1000).toFixed(2);
  }
  function val(r: EmissionResult): number {
    return rfi ? r.kgCo2e : r.kgCo2;
  }
</script>

<Modal {onClose}>
  <header class="head">
    <div class="airline-wrap">
      {#if iata && AVAILABLE_AIRLINE_LOGOS.has(iata)}
        <img class="logo" src="/airlines/{iata}.svg" alt="" />
      {:else}
        <span class="logo-fallback">{iata || "??"}</span>
      {/if}
    </div>
    <div class="head-meta">
      <div class="eyebrow ft-eyebrow">{iata} {flight.flight.flightNumber ?? ""}</div>
      <h2 class="route ft-rounded">
        <span>{flight.flight.from}</span>
        <span class="arrow">→</span>
        <span>{flight.flight.actualTo}</span>
      </h2>
      <div class="date">{dateLabel(flight.date)}</div>
    </div>
    <div class="headline">
      <div class="ft-rounded ft-num headline-num">
        {fmt(val(flight.result))}<span class="headline-unit">t&nbsp;CO₂{rfi ? "e" : ""}</span>
      </div>
      {#if flight.result.cabinSource === "fallback"}
        <div class="caveat">cabin assumed: {CABIN_LABEL[flight.result.cabinClass]}</div>
      {/if}
    </div>
  </header>

  <section class="facts">
    <div class="fact">
      <div class="ft-eyebrow">Aircraft</div>
      <div class="fact-val">{flight.flight.aircraft ?? "unknown"}</div>
    </div>
    <div class="fact">
      <div class="ft-eyebrow">Distance</div>
      <div class="fact-val ft-num">{Math.round(flight.distanceKm).toLocaleString()} km</div>
    </div>
    <div class="fact">
      <div class="ft-eyebrow">Cabin</div>
      <div class="fact-val">{CABIN_LABEL[flight.result.cabinClass]}</div>
    </div>
    <div class="fact">
      <div class="ft-eyebrow">Method</div>
      <div class="fact-val">{flight.result.method.replace("-2024", "")}</div>
    </div>
  </section>

  <section class="compare">
    <div class="ft-eyebrow compare-title">By cabin class · same flight</div>
    <div class="compare-rows">
      {#each variants as v (v.cabin)}
        {@const isActive = v.cabin === flight.result.cabinClass}
        <div class="compare-row" class:active={isActive}>
          <span class="compare-label">{CABIN_LABEL[v.cabin]}</span>
          <span class="compare-val ft-num">
            {fmt(val(v.result))}<span class="compare-unit">t</span>
          </span>
        </div>
      {/each}
    </div>
  </section>
</Modal>

<style>
  .head {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    gap: 16px;
    align-items: center;
    margin-bottom: 24px;
  }
  .airline-wrap {
    width: 56px;
    height: 56px;
    border-radius: 999px;
    background: #3a3a3a;
    border: 1px solid var(--color-line);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .logo {
    width: 36px;
    height: 36px;
    object-fit: contain;
  }
  .logo-fallback {
    font-size: 14px;
    font-weight: 700;
    color: #fff;
  }
  .eyebrow {
    margin-bottom: 4px;
  }
  .route {
    font-size: 28px;
    font-weight: 700;
    margin: 0;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .arrow {
    color: var(--color-text3);
  }
  .date {
    color: var(--color-text3);
    font-size: 13px;
    margin-top: 4px;
  }
  .headline {
    text-align: right;
    min-width: 0;
  }
  .headline-num {
    font-size: 30px;
    font-weight: 700;
  }
  .headline-unit {
    font-size: 12px;
    color: var(--color-text3);
    font-weight: 600;
    margin-left: 4px;
  }
  .caveat {
    font-size: 11px;
    color: var(--color-text3);
    margin-top: 4px;
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px 24px;
    padding: 18px 0;
    border-top: 1px solid var(--color-line);
    border-bottom: 1px solid var(--color-line);
    margin-bottom: 20px;
  }
  .fact-val {
    font-size: 14px;
    font-weight: 600;
    margin-top: 4px;
    color: var(--color-text);
  }

  .compare-title {
    margin-bottom: 10px;
  }
  .compare-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .compare-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--color-card2);
    border: 1px solid transparent;
  }
  .compare-row.active {
    border-color: var(--color-accent);
    background: rgba(10, 180, 255, 0.08);
  }
  .compare-label {
    font-size: 13px;
    color: var(--color-text2);
  }
  .compare-row.active .compare-label {
    color: var(--color-text);
    font-weight: 600;
  }
  .compare-val {
    font-size: 16px;
    font-weight: 700;
  }
  .compare-unit {
    font-size: 11px;
    color: var(--color-text3);
    margin-left: 2px;
    font-weight: 600;
  }
  @media (max-width: 540px) {
    .head {
      grid-template-columns: 48px 1fr;
      grid-template-rows: auto auto;
    }
    .airline-wrap {
      width: 48px;
      height: 48px;
    }
    .logo {
      width: 30px;
      height: 30px;
    }
    .headline {
      grid-column: 1 / -1;
      grid-row: 2;
      text-align: left;
    }
    .route {
      font-size: 22px;
    }
    .facts {
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
  }
</style>

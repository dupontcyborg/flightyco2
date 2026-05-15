<script lang="ts">
import type { EnrichedFlight } from "~/lib/index.ts";

interface Props {
  flights: EnrichedFlight[];
  /** Whether to use kgCo2e (RFI applied) or kgCo2 (CO2 only). */
  rfi: boolean;
}
let { flights, rfi }: Props = $props();

const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];
const MONTH_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const monthly = $derived.by(() => {
  const arr: { kg: number; count: number }[] = Array.from({ length: 12 }, () => ({
    kg: 0,
    count: 0,
  }));
  for (const f of flights) {
    const slot = arr[f.month - 1];
    if (!slot) continue;
    slot.kg += rfi ? f.result.kgCo2e : f.result.kgCo2;
    slot.count += 1;
  }
  return arr;
});
const max = $derived(Math.max(...monthly.map((m) => m.kg), 1));
</script>

<div class="bars-wrap">
  <div class="bars">
    {#each monthly as v, i}
      <div class="bar-col">
        <div class="bar-track">
          {#if v.kg > 0}
            <span class="bar-val ft-mono" style="bottom: calc({(v.kg / max) * 100}% + 4px)">
              {(v.kg / 1000).toFixed(1)}
            </span>
          {/if}
          <div class="bar-fill" style="height: {(v.kg / max) * 100}%">
            {#if v.kg > 0}
              <div class="tooltip" role="tooltip">
                <div class="tt-title">{MONTH_FULL[i]}</div>
                <div class="tt-row"><span class="tt-num ft-num">{(v.kg / 1000).toFixed(2)}</span> tCO₂{rfi ? "e" : ""}</div>
                <div class="tt-row tt-sub">{v.count} flight{v.count === 1 ? "" : "s"}</div>
              </div>
            {/if}
          </div>
        </div>
        <div class="bar-label">{MONTH_LABELS[i]}</div>
      </div>
    {/each}
  </div>
</div>

<style>
  .bars-wrap {
    width: 100%;
  }
  .bars {
    display: flex;
    gap: 6px;
    align-items: flex-end;
    height: 200px;
  }
  .bar-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    min-width: 0;
  }
  .bar-track {
    height: 180px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    position: relative;
  }
  .bar-val {
    position: absolute;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 9px;
    color: var(--color-text2);
  }
  .bar-fill {
    background: var(--color-accent);
    border-radius: 6px 6px 0 0;
    position: relative;
    transition: filter 150ms ease;
    cursor: default;
  }
  .bar-fill:hover {
    filter: brightness(1.15);
  }
  .tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) translateY(4px);
    background: var(--color-text);
    color: var(--color-bg);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 120ms ease, transform 120ms ease;
    z-index: 10;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  .bar-fill:hover .tooltip {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  .tt-title {
    font-weight: 700;
  }
  .tt-num {
    font-weight: 700;
  }
  .tt-sub {
    color: var(--color-text3);
    margin-top: 2px;
  }
  .bar-label {
    text-align: center;
    font-size: 9px;
    color: var(--color-text3);
    font-family: var(--font-mono);
    letter-spacing: 0.06em;
  }
</style>

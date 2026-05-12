<script lang="ts">
  import type { EnrichedFlight } from "~/lib/index.ts";

  interface Props {
    flights: EnrichedFlight[];
    /** Whether to use kgCo2e (RFI applied) or kgCo2 (CO2 only). */
    rfi: boolean;
  }
  let { flights, rfi }: Props = $props();

  const MONTH_LABELS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  // Compute per-month totals from flights directly so the RFI toggle is live.
  const monthly = $derived.by(() => {
    const arr = Array.from({ length: 12 }, () => 0);
    for (const f of flights) {
      arr[f.month - 1] += rfi ? f.result.kgCo2e : f.result.kgCo2;
    }
    return arr;
  });
  const max = $derived(Math.max(...monthly, 1));
</script>

<div class="bars-wrap">
  <div class="bars">
    {#each monthly as v, i}
      <div class="bar-col">
        <div class="bar-track">
          {#if v > 0}
            <span class="bar-val ft-mono" style="bottom: calc({(v / max) * 100}% + 4px)">
              {(v / 1000).toFixed(1)}
            </span>
          {/if}
          <div class="bar-fill" style="height: {(v / max) * 100}%"></div>
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
    height: 160px;
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
    height: 140px;
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
  }
  .bar-label {
    text-align: center;
    font-size: 9px;
    color: var(--color-text3);
    font-family: var(--font-mono);
    letter-spacing: 0.06em;
  }
</style>

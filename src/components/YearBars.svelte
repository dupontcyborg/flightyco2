<script lang="ts">
  import type { EnrichedFlight } from "~/lib/index.ts";

  interface Props {
    flights: EnrichedFlight[];
    rfi: boolean;
  }
  let { flights, rfi }: Props = $props();

  const byYear = $derived.by(() => {
    const map = new Map<number, number>();
    for (const f of flights) {
      const v = rfi ? f.result.kgCo2e : f.result.kgCo2;
      map.set(f.year, (map.get(f.year) ?? 0) + v);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  });
  const max = $derived(Math.max(...byYear.map(([, v]) => v), 1));
</script>

<div class="bars">
  {#each byYear as [year, v] (year)}
    <div class="col">
      <div class="track">
        <span class="val ft-mono" style="bottom: calc({(v / max) * 100}% + 4px)">
          {(v / 1000).toFixed(1)}
        </span>
        <div class="fill" style="height: {(v / max) * 100}%"></div>
      </div>
      <div class="lbl ft-mono">{year}</div>
    </div>
  {/each}
</div>

<style>
  .bars {
    display: flex;
    gap: 10px;
    align-items: flex-end;
    height: 160px;
  }
  .col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .track {
    height: 140px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    position: relative;
  }
  .val {
    position: absolute;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 10px;
    color: var(--color-text2);
  }
  .fill {
    background: var(--color-accent);
    border-radius: 6px 6px 0 0;
  }
  .lbl {
    text-align: center;
    font-size: 11px;
    color: var(--color-text3);
    letter-spacing: 0.04em;
  }
</style>

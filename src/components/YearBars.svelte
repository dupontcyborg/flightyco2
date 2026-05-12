<script lang="ts">
  import type { EnrichedFlight } from "~/lib/index.ts";

  interface Props {
    flights: EnrichedFlight[];
    rfi: boolean;
  }
  let { flights, rfi }: Props = $props();

  const byYear = $derived.by(() => {
    const map = new Map<number, { kg: number; count: number }>();
    for (const f of flights) {
      const v = rfi ? f.result.kgCo2e : f.result.kgCo2;
      const cur = map.get(f.year) ?? { kg: 0, count: 0 };
      cur.kg += v;
      cur.count += 1;
      map.set(f.year, cur);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  });
  const max = $derived(Math.max(...byYear.map(([, v]) => v.kg), 1));
</script>

<div class="bars">
  {#each byYear as [year, v] (year)}
    <div class="col" style="--pct: {(v.kg / max) * 100}%">
      <div class="lbl-mobile ft-mono">{year}</div>
      <div class="track">
        <span class="val ft-mono">
          {(v.kg / 1000).toFixed(1)}
        </span>
        <div class="fill"></div>
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
    height: 200px;
  }
  .col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .track {
    height: 180px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    position: relative;
  }
  .val {
    position: absolute;
    left: 50%;
    bottom: calc(var(--pct) + 4px);
    text-align: center;
    font-size: 10px;
    color: var(--color-text2);
    transform: translateX(-50%) scale(1);
    transform-origin: bottom center;
    transition: transform 180ms cubic-bezier(0.34, 1.4, 0.64, 1), color 150ms ease;
    pointer-events: none;
    white-space: nowrap;
  }
  .fill {
    background: var(--color-accent);
    border-radius: 6px 6px 0 0;
    position: relative;
    transition: filter 150ms ease;
    cursor: default;
    height: var(--pct);
  }
  .fill:hover {
    filter: brightness(1.15);
  }
  .col:hover .val {
    transform: translateX(-50%) scale(1.8);
    color: var(--color-text);
    font-weight: 700;
  }
  .lbl {
    text-align: center;
    font-size: 11px;
    color: var(--color-text3);
    letter-spacing: 0.04em;
  }
  .lbl-mobile {
    display: none;
  }

  @media (max-width: 640px) {
    .bars {
      flex-direction: column;
      align-items: stretch;
      height: auto;
      gap: 8px;
    }
    .col {
      flex: 0 0 auto;
      flex-direction: row;
      align-items: center;
      gap: 10px;
    }
    .lbl-mobile {
      display: block;
      flex: 0 0 44px;
      font-size: 11px;
      color: var(--color-text3);
      letter-spacing: 0.04em;
    }
    .lbl {
      display: none;
    }
    .track {
      flex: 1;
      height: 22px;
      flex-direction: row;
      justify-content: flex-start;
    }
    .fill {
      height: 100%;
      width: var(--pct);
      border-radius: 0 6px 6px 0;
      min-width: 2px;
    }
    .val {
      position: static;
      transform: none;
      margin-left: 8px;
      font-size: 11px;
      color: var(--color-text);
      font-weight: 600;
      order: 2;
    }
    .col:hover .val {
      transform: none;
    }
  }
</style>

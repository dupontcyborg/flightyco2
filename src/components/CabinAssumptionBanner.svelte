<script lang="ts">
import type { CabinClass } from "~/lib/index.ts";

interface Props {
  assumedCount: number;
  totalCount: number;
  cabinFallback: CabinClass;
  onChange: (next: CabinClass) => void;
}
let { assumedCount, totalCount, cabinFallback, onChange }: Props = $props();

// Order in the dropdown matches how a user thinks about it (cheapest to
// priciest, the natural increasing-emission gradient).
const ORDER: CabinClass[] = ["economy", "premium-economy", "business", "first"];

const LABEL: Record<CabinClass, string> = {
  economy: "Economy",
  "premium-economy": "Premium Economy",
  business: "Business",
  first: "First",
};

// If lots of flights are assumed, the choice matters more — visually elevate.
const heavy = $derived(totalCount > 0 && assumedCount / totalCount > 0.25);
</script>

<div class="banner" class:heavy>
  <div class="dot" aria-hidden="true"></div>
  <div class="copy">
    <strong>{assumedCount}</strong> of {totalCount} flights had no recorded cabin class —
    {#if heavy}
      pick what to assume:
    {:else}
      assumed
    {/if}
  </div>
  <label class="picker">
    <span class="sr">Cabin assumed for unrecorded flights</span>
    <select
      value={cabinFallback}
      onchange={(e) => onChange((e.currentTarget as HTMLSelectElement).value as CabinClass)}
    >
      {#each ORDER as c}
        <option value={c}>{LABEL[c]}</option>
      {/each}
    </select>
  </label>
</div>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: var(--color-card);
    border: 1px solid var(--color-line);
    border-radius: 12px;
    margin-bottom: 14px;
    font-size: 13px;
    color: var(--color-text2);
  }
  .banner.heavy {
    background: rgba(255, 184, 77, 0.06);
    border-color: rgba(255, 184, 77, 0.35);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #ffb84d;
    flex-shrink: 0;
  }
  .copy {
    flex: 1;
    min-width: 0;
  }
  .copy strong {
    color: var(--color-text);
  }
  .picker select {
    background: var(--color-card2);
    color: var(--color-text);
    border: 1px solid var(--color-line);
    border-radius: 999px;
    font: inherit;
    font-weight: 600;
    font-size: 12px;
    padding: 5px 12px;
    cursor: pointer;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  @media (max-width: 540px) {
    .banner {
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 10px;
      row-gap: 10px;
      padding: 12px 14px;
    }
    .dot {
      grid-column: 1;
      grid-row: 1;
      align-self: center;
    }
    .copy {
      grid-column: 2;
      grid-row: 1;
    }
    .picker {
      grid-column: 1 / -1;
      grid-row: 2;
    }
    .picker select {
      width: 100%;
    }
  }
</style>

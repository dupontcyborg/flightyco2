<script lang="ts">
  import type { ScopeKey } from "~/lib/app/process.ts";

  interface Props {
    years: number[];
    scope: ScopeKey;
  }
  let { years, scope = $bindable() }: Props = $props();
</script>

<div class="strip" role="tablist" aria-label="Year selector">
  <button
    type="button"
    role="tab"
    aria-selected={scope === null}
    class="chip"
    class:on={scope === null}
    onclick={() => (scope = null)}
  >
    Lifetime
  </button>
  {#each years as y (y)}
    <button
      type="button"
      role="tab"
      aria-selected={scope === y}
      class="chip ft-num"
      class:on={scope === y}
      onclick={() => (scope = y)}
    >
      {y}
    </button>
  {/each}
</div>

<style>
  .strip {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 2px 0 8px;
    margin: 0 -4px 18px;
    scrollbar-width: thin;
  }
  .strip::-webkit-scrollbar {
    height: 6px;
  }
  .chip {
    flex: 0 0 auto;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 7px 14px;
    border-radius: 999px;
    background: var(--color-card);
    border: 1px solid var(--color-line);
    color: var(--color-text2);
    cursor: pointer;
    transition: background 120ms, color 120ms, border-color 120ms;
    white-space: nowrap;
  }
  .chip:hover {
    color: var(--color-text);
    border-color: var(--color-text3);
  }
  .chip.on {
    background: var(--color-text);
    color: var(--color-bg);
    border-color: var(--color-text);
  }
</style>

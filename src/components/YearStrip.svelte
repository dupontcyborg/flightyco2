<script lang="ts">
  import type { ScopeKey } from "~/lib/app/process.ts";

  interface Props {
    years: number[];
    scope: ScopeKey;
  }
  let { years, scope = $bindable() }: Props = $props();

  let stripEl: HTMLDivElement;
  let canScrollLeft = $state(false);
  let canScrollRight = $state(false);
  let rafId: number | null = null;

  function update() {
    if (!stripEl) return;
    canScrollLeft = stripEl.scrollLeft > 2;
    canScrollRight = stripEl.scrollLeft + stripEl.clientWidth < stripEl.scrollWidth - 2;
  }

  function startScroll(dir: 1 | -1) {
    stopScroll();
    const step = () => {
      if (!stripEl) return;
      stripEl.scrollLeft += dir * 3;
      update();
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  }
  function stopScroll() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  $effect(() => {
    void years;
    queueMicrotask(update);
  });
</script>

<div class="wrap">
  <div class="strip" role="tablist" aria-label="Year selector" bind:this={stripEl} onscroll={update}>
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
  <div
    class="edge edge-left"
    class:show={canScrollLeft}
    aria-hidden="true"
    onmouseenter={() => startScroll(-1)}
    onmouseleave={stopScroll}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
  </div>
  <div
    class="edge edge-right"
    class:show={canScrollRight}
    aria-hidden="true"
    onmouseenter={() => startScroll(1)}
    onmouseleave={stopScroll}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
  </div>
</div>

<style>
  .wrap {
    position: relative;
    margin: 0 -4px 18px;
  }
  .strip {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 2px 4px 8px;
    scrollbar-width: none;
  }
  .strip::-webkit-scrollbar {
    display: none;
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

  .edge {
    position: absolute;
    top: 0;
    bottom: 8px;
    width: 48px;
    display: flex;
    align-items: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 150ms ease;
    color: var(--color-text2);
  }
  .edge.show {
    opacity: 1;
    pointer-events: auto;
  }
  .edge-right {
    right: 0;
    justify-content: flex-end;
    padding-right: 6px;
    background: linear-gradient(to right, transparent, var(--color-bg) 55%);
  }
  .edge-left {
    left: 0;
    justify-content: flex-start;
    padding-left: 6px;
    background: linear-gradient(to left, transparent, var(--color-bg) 55%);
  }
  .edge:hover {
    color: var(--color-text);
  }

  @media (hover: none) {
    .edge {
      display: none;
    }
  }
</style>

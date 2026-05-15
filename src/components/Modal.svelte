<script lang="ts">
import type { Snippet } from "svelte";
import { cubicOut } from "svelte/easing";
import { fade, fly } from "svelte/transition";

interface Props {
  onClose: () => void;
  children: Snippet;
}
let { onClose, children }: Props = $props();

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") onClose();
}

$effect(() => {
  window.addEventListener("keydown", onKey);
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => {
    window.removeEventListener("keydown", onKey);
    document.body.style.overflow = prev;
  };
});
</script>

<div
  class="back"
  onclick={onClose}
  onkeydown={(e) => { if (e.key === "Escape") onClose(); }}
  role="presentation"
  transition:fade={{ duration: 180 }}
>
  <div
    class="modal"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    transition:fly={{ y: 16, duration: 240, easing: cubicOut }}
  >
    <button class="close" onclick={onClose} aria-label="Close">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
    {@render children()}
  </div>
</div>

<style>
  .back {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }
  .modal {
    position: relative;
    background: var(--color-card);
    border: 1px solid var(--color-line);
    border-radius: 22px;
    max-width: 760px;
    width: 100%;
    max-height: 100%;
    overflow-y: auto;
    padding: 32px 36px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
  }
  .close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: var(--color-card2);
    border: 1px solid var(--color-line);
    color: var(--color-text2);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .close:hover {
    color: var(--color-text);
  }
  @media (max-width: 640px) {
    .back { padding: 16px; }
    .modal { padding: 24px 20px; }
  }
</style>

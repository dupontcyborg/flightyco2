<script lang="ts">
  import logoWordmark from "../assets/logo-wordmark.svg?raw";

  type ModalKind = "methodology" | "howto";

  interface Props {
    onReset?: () => void;
    onOpenModal: (kind: ModalKind) => void;
  }
  let { onReset, onOpenModal }: Props = $props();
</script>

<header class="ft-bar">
  <div class="ft-brand">
    <button
      type="button"
      class="ft-brand-btn"
      onclick={onReset}
      disabled={!onReset}
      aria-label="flightyco2 home"
    >
      <span class="ft-logo" aria-label="flightyco2">{@html logoWordmark}</span>
    </button>
  </div>
  <nav class="ft-actions">
    <button type="button" class="ft-iconbtn" onclick={() => onOpenModal("howto")}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 14l2 2 4-4" />
      </svg>
      Get your Flighty data
    </button>
    <button type="button" class="ft-iconbtn" onclick={() => onOpenModal("methodology")}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4l3 2" />
      </svg>
      Methodology
    </button>
  </nav>
</header>

<style>
  .ft-bar {
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--color-line);
    background: var(--color-bg);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .ft-brand-btn {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: none;
    border: none;
    color: inherit;
    font: inherit;
    padding: 0;
    cursor: pointer;
  }
  .ft-brand-btn:disabled {
    cursor: default;
  }
  .ft-logo {
    display: inline-flex;
    align-items: center;
  }
  .ft-logo :global(svg) {
    height: 32px;
    width: auto;
    display: block;
  }
  .ft-actions {
    display: flex;
    gap: 8px;
  }
  .ft-iconbtn {
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--color-card);
    border: 1px solid var(--color-line);
    color: var(--color-text);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .ft-iconbtn:hover {
    border-color: var(--color-text3);
  }

  @media (max-width: 640px) {
    .ft-iconbtn {
      font-size: 12px;
      padding: 6px 10px;
    }
    .ft-iconbtn svg {
      display: none;
    }
  }
</style>

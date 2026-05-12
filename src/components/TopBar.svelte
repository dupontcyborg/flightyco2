<script lang="ts">
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
      <span class="ft-mark" aria-hidden="true">
        <!-- Placeholder plane glyph — replace with the final mark when ready. -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21 16v-2l-8-5V3.5C13 2.67 12.33 2 11.5 2S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
            fill="#fff"
          />
        </svg>
      </span>
      <span class="ft-wordmark">flightyco<span class="ft-sub">₂</span></span>
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
  .ft-mark {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--color-accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .ft-wordmark {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .ft-sub {
    font-feature-settings: "sups" 0;
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

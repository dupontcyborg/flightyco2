<script lang="ts">
interface Props {
  loadSample: () => Promise<void>;
  handleFile: (file: File) => Promise<void>;
  loading: boolean;
  error: string | null;
  onShowHowTo: () => void;
}
let { loadSample, handleFile, loading, error, onShowHowTo }: Props = $props();

let fileInput: HTMLInputElement | undefined = $state();
let dragging = $state(false);

function onChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) void handleFile(file);
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  dragging = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) void handleFile(file);
}

// Dev-only globe toggle: ?globe=on shows the placeholder globe; default is no globe.
const showGlobe = $derived(
  typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("globe") === "on",
);
</script>

<main class="ft-upload">
  <div class="ft-upload-grid" class:single={!showGlobe}>
    <div class="ft-upload-copy">
      <h1 class="ft-rounded ft-headline">
        Your Flighty<br />history, in tons<br />of CO<sub>2</sub>.
      </h1>
      <p class="ft-sub">
        Drop your <button type="button" class="ft-inline-link" onclick={onShowHowTo}>Flighty CSV</button> and see the CO<sub>2</sub> footprint of your
        travel history — including non-CO<sub>2</sub> warming effects.
        Computed locally with Google's Travel Impact Model and DEFRA 2024,
        so your data never leaves your browser.
      </p>

      <div
        class="ft-drop"
        class:dragging
        ondragover={(e) => { e.preventDefault(); dragging = true; }}
        ondragleave={() => (dragging = false)}
        ondrop={onDrop}
        role="button"
        tabindex="0"
        onclick={() => fileInput?.click()}
        onkeydown={(e) => { if (e.key === "Enter" || e.key === " ") fileInput?.click(); }}
      >
        <input
          type="file"
          accept=".csv,text/csv"
          bind:this={fileInput}
          onchange={onChange}
          hidden
        />
        <div class="ft-drop-inner">
          <span class="ft-btn ft-btn-accent">Upload flighty.csv</span>
          <span class="ft-drop-hint">or drop a file here</span>
        </div>
      </div>

      <button type="button" class="ft-sample-link" onclick={loadSample} disabled={loading}>
        Try with sample data &rarr;
      </button>

      {#if loading}
        <p class="ft-status">Crunching your flights…</p>
      {/if}
      {#if error}
        <p class="ft-error">{error}</p>
      {/if}
    </div>

    {#if showGlobe}
      <div class="ft-globe-slot" aria-hidden="true">
        <!-- Placeholder globe — see design/v6. Replace with photoreal globe later. -->
        <svg viewBox="0 0 520 520" class="ft-globe-svg">
          <defs>
            <radialGradient id="ocean" cx="38%" cy="32%" r="78%">
              <stop offset="0%" stop-color="#0c3568" />
              <stop offset="60%" stop-color="#061a3a" />
              <stop offset="100%" stop-color="#020713" />
            </radialGradient>
            <radialGradient id="atmo" cx="50%" cy="50%" r="50%">
              <stop offset="92%" stop-color="#0ab4ff" stop-opacity="0" />
              <stop offset="100%" stop-color="#0ab4ff" stop-opacity="0.45" />
            </radialGradient>
          </defs>
          <circle cx="260" cy="260" r="252" fill="url(#atmo)" />
          <circle cx="260" cy="260" r="240" fill="url(#ocean)" />
          <circle cx="260" cy="260" r="240" fill="none" stroke="#0ab4ff" stroke-width="0.6" opacity="0.55" />
        </svg>
      </div>
    {/if}
  </div>
</main>

<style>
  .ft-upload {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
  }
  .ft-upload-grid {
    width: 100%;
    max-width: 1160px;
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    gap: 64px;
    align-items: center;
  }
  .ft-upload-grid.single {
    grid-template-columns: minmax(0, 640px);
    justify-content: center;
  }
  .ft-headline {
    font-size: clamp(40px, 6.5vw, 76px);
    line-height: 1.02;
    font-weight: 700;
    margin: 0 0 22px;
  }
  .ft-sub {
    font-size: 17px;
    line-height: 1.55;
    color: var(--color-text2);
    max-width: 34em;
    margin: 0 0 28px;
  }
  .ft-inline-link {
    background: none;
    padding: 0;
    font: inherit;
    color: var(--color-text2);
    cursor: pointer;
    text-decoration: none;
    font-weight: 600;
    border: none;
    border-bottom: 1px dotted var(--color-text3);
    border-radius: 0;
  }
  .ft-inline-link:hover {
    color: var(--color-accent);
    border-bottom-color: var(--color-accent);
  }
  .ft-drop {
    border: 1.5px dashed var(--color-line);
    border-radius: 18px;
    padding: 18px;
    cursor: pointer;
    transition: border-color 120ms, background 120ms;
    background: rgba(255, 255, 255, 0.01);
  }
  .ft-drop:hover,
  .ft-drop.dragging {
    border-color: var(--color-accent);
    background: rgba(10, 180, 255, 0.06);
  }
  .ft-drop-inner {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .ft-drop-hint {
    font-size: 13px;
    color: var(--color-text3);
  }
  .ft-sample-link {
    margin-top: 18px;
    background: none;
    border: none;
    color: var(--color-accent);
    font: inherit;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    padding: 0;
  }
  .ft-sample-link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .ft-status {
    margin-top: 16px;
    color: var(--color-text2);
    font-size: 14px;
  }
  .ft-error {
    margin-top: 16px;
    color: var(--color-warn);
    font-size: 14px;
  }
  .ft-globe-slot {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ft-globe-svg {
    width: 100%;
    max-width: 480px;
    height: auto;
    filter: drop-shadow(0 0 40px rgba(10, 180, 255, 0.18));
  }

  @media (max-width: 900px) {
    .ft-upload-grid {
      grid-template-columns: 1fr;
      gap: 36px;
    }
    .ft-globe-slot {
      order: -1;
    }
  }
</style>

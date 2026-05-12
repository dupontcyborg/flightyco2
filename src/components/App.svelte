<script lang="ts">
  import {
    processCsv,
    buildScopeView,
    type ProcessedBundle,
    type ScopeKey,
  } from "~/lib/app/process.ts";
  import {
    DEFAULT_EMISSION_OPTIONS,
    loadAllReferenceData,
    type CabinClass,
  } from "~/lib/index.ts";
  import { ASSETS } from "~/lib/asset-manifest.ts";
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import Upload from "./Upload.svelte";
  import Crunching from "./Crunching.svelte";
  import Dashboard from "./Dashboard.svelte";
  import TopBar from "./TopBar.svelte";
  import Footer from "./Footer.svelte";
  import MethodologyModal from "./MethodologyModal.svelte";
  import HowToModal from "./HowToModal.svelte";

  type ModalKind = "methodology" | "howto" | null;
  type Screen = "upload" | "crunching" | "dashboard";

  /**
   * 10 MB hard ceiling. A real Flighty CSV is ~200 bytes/row — even
   * 10,000 flights lands at ~2 MB. 10 MB rejects a misclicked GB-sized
   * file before we read it into a string.
   */
  const MAX_CSV_BYTES = 10 * 1024 * 1024;

  /**
   * Enforce a minimum visible duration for the crunching state so the
   * transition lands as a moment, not a flash. Reference data load on
   * a cold visit overruns this anyway; the floor only matters on warm
   * re-uploads where work is sub-50ms.
   */
  const MIN_CRUNCH_MS = 650;

  let screen: Screen = $state("upload");
  let bundle: ProcessedBundle | null = $state(null);
  let csvText: string | null = $state(null);
  let rfi: boolean = $state(true);
  let scope: ScopeKey = $state(null);
  let cabinFallback: CabinClass = $state("economy");
  let loadError: string | null = $state(null);
  let modal: ModalKind = $state(null);

  const SAMPLE_URL = "/sample/canonical-fixture.csv";

  /*
   * Pre-warm the reference data (~310 KB brotli across 6 JSONs) while the
   * user is reading the landing page, so by the time they upload a CSV
   * processing is just parse + enrich (sub-50ms). If the user clicks
   * upload mid-prefetch, processCsv shares the same inflight promise via
   * the loader's internal cache — no double-fetch. Errors are swallowed
   * here because processCsv will surface them when actually invoked.
   */
  $effect(() => {
    loadAllReferenceData({
      airports: ASSETS.airports,
      mapping: ASSETS.aircraftMapping,
      fuelBurn: ASSETS.fuelBurn,
      seatConfigs: ASSETS.seatConfigs,
      gaiaAirports: ASSETS.gaiaAirports,
      gaiaCountries: ASSETS.gaiaCountries,
    }).catch(() => {
      // Silent — the real upload path will report any failure with context.
    });
  });

  function processWithFallback(text: string, fallback: CabinClass) {
    return processCsv(text, { ...DEFAULT_EMISSION_OPTIONS, cabinFallback: fallback });
  }

  async function handleCsv(text: string) {
    loadError = null;
    screen = "crunching";
    try {
      const minDelay = new Promise((r) => setTimeout(r, MIN_CRUNCH_MS));
      const work = processWithFallback(text, cabinFallback);
      const [b] = await Promise.all([work, minDelay]);
      csvText = text;
      bundle = b;
      scope = null;
      screen = "dashboard";
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
      screen = "upload";
    }
  }

  async function loadSample() {
    const res = await fetch(SAMPLE_URL);
    if (!res.ok) {
      loadError = `Couldn't load sample (${res.status})`;
      return;
    }
    await handleCsv(await res.text());
  }

  async function handleFile(file: File) {
    if (file.size > MAX_CSV_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      loadError = `That file is ${mb} MB — too big to be a Flighty export. Max 10 MB.`;
      return;
    }
    await handleCsv(await file.text());
  }

  async function changeCabinFallback(next: CabinClass) {
    if (next === cabinFallback || !csvText) return;
    cabinFallback = next;
    bundle = await processWithFallback(csvText, next);
  }

  function reset() {
    screen = "upload";
    bundle = null;
    csvText = null;
    scope = null;
    loadError = null;
  }

  const scopeView = $derived(bundle ? buildScopeView(bundle, scope) : null);
</script>

<div class="ft-app">
  <TopBar
    onReset={screen === "dashboard" ? reset : undefined}
    onOpenModal={(k) => (modal = k)}
  />

  <div class="stage">
    {#if screen === "upload"}
      <div class="screen" transition:fade={{ duration: 180 }}>
        <Upload {loadSample} {handleFile} loading={false} error={loadError} />
      </div>
    {:else if screen === "crunching"}
      <div class="screen" transition:fade={{ duration: 180 }}>
        <Crunching />
      </div>
    {:else if bundle && scopeView}
      <div class="screen" in:fly={{ y: 20, duration: 340, easing: cubicOut, delay: 60 }}>
        <Dashboard
          {bundle}
          {scopeView}
          {cabinFallback}
          onChangeCabinFallback={changeCabinFallback}
          bind:rfi
          bind:scope
        />
      </div>
    {/if}
  </div>

  <Footer />

  {#if modal === "methodology"}
    <MethodologyModal onClose={() => (modal = null)} />
  {:else if modal === "howto"}
    <HowToModal onClose={() => (modal = null)} />
  {/if}
</div>

<style>
  .ft-app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  /*
   * Hosts cross-fade and fly transitions between the upload / crunching /
   * dashboard phases. `position: relative` lets outgoing screens absolutely
   * overlay incoming ones without collapsing the layout mid-transition.
   */
  .stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .screen {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>

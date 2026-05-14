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
    prefetchAirlineLogos,
    type CabinClass,
  } from "~/lib/index.ts";
  import { ASSETS } from "~/lib/asset-manifest.ts";
  import { fade } from "svelte/transition";
  import Upload from "./Upload.svelte";
  import Crunching from "./Crunching.svelte";
  import Dashboard from "./Dashboard.svelte";
  import TopBar from "./TopBar.svelte";
  import Footer from "./Footer.svelte";
  import FlightDetailModal from "./FlightDetailModal.svelte";
  import type { Component } from "svelte";
  import type { EnrichedFlight } from "~/lib/index.ts";

  type ModalKind = "methodology" | "howto" | null;
  type Screen = "upload" | "crunching" | "dashboard";

  interface Props {
    /** Hint from the Astro page: "restoring" → render Crunching at SSR so
     * a refresh on /report doesn't flash the upload screen before
     * sessionStorage is read. */
    initialScreen?: "upload" | "restoring";
  }
  let { initialScreen = "upload" }: Props = $props();

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

  // SSR renders with the prop-supplied initial state (Crunching for
  // /report) so there's no flash before client-side restore kicks in.
  let screen: Screen = $state(initialScreen === "restoring" ? "crunching" : "upload");

  let bundle: ProcessedBundle | null = $state(null);
  let csvText: string | null = $state(null);
  let rfi: boolean = $state(true);
  let scope: ScopeKey = $state(null);
  let cabinFallback: CabinClass = $state("economy");
  let loadError: string | null = $state(null);
  let modal: ModalKind = $state(null);
  let selectedFlight: EnrichedFlight | null = $state(null);

  /*
   * The two static modals are lazy-imported so each ships as its own chunk
   * with its scoped CSS attached. This sidesteps a Vite quirk where CSS for
   * components only rendered inside `{#if}` branches is sometimes missed
   * by the extractor, and as a bonus keeps their markup out of the main
   * bundle until the user actually opens them.
   */
  type ModalCmp = Component<{ onClose: () => void }>;
  let methodologyCmp: ModalCmp | null = $state(null);
  let howtoCmp: ModalCmp | null = $state(null);

  async function openModal(kind: "methodology" | "howto") {
    if (kind === "methodology" && !methodologyCmp) {
      methodologyCmp = (await import("./MethodologyModal.svelte")).default as ModalCmp;
    }
    if (kind === "howto" && !howtoCmp) {
      howtoCmp = (await import("./HowToModal.svelte")).default as ModalCmp;
    }
    modal = kind;
  }

  const SAMPLE_URL = "/sample/canonical-fixture.csv";
  const STORAGE_KEY = "flightyco2-csv";
  const REPORT_PATH = "/report";

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
      airlines: ASSETS.airlines,
      mapping: ASSETS.aircraftMapping,
      fuelBurn: ASSETS.fuelBurn,
      seatConfigs: ASSETS.seatConfigs,
      gaiaAirports: ASSETS.gaiaAirports,
      gaiaCountries: ASSETS.gaiaCountries,
    }).catch(() => {
      // Silent — the real upload path will report any failure with context.
    });

    // Restore from sessionStorage if the user landed on /report (refresh /
    // direct link). Empty storage on /report → bounce home.
    const onReport = window.location.pathname.startsWith(REPORT_PATH);
    if (onReport) {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        restoreCsv(stored);
      } else {
        history.replaceState(null, "", "/");
        screen = "upload";
      }
    }

    const onPop = () => {
      const isReport = window.location.pathname.startsWith(REPORT_PATH);
      if (!isReport && screen === "dashboard") reset();
    };
    window.addEventListener("popstate", onPop);

    // Warm the lazy modal chunks in idle time so the first open is instant.
    const idle = (cb: () => void) =>
      "requestIdleCallback" in window
        ? (window as Window & typeof globalThis).requestIdleCallback(cb)
        : setTimeout(cb, 200);
    idle(() => {
      if (!methodologyCmp) {
        import("./MethodologyModal.svelte").then((m) => {
          methodologyCmp = m.default as ModalCmp;
        });
      }
      if (!howtoCmp) {
        import("./HowToModal.svelte").then((m) => {
          howtoCmp = m.default as ModalCmp;
        });
      }
    });

    return () => window.removeEventListener("popstate", onPop);
  });

  async function restoreCsv(text: string) {
    screen = "crunching";
    try {
      const b = await processWithFallback(text, cabinFallback);
      prefetchAirlineLogos(b.enrichment.enriched.map((e) => e.flight.airline));
      csvText = text;
      bundle = b;
      scope = null;
      screen = "dashboard";
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
      sessionStorage.removeItem(STORAGE_KEY);
      history.replaceState(null, "", "/");
      screen = "upload";
    }
  }

  function processWithFallback(text: string, fallback: CabinClass) {
    return processCsv(text, { ...DEFAULT_EMISSION_OPTIONS, cabinFallback: fallback });
  }

  async function handleCsv(text: string) {
    loadError = null;
    screen = "crunching";
    try {
      const minDelay = new Promise((r) => setTimeout(r, MIN_CRUNCH_MS));
      const work = processWithFallback(text, cabinFallback).then((b) => {
        // Warm the airline-logo cache while the crunching animation finishes.
        prefetchAirlineLogos(b.enrichment.enriched.map((e) => e.flight.airline));
        return b;
      });
      const [b] = await Promise.all([work, minDelay]);
      csvText = text;
      bundle = b;
      scope = null;
      try {
        sessionStorage.setItem(STORAGE_KEY, text);
      } catch {
        // Quota exceeded — proceed without persistence, refresh will go home.
      }
      if (window.location.pathname !== REPORT_PATH) {
        history.pushState(null, "", REPORT_PATH);
      }
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
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignored
    }
    if (window.location.pathname !== "/") {
      history.pushState(null, "", "/");
    }
  }

  const scopeView = $derived(bundle ? buildScopeView(bundle, scope) : null);
</script>

<div class="ft-app">
  <TopBar
    onReset={screen === "dashboard" ? reset : undefined}
    onOpenModal={(k) => openModal(k)}
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
    {:else if screen === "dashboard"}
      <div class="screen">
        {#if bundle && scopeView}
          <Dashboard
            {bundle}
            {scopeView}
            {cabinFallback}
            onChangeCabinFallback={changeCabinFallback}
            onPickFlight={(f) => (selectedFlight = f)}
            bind:rfi
            bind:scope
          />
        {/if}
      </div>
    {/if}
  </div>

  <Footer />

  {#if modal === "methodology" && methodologyCmp}
    {@const Cmp = methodologyCmp}
    <Cmp onClose={() => (modal = null)} />
  {:else if modal === "howto" && howtoCmp}
    {@const Cmp = howtoCmp}
    <Cmp onClose={() => (modal = null)} />
  {/if}

  {#if selectedFlight && bundle}
    <FlightDetailModal
      flight={selectedFlight}
      options={bundle.options}
      {rfi}
      onClose={() => (selectedFlight = null)}
    />
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
  /*
   * Stage uses a 1×1 grid so all three screens (upload / crunching /
   * dashboard) occupy the same cell. During transitions the outgoing
   * screen fades while the incoming one flies in — both painted in the
   * same place with no layout reflow when one unmounts.
   */
  .stage {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  .screen {
    grid-column: 1;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
</style>

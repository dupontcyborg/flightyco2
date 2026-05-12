<script lang="ts">
  import Modal from "./Modal.svelte";

  interface Props {
    onClose: () => void;
  }
  let { onClose }: Props = $props();
</script>

<Modal {onClose}>
  <div class="ft-eyebrow accent">METHODOLOGY</div>
  <h2 class="ft-rounded title">How we calculate the number</h2>

  <p class="lede">
    We use Google's <strong>Travel Impact Model (TIM&nbsp;3.0.0)</strong> as the primary calculator
    &mdash; it reads per-aircraft EEA fuel-burn curves, applies a route-specific distance adjustment
    (GAIA), converts fuel to CO<sub>2</sub>e via the CORSIA well-to-wake factor, and allocates
    per-passenger by seat-class area. When TIM can't identify the aircraft, we fall back to
    <strong>DEFRA&nbsp;2024</strong> per-passenger-km factors. The per-flight result always records
    which method ran.
  </p>

  <div class="chip-row">
    <div class="chip">
      <div class="chip-eyebrow">PRIMARY</div>
      <div class="chip-val">Google TIM 3.0.0</div>
    </div>
    <div class="chip">
      <div class="chip-eyebrow">FALLBACK</div>
      <div class="chip-val">DEFRA 2024</div>
    </div>
    <div class="chip">
      <div class="chip-eyebrow">NON-CO₂ UPLIFT</div>
      <div class="chip-val">×1.9 (default on)</div>
    </div>
    <div class="chip">
      <div class="chip-eyebrow">RFI SOURCE</div>
      <div class="chip-val">Lee&nbsp;et&nbsp;al. 2021</div>
    </div>
  </div>

  <div class="cols">
    <section>
      <div class="ft-eyebrow">What we count</div>
      <ul>
        <li>Per-aircraft fuel burn at altitude (EEA LTO + CCD)</li>
        <li>Route-specific distance adjustment (GAIA)</li>
        <li>Well-to-wake CO<sub>2</sub>e (CORSIA, 3.84 kg/kg fuel)</li>
        <li>Seat-class scaling (IATA RP&nbsp;1726)</li>
        <li>84.5% global load factor</li>
        <li>Non-CO<sub>2</sub> warming effects (contrails, NO<sub>x</sub>, water vapor)</li>
      </ul>
    </section>
    <section>
      <div class="ft-eyebrow warn">What we don't</div>
      <ul>
        <li>Aircraft manufacturing emissions</li>
        <li>Airport ground operations</li>
        <li>In-flight catering &amp; cabin supplies</li>
        <li>Tech stops (positioning flights without paying pax)</li>
        <li>Carbon offsets — bought or sold</li>
      </ul>
    </section>
  </div>

  <section class="sources">
    <div class="ft-eyebrow">Sources</div>
    <ul>
      <li>
        <strong>Travel Impact Model</strong> &mdash;
        <a href="https://github.com/google/travel-impact-model" target="_blank" rel="noreferrer">github.com/google/travel-impact-model</a>
        (CC-BY 4.0)
      </li>
      <li>
        <strong>DEFRA 2024</strong> &mdash; UK Gov GHG Conversion Factors (Open Government Licence v3.0)
      </li>
      <li>
        <strong>EEA Fuel Burn</strong> &mdash; EMEP/EEA Air Pollutant Emission Inventory Guidebook 2023, Annex 1.A.3.a
      </li>
      <li>
        <strong>GAIA Route Adjustment</strong> &mdash; Teoh et al. 2023
        (<a href="https://zenodo.org/records/8369564" target="_blank" rel="noreferrer">Zenodo 8369564</a>, CC-BY 4.0)
      </li>
      <li>
        <strong>Lee et al. 2021</strong> &mdash; "The contribution of global aviation to anthropogenic climate forcing for 2000 to 2018"
      </li>
      <li>
        <strong>Airports</strong> &mdash;
        <a href="https://ourairports.com/data/" target="_blank" rel="noreferrer">OurAirports</a>
        (public domain)
      </li>
    </ul>
  </section>

  <footer class="modal-foot">
    Full calculator source on
    <a href="https://github.com/dupontcyborg/flightyco2" target="_blank" rel="noreferrer">GitHub</a>
    — open-source, MIT-licensed, all tests committed.
  </footer>
</Modal>

<style>
  .accent { color: var(--color-accent); margin-bottom: 8px; }
  .warn { color: #ff6666; }
  .title {
    font-size: 30px;
    font-weight: 700;
    margin: 0 0 14px;
  }
  .lede {
    font-size: 15px;
    line-height: 1.6;
    color: var(--color-text2);
    margin: 0 0 20px;
  }
  .lede strong { color: var(--color-text); }

  .chip-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 22px;
  }
  .chip {
    padding: 12px;
    background: var(--color-card2);
    border-radius: 12px;
  }
  .chip-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--color-text3);
  }
  .chip-val {
    font-size: 13px;
    font-weight: 600;
    margin-top: 4px;
  }

  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
    margin-bottom: 22px;
  }
  ul {
    padding-left: 18px;
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--color-text2);
    line-height: 1.7;
  }
  ul li strong { color: var(--color-text); }

  .sources {
    padding-top: 18px;
    border-top: 1px solid var(--color-line);
  }
  .sources a {
    color: var(--color-accent);
    text-decoration: none;
  }
  .sources a:hover { text-decoration: underline; }

  .modal-foot {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid var(--color-line);
    font-size: 12px;
    color: var(--color-text3);
  }
  .modal-foot a {
    color: var(--color-accent);
    text-decoration: none;
    font-weight: 600;
  }
  .modal-foot a:hover { text-decoration: underline; }

  @media (max-width: 640px) {
    .chip-row { grid-template-columns: 1fr 1fr; }
    .cols { grid-template-columns: 1fr; }
  }
</style>

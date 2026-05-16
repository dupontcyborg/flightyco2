<script lang="ts">
import Modal from "./Modal.svelte";

interface Props {
  onClose: () => void;
}
let { onClose }: Props = $props();
</script>

<Modal {onClose}>
  <div class="ft-eyebrow accent">CLIMATE BUDGET</div>
  <h2 class="ft-rounded title">What "×&nbsp;your annual 1.5°C budget" means</h2>

  <p class="lede">
    To keep global warming under <strong>1.5°C</strong>, the remaining carbon budget
    works out to roughly <strong>2 tons of CO<sub>2</sub>e per person, per year</strong> —
    that's everyone's fair share, covering everything: heating, eating, driving,
    flying, shopping. This card shows how many of those yearly shares your flying
    alone uses up.
  </p>

  <div class="chip-row">
    <div class="chip">
      <div class="chip-eyebrow">PER PERSON, PER YEAR</div>
      <div class="chip-val">~2 t CO<sub>2</sub>e</div>
    </div>
    <div class="chip">
      <div class="chip-eyebrow">A SHORT-HAUL FLIGHT</div>
      <div class="chip-val">~0.2 t CO<sub>2</sub>e</div>
    </div>
    <div class="chip">
      <div class="chip-eyebrow">A LONG-HAUL RETURN</div>
      <div class="chip-val">~2–4 t CO<sub>2</sub>e</div>
    </div>
  </div>

  <section>
    <div class="ft-eyebrow">How to read the multiple</div>
    <ul>
      <li><strong>0.5×</strong> — your flying uses half a year's fair share, per year flown.</li>
      <li><strong>1×</strong> — your flights alone fully spend the budget, leaving nothing for the rest of life.</li>
      <li><strong>5×</strong> — five times the share. Common for frequent long-haul travelers.</li>
    </ul>
    <p class="note">
      The multiple is normalized per year flown, so lifetime and single-year views
      are directly comparable.
    </p>
  </section>

  <section class="sources">
    <div class="ft-eyebrow">Sources</div>
    <ul>
      <li>
        <strong>Oxfam</strong> &mdash; "Carbon Inequality Era" (2023), per-person budget consistent with 1.5°C.
      </li>
      <li>
        <strong>Stockholm Environment Institute</strong> &mdash; cites 2.3&nbsp;t per person; we round to 2&nbsp;t.
      </li>
      <li>
        <strong>IPCC AR6 WG3</strong> &mdash; remaining global carbon budget for 1.5°C, 50% probability.
      </li>
    </ul>
  </section>
</Modal>

<style>
  .accent { color: var(--color-accent); margin-bottom: 8px; }
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
    grid-template-columns: repeat(3, 1fr);
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

  ul {
    padding-left: 18px;
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--color-text2);
    line-height: 1.7;
  }
  ul li strong { color: var(--color-text); }

  .note {
    font-size: 12px;
    color: var(--color-text3);
    margin: 10px 0 0;
    line-height: 1.6;
  }

  .sources {
    padding-top: 18px;
    border-top: 1px solid var(--color-line);
    margin-top: 18px;
  }

  @media (max-width: 640px) {
    .chip-row { grid-template-columns: 1fr; }
  }
</style>

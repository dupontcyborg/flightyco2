<script lang="ts">
  import Modal from "./Modal.svelte";

  interface Props {
    onClose: () => void;
  }
  let { onClose }: Props = $props();
</script>

<Modal {onClose}>
  <h2 class="ft-rounded title">Get your Flighty CSV</h2>

  <ol class="steps" role="list">
    <li class="step">
      <span class="num">1</span>
      <div class="head">Open Flighty on your iPhone</div>
    </li>
    <li class="step">
      <span class="num">2</span>
      <div class="head">Tap your profile, then Settings</div>
    </li>
    <li class="step">
      <span class="num">3</span>
      <div class="head">Account Data &rarr; Export Your Flights</div>
    </li>
    <li class="step">
      <span class="num">4</span>
      <div class="head">Drop the CSV onto this page</div>
    </li>
  </ol>

  <footer class="modal-foot">
    Steps don't match what you're seeing? Flighty may have updated the export flow —
    <a href="https://github.com/dupontcyborg/flightyco2/issues" target="_blank" rel="noreferrer">
      open an issue
    </a>.
  </footer>
</Modal>

<style>
  .title {
    font-size: 30px;
    font-weight: 700;
    margin: 0 0 22px;
  }
  .steps {
    list-style: none;
    padding: 0;
    margin: 0 0 18px;
  }
  .step {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: 14px;
    align-items: center;
    padding: 14px 0;
    border-bottom: 1px solid var(--color-line);
  }
  .step:last-child { border-bottom: none; }
  .num {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: var(--color-accent);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .head {
    font-weight: 600;
  }
  .modal-foot {
    margin-top: 8px;
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
</style>

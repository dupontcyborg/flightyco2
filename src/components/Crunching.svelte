<script lang="ts">
  // Subtle moment-of-attention between upload and dashboard. Brief by
  // design — long enough to register that something happened, short enough
  // that the dashboard reveal still feels instant.
</script>

<main class="crunching">
  <div class="dots" aria-hidden="true">
    <span></span><span></span><span></span>
  </div>
  <p class="msg">Crunching your flights</p>
</main>

<style>
  .crunching {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    padding: 48px 24px;
  }
  .msg {
    color: var(--color-text2);
    font-size: 15px;
    margin: 0;
    letter-spacing: 0.01em;
  }
  .dots {
    display: flex;
    gap: 6px;
  }
  .dots span {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--color-accent);
    animation: pulse 1.2s ease-in-out infinite;
  }
  .dots span:nth-child(2) { animation-delay: 0.15s; }
  .dots span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes pulse {
    0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
    40% { opacity: 1; transform: scale(1.1); }
  }
</style>

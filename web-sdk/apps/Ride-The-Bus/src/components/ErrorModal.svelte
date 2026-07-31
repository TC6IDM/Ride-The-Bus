<script lang="ts">
  /**
   * Failure dialog for RGS errors.
   *
   * Replaces the SDK's ModalError, which renders `<p>{error}</p>` for anything
   * without both `.error` and `.message` - and an RGS failure body is
   * `{ error: 'ERR_IS', status: {...} }`, so the player was shown the literal
   * string "[object Object]". That tells them nothing and tells support less.
   *
   * Here the documented response codes (docs/rgs_docs/RGS.md, "Response Codes")
   * are mapped to plain language, with the raw payload kept underneath for
   * anyone diagnosing it. Session-level failures offer a reload, because that
   * is genuinely the only way out of them.
   */
  import { stateModal } from 'state-shared';
  import { t } from '../i18n/i18nDerived';

  type Props = { onReload?: () => void };
  const props: Props = $props();

  // Codes straight from the RGS docs. Anything unrecognised falls back to the
  // generic message rather than showing the player a raw code.
  const MESSAGES: Record<string, () => string> = {
    ERR_VAL: () => t('That bet was rejected. Please adjust the amount and try again.'),
    ERR_IPB: () => t('Not enough balance for that bet.'),
    ERR_IS: () => t('Your session has expired. Please reload the game.'),
    ERR_ATE: () => t('Your session has expired. Please reload the game.'),
    ERR_GLE: () => t('A gambling limit on your account has been reached.'),
    ERR_LOC: () => t('This game is not available from your location.'),
    ERR_GEN: () => t('The game server had a problem. Please try again shortly.'),
    ERR_MAINTENANCE: () => t('The game is under maintenance. Please try again shortly.'),
  };

  /** Codes where reloading is the only route back to a playable state. */
  const RELOADABLE = new Set(['ERR_IS', 'ERR_ATE']);

  const raw = $derived(stateModal.modal?.name === 'error' ? (stateModal.modal as any).error : null);

  /** Dig the RGS status code out of whatever shape the failure arrived in. */
  const code = $derived.by(() => {
    const e = raw;
    if (!e) return null;
    const candidates = [e?.status?.statusCode, e?.statusCode, typeof e?.error === 'string' ? e.error : null, e?.code];
    for (const c of candidates) if (typeof c === 'string' && c.startsWith('ERR_')) return c;
    // Our own thrown Errors carry the code in the message, e.g.
    // "RGS rejected play (ERR_VAL): ...".
    const text = typeof e?.message === 'string' ? e.message : typeof e === 'string' ? e : '';
    const match = text.match(/ERR_[A-Z_]+/);
    return match ? match[0] : null;
  });

  const message = $derived(
    (code && MESSAGES[code]?.()) || t('Something went wrong. Please try again.'),
  );

  /** The underlying payload, readable, for support. Never shown as [object Object]. */
  const detail = $derived.by(() => {
    const e = raw;
    if (!e) return '';
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message;
    const parts = [
      e?.status?.statusMessage,
      typeof e?.error === 'string' ? e.error : null,
      typeof e?.message === 'string' ? e.message : null,
    ].filter(Boolean);
    if (parts.length) return [...new Set(parts)].join(' — ');
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  });

  const canReload = $derived(Boolean(code && RELOADABLE.has(code)));

  function reload() {
    if (props.onReload) props.onReload();
    else window.location.reload();
  }
</script>

{#if stateModal.modal?.name === 'error'}
  <!-- Deliberately has no backdrop click-to-dismiss: an unacknowledged failure
       should not be dismissable by a stray click on the table. -->
  <div class="err-backdrop" role="presentation"></div>
  <div class="err-modal" role="alertdialog" aria-modal="true" aria-label={t('Error')}>
    <h2 class="err-title">{message}</h2>

    {#if detail}
      <p class="err-detail">{detail}</p>
    {/if}
    {#if code}
      <p class="err-code">{code}</p>
    {/if}

    <div class="err-actions">
      {#if canReload}
        <button class="action-button" onclick={reload}>{t('Reload')}</button>
      {:else}
        <button class="action-button" onclick={() => (stateModal.modal = null)}>{t('Close')}</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  @import '../styles/error-modal.css';
</style>

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
  import { t } from '../../i18n/i18nDerived';

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

  /**
   * A failure with no session behind it - authenticate or the replay fetch
   * failed while the game was launching (Authenticate.svelte tags those
   * `launch: true`). Nothing on the board can work after it, so Reload is the
   * only honest action. A bad rgs_url is the case a Stake PreCheck tries.
   */
  const launch = $derived(stateModal.modal?.name === 'error' && (stateModal.modal as any).launch === true);

  /**
   * The request never reached an answer: fetch throws a TypeError ("Failed to
   * fetch" in Chrome, "Load failed" in Safari, "NetworkError when attempting to
   * fetch resource" in Firefox), or the launch timeout fired. That raw text
   * used to be the dialog's only detail - true, but it tells a player nothing.
   */
  const network = $derived.by(() => {
    const e = raw;
    if (!e || code) return false;
    const text = typeof e === 'string' ? e : typeof e?.message === 'string' ? e.message : '';
    return e instanceof TypeError || /failed to fetch|load failed|networkerror|did not respond|timed out|timeout/i.test(text);
  });

  const message = $derived(
    (code && MESSAGES[code]?.()) ||
      (network ? t('Could not reach the game server. Check your connection, then reload.') : null) ||
      t('Something went wrong. Please try again.'),
  );

  /** The underlying payload, readable, for support. Never shown as [object Object]. */
  const detail = $derived.by(() => {
    const e = raw;
    // The plain-language message already says everything a network failure means.
    // So does a RECOGNISED code's: its sentence is translated, and the RGS's own
    // statusMessage under it is the same news again in English - in fifteen of
    // the sixteen languages the only English on screen (live pass, 2026-10-06:
    // "RGS rejected play (ERR_GEN): General error." under the German message).
    // The code line below stays for support. Unknown failures keep the detail,
    // because there it is the only thing that says what happened.
    if (!e || network || (code && MESSAGES[code])) return '';
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message;
    const parts = [
      e?.status?.statusMessage,
      typeof e?.error === 'string' ? e.error : null,
      typeof e?.message === 'string' ? e.message : null,
    ].filter(Boolean);
    if (parts.length) return [...new Set(parts)].join('. ');
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  });

  const canReload = $derived(Boolean((code && RELOADABLE.has(code)) || launch));

  /**
   * A failure the dialog cannot name: no RGS code, not the network, not the
   * launch. The live RGS answers a session token it will not accept with a bare
   * "400 Bad Request" - no ERR_IS, nothing to map (live pass, 2026-10-06) - so an
   * expired session can arrive here, and Close alone left the player retrying
   * into the same wall. Reload is offered beside Close: it is always safe (an
   * unfinished round resumes) and it is the one action that fixes a dead
   * session. Known codes keep their single, specific action.
   */
  const unknown = $derived(stateModal.modal?.name === 'error' && !code && !network && !launch);

  const isOpen = $derived(stateModal.modal?.name === 'error');

  /**
   * The dialog takes focus, and hands it back.
   *
   * Game.svelte does this for the other seven panels, and could not do it for
   * this one twice over: its effect is keyed on openPopup, which this dialog is
   * not part of, and it selects '.popup', which this root is not. Rather than
   * teach that effect about a second shape, the dialog that lives outside the
   * switchboard owns its own behaviour.
   *
   * The ROOT takes focus, not the button, for the reason the other effect
   * records: landing on a control reads that control's label in place of the
   * dialog's, and here the dialog's label IS the error message.
   */
  let modalEl: HTMLElement | undefined = $state();
  let returnFocus: HTMLElement | null = null;

  $effect(() => {
    if (!isOpen) {
      returnFocus?.focus();
      returnFocus = null;
      return;
    }
    returnFocus = document.activeElement as HTMLElement | null;
    // After the {#if} branch has actually rendered the node.
    requestAnimationFrame(() => modalEl?.focus());
  });

  /**
   * Escape closes - but only when there is something to close TO.
   *
   * ERR_IS and ERR_ATE are dead sessions, and so is any launch failure; for
   * those the dialog's only action is Reload. Letting Escape dismiss it there would leave a player
   * looking at a board that cannot take a bet, with nothing on screen saying
   * why - which is the same failure the backdrop comment refuses ("an
   * unacknowledged failure should not be dismissable by a stray click"),
   * reached by a different key. Where a Close button exists, Escape does
   * exactly what Close does.
   */
  $effect(() => {
    if (!isOpen || canReload) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      stateModal.modal = null;
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  });

  function reload() {
    if (props.onReload) props.onReload();
    else window.location.reload();
  }
</script>

{#if stateModal.modal?.name === 'error'}
  <!-- Deliberately has no backdrop click-to-dismiss: an unacknowledged failure
       should not be dismissable by a stray click on the table. -->
  <div class="err-backdrop" role="presentation"></div>
  <!-- Named by the message, not by the word "Error". aria-label used to win
       over the <h2> below it, so a screen reader announced "Error" and then had
       to be walked into the dialog to find out which one. -->
  <div
    class="err-modal"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="err-modal-title"
    tabindex="-1"
    bind:this={modalEl}
  >
    <h2 class="err-title" id="err-modal-title">{message}</h2>

    {#if detail}
      <p class="err-detail">{detail}</p>
    {/if}
    {#if code}
      <p class="err-code">{code}</p>
    {/if}

    <div class="err-actions">
      {#if canReload}
        <button class="action-button" onclick={reload}>{t('Reload')}</button>
      {:else if unknown}
        <button class="err-secondary" onclick={() => (stateModal.modal = null)}>{t('Close')}</button>
        <button class="action-button" onclick={reload}>{t('Reload')}</button>
      {:else}
        <button class="action-button" onclick={() => (stateModal.modal = null)}>{t('Close')}</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  @import '../../styles/error-modal.css';
</style>

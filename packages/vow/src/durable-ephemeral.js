// @ts-check
import { makePromiseKit } from '@endo/promise-kit';
import { M } from '@endo/patterns';
import { makeUpgradeDisconnection } from '@agoric/internal/src/upgrade-api.js';

const { details: X, quote: q } = assert;

const noop = () => {};
harden(noop);

/**
 * @import {PromiseKit} from '@endo/promise-kit';
 * @import {Zone} from '@agoric/base-zone';
 */

/**
 * A "durable ephemeral promise" is, to consuming code, an ordinary awaitable
 * native Promise -- NOT a Vow, and needing no `when()`/`watch()` unwrapping --
 * but whose *settlement* (fulfillment value or rejection reason) is persisted
 * durably.
 *
 * Its defining behavior across a vat upgrade / restart:
 * - If it had already settled before the restart, the revived promise settles
 *   again with the exact same stored value / reason.
 * - If it was still pending at the restart, it is *rejected* -- the in-flight
 *   work is not retried (this is the opposite of a Vow, which survives and
 *   retries).
 *
 * See `packages/vow/docs/durable-ephemeral-promise.md` for the full design.
 *
 * @param {Zone} zone
 */
export const prepareDurableEphemeralPromiseKit = zone => {
  // `prepare*` runs once per incarnation (inside buildRootObject), so we use a
  // durable counter to track the current incarnation number. It is needed to
  // tag the disconnection reason of promises abandoned by an upgrade, matching
  // the shape the kernel itself uses for abandoned promises.
  const durableState = zone.mapStore('durableEphemeralState');
  const incarnationNumber =
    (durableState.has('incarnationNumber')
      ? /** @type {number} */ (durableState.get('incarnationNumber'))
      : 0) + 1;
  if (durableState.has('incarnationNumber')) {
    durableState.set('incarnationNumber', incarnationNumber);
  } else {
    durableState.init('incarnationNumber', incarnationNumber);
  }

  // Ephemeral, per-incarnation: the live PromiseKit backing each durable
  // record. Rebuilt fresh each incarnation, exactly like `resolverToEphemera`
  // in vow.js. Keyed by the durable `settler` facet (stable within an
  // incarnation).
  /** @type {WeakMap<object, PromiseKit<any>>} */
  const settlerToEphemera = new WeakMap();

  // Ephemeral, per-incarnation: the set of kits that were *created* in this
  // incarnation (as opposed to revived from a prior one). A kit created this
  // incarnation may legitimately stay pending; a *revived* kit that is still
  // pending was abandoned by the upgrade and must reject. Because this Set is
  // module-scoped and ephemeral, it is naturally empty at the start of every
  // incarnation, and `zone.makeOnce` skips the maker on revival, so revived
  // kits are never added here.
  /** @type {WeakSet<object>} */
  const armedThisIncarnation = new WeakSet();

  const makeAbandonedReason = () =>
    makeUpgradeDisconnection(
      'durable ephemeral promise was still pending when its vat was upgraded',
      incarnationNumber,
    );

  /**
   * Get (creating on first use this incarnation) the live native promise that
   * backs a durable record, settling it from the durable state.
   *
   * @param {object} settler the durable `settler` facet, used as ephemera key
   * @param {{ status: string, value: unknown }} state the durable state
   */
  const provideEphemera = (settler, state) => {
    let ephemera = settlerToEphemera.get(settler);
    if (ephemera) {
      return ephemera;
    }
    ephemera = makePromiseKit();
    // Silence the internal promise's rejection bookkeeping; consumers attach
    // their own handlers to the returned promise.
    ephemera.promise.catch(noop);
    settlerToEphemera.set(settler, ephemera);

    switch (state.status) {
      case 'fulfilled':
        ephemera.resolve(state.value);
        break;
      case 'rejected':
        ephemera.reject(state.value);
        break;
      case 'pending':
        if (!armedThisIncarnation.has(settler)) {
          // Revived from a prior incarnation, never settled -> abandoned.
          ephemera.reject(makeAbandonedReason());
        }
        // Otherwise leave pending; a later resolve()/reject() this incarnation
        // will settle it.
        break;
      default:
        throw assert.fail(X`unknown settlement status ${q(state.status)}`);
    }
    return ephemera;
  };

  /**
   * Record a settlement durably and settle the live promise.
   *
   * A durable ephemeral promise can only ever *fulfill* with a value it can
   * durably store -- otherwise it could not honor its replay contract across an
   * upgrade. So a fulfillment with a non-storable value is turned into a
   * *rejection* (the value cannot be faithfully reproduced, so pretending to
   * fulfill would be a lie). An explicit rejection with a non-storable reason
   * is preserved best-effort as a stored error.
   *
   * @param {object} settler
   * @param {{ status: string, value: unknown }} state
   * @param {'fulfilled' | 'rejected'} status
   * @param {unknown} valueOrReason
   */
  const settle = (settler, state, status, valueOrReason) => {
    if (state.status !== 'pending') {
      throw assert.fail(
        X`durable ephemeral promise already settled as ${q(state.status)}`,
      );
    }
    harden(valueOrReason);
    const ephemera = provideEphemera(settler, state);
    const storable = zone.isStorable(valueOrReason);

    if (status === 'fulfilled' && storable) {
      state.value = valueOrReason;
      state.status = 'fulfilled';
      ephemera.resolve(/** @type {any} */ (valueOrReason));
      return;
    }

    // Everything else settles as a rejection.
    let reason;
    if (status === 'fulfilled') {
      // Non-storable fulfillment: cannot be durably replayed, so reject.
      reason = harden(
        assert.error(
          X`durable ephemeral promise cannot fulfill with a non-storable value: ${valueOrReason}`,
        ),
      );
    } else if (storable) {
      reason = valueOrReason;
    } else {
      reason = harden(
        assert.error(
          X`durable ephemeral promise rejected with a non-storable reason: ${valueOrReason}`,
        ),
      );
    }
    state.value = reason;
    state.status = 'rejected';
    ephemera.reject(reason);
  };

  const makeKitInternal = zone.exoClassKit(
    'DurableEphemeralPromiseKit',
    {
      consumer: M.interface('DurableEphemeralConsumer', {
        // Returns a fresh-this-incarnation awaitable native promise.
        getPromise: M.call().returns(M.promise()),
      }),
      settler: M.interface('DurableEphemeralSettler', {
        resolve: M.call().optional(M.raw()).returns(),
        reject: M.call().optional(M.raw()).returns(),
      }),
    },
    () => ({
      status: 'pending',
      /** @type {unknown} */
      value: undefined,
    }),
    {
      consumer: {
        getPromise() {
          const { settler } = this.facets;
          return provideEphemera(settler, this.state).promise;
        },
      },
      settler: {
        resolve(value) {
          settle(this.facets.settler, this.state, 'fulfilled', value);
        },
        reject(reason) {
          settle(this.facets.settler, this.state, 'rejected', reason);
        },
      },
    },
  );

  /**
   * Create a durable ephemeral promise kit. Store the returned kit in a
   * durable place (e.g. via `zone.makeOnce(key, makeDurableEphemeralPromiseKit)`)
   * so it can be revived after upgrade.
   *
   * @returns {{
   *   consumer: { getPromise(): Promise<any> },
   *   settler: { resolve(value?: unknown): void, reject(reason?: unknown): void },
   * }}
   */
  const makeDurableEphemeralPromiseKit = () => {
    const kit = makeKitInternal();
    // Mark as legitimately live for this incarnation only.
    armedThisIncarnation.add(kit.settler);
    return kit;
  };
  harden(makeDurableEphemeralPromiseKit);

  return makeDurableEphemeralPromiseKit;
};
harden(prepareDurableEphemeralPromiseKit);

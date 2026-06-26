# Durable Ephemeral Promise (design exploration)

Status: prototype. A first userland implementation lives at
`packages/vow/src/durable-ephemeral.js` with tests at
`packages/vow/test/durable-ephemeral.test.js`. It implements option (a) below
(pure userland on top of `@agoric/vow`/`@agoric/zone`, no liveslots changes).

## Motivation

We want a promise that is, from the consuming code's point of view, an
ordinary awaitable JavaScript promise — not a `Vow`, requiring no `when()`
or `watch()` unwrapping — but whose *settlement* (fulfillment value or
rejection reason) is **persisted durably**.

The defining behavior across a vat upgrade / restart:

- If the promise had **already settled** before the restart, the revived
  promise settles again with the **exact same** stored value / reason.
- If the promise was **still pending** at the restart, it is **rejected**.

We call it "ephemeral" because the in-flight, pending state does not survive
— there is no attempt to re-run or retry the work that would have settled it.
We call it "durable" because the settled outcome does survive.

## Contrast with a Vow

A `Vow` is built to *survive* a restart by *reconstructing identity and
retrying the work*: `retryable.js` re-invokes the wrapped function, and the
durable `PromiseWatcher` (`watch.js`) re-engages when it sees a retryable
rejection such as `{ name: 'vatUpgraded' }`. The pending computation is
expected to be resumed.

A durable ephemeral promise is the deliberate opposite:

| | Vow | Durable ephemeral promise |
|---|---|---|
| Surface type | tagged `Vow`, needs `when`/`watch` | plain `Promise`, directly awaitable |
| Pending across restart | survives; work is retried | **rejected**; work is not retried |
| Settled value | stored durably | stored durably |
| Intended use | long-lived cross-restart workflows | a normal local async result you want to be able to read back exactly once after a crash, without re-doing the work |

The two share the same *settled-value persistence* machinery but opposite
*pending* semantics.

## What already exists (survey, mid-2026 tree)

- **Pending promises already reject on upgrade.** When a vat is terminated /
  upgraded, the kernel rejects every unresolved promise the vat was deciding
  with `makeError('vat terminated')` (`kernel.js`), surfaced to the new
  incarnation as a `{ name: 'vatUpgraded' }` disconnection. So
  "reject-if-pending-on-restart" is the *default* behavior; we just need to
  not fight it.

- **Settlement values are NOT persisted.** Liveslots holds resolutions only
  in the `knownResolutions` **WeakMap** (`liveslots.js:362`) — transient and
  lost on upgrade. This is the one missing piece.

- **`watchPromise` persists the watcher, not the value.** The
  `watchedPromises` machinery (`swingset-liveslots/src/watchedPromises.js`)
  stores *which durable watcher to re-fire for which vpid* in a durable
  `MapStore`, and revives the promise after upgrade — but it does not store
  the settlement value itself.

- **Vow already stores settlement values durably.** `vow.js` (~line 185-205)
  writes `state.value` and `state.isStoredValue`, gated by
  `zone.isStorable(value)`, falling back to a stored error explanation when
  the value is not storable. This is exactly the persistence behavior we
  reuse.

## Proposed mechanism

Build on `@agoric/vow`'s `VowZone` / durable-zone primitives.

1. **Factory** `makeDurableEphemeralPromiseKit(zone)` returns
   `{ promise, resolve, reject }` like a normal `PromiseKit`, where `promise`
   is a genuine native promise (so `await` works with no unwrapping).

2. **Durable record.** A durable `exoClassKit` (modeled on
   `VowInternalsKit`) holds:
   - `settlementStatus`: `'pending' | 'fulfilled' | 'rejected'`
   - `value`: the stored fulfillment value or rejection reason
   - `isStoredValue`: boolean, from `zone.isStorable(value)`
   The ephemeral half (the live `PromiseKit`) lives in a per-incarnation
   `WeakMap`, exactly like `resolverToEphemera` in `vow.js:30-34`, and is
   rebuilt fresh each incarnation.

3. **Settlement capture.** On `resolve`/`reject`, write `settlementStatus`
   and the storable value/reason into durable state (reusing the
   `zone.isStorable` gate and the non-storable fallback from `vow.js`), and
   settle the live promise.

4. **Revival on `startVat` after upgrade.** For each durable record:
   - `settlementStatus === 'fulfilled'` → resolve the freshly-built promise
     with the stored value.
   - `settlementStatus === 'rejected'` → reject with the stored reason.
   - `settlementStatus === 'pending'` → **reject** with a disconnection
     reason (e.g. reuse `makeError`/the `vatUpgraded` shape), because the
     in-flight work did not survive.

5. **Storability constraint.** As with Vow and `retryable`, the settlement
   value must satisfy `zone.isStorable()`. Non-storable settlements fall back
   to a stored error explanation (fulfillment) or are stored best-effort
   (rejection), matching `vow.js` behavior.

## Open questions

- **Where does the durable record get registered for revival?** Options:
  (a) a dedicated durable `MapStore` in this package's own zone, scanned at
  first use of the kit's exo; (b) hook into the liveslots
  `loadWatchedPromiseTable` revival path. Option (a) keeps it entirely in
  userland on top of `@agoric/vow` with no liveslots changes — preferred for
  a first prototype.

- **Identity / GC.** The durable record must be reachable (held by some
  durable object) or it will be collected; the kit should be created via
  `zone.makeOnce(...)` at a durable key, like vow kits in
  `test/watch-upgrade.test.js`.

- **Rejection-tracking / unhandled rejection.** A promise rejected on
  revival with no handler attached yet would log an unhandled rejection.
  Consider reusing `rejection-tracker.js` semantics so a same-incarnation
  late handler is tolerated.

- **Multiple awaiters across the boundary.** A native promise settled in a
  prior incarnation cannot have its old `.then` callbacks survive; only code
  that re-acquires the revived promise after upgrade sees the replayed
  settlement. This is acceptable given the "ephemeral pending" contract but
  should be documented for consumers.

## Prototype notes (as implemented)

`prepareDurableEphemeralPromiseKit(zone)` returns a `makeDurableEphemeralPromiseKit`
maker. Each kit is a durable `exoClassKit` with two facets:

- `consumer.getPromise()` -> a fresh, awaitable **native** promise for the
  current incarnation, already settled (or pending) per the durable state.
- `settler.resolve(value)` / `settler.reject(reason)` -> records the
  settlement durably and settles the live promise.

Store the kit durably (e.g. `zone.makeOnce(key, makeDurableEphemeralPromiseKit)`)
so it survives upgrade.

Key implementation choices:

- **No incarnation-number plumbing needed to detect abandonment.** A
  module-scoped, ephemeral `WeakSet` records the settlers *created* this
  incarnation. It is naturally empty at the start of each incarnation, and
  `zone.makeOnce` skips the maker on revival, so a revived-but-still-pending
  kit is never in the set -> its `getPromise()` rejects. A kit created this
  incarnation may legitimately stay pending until its `resolve`/`reject`.
- **Incarnation number for the disconnection reason** is tracked with a
  durable counter bumped inside `prepare*` (which runs once per incarnation).
  The abandonment reason reuses `makeUpgradeDisconnection` from
  `@agoric/internal/src/upgrade-api.js`, i.e. the same
  `{ name: 'vatUpgraded', upgradeMessage, incarnationNumber }` shape the
  kernel uses for promises it abandons on upgrade.
- **Storability** of the settlement reuses `zone.isStorable`, with the same
  non-storable-fulfillment-becomes-a-stored-error fallback as `vow.js`.

## Possible follow-ups

- A `.promise` getter ergonomic wrapper (exo facets expose methods, not
  getters, so the prototype uses `getPromise()`).
- Option (b): hook revival into the liveslots `loadWatchedPromiseTable` path
  so consumers don't have to re-acquire the kit explicitly after upgrade.
- Decide whether a non-storable rejection reason should be preserved
  best-effort within the settling incarnation rather than immediately
  replaced by a stored error.

// @ts-check
import {
  annihilate,
  startLife,
  test,
} from '@agoric/swingset-vat/tools/prepare-strict-test-env-ava.js';

import { makeDurableZone } from '@agoric/zone/durable.js';

import { prepareDurableEphemeralPromiseKit } from '../src/durable-ephemeral.js';

/**
 * Within a single incarnation a durable ephemeral promise behaves like an
 * ordinary awaitable native promise.
 */
test.serial(
  'durable ephemeral promise is awaitable within an incarnation',
  async t => {
    annihilate();

    await startLife(async baggage => {
      const zone = makeDurableZone(baggage, 'durableRoot');
      const makeKit = prepareDurableEphemeralPromiseKit(zone);

      const fulfilledKit = zone.makeOnce('fulfilledKit', makeKit);
      fulfilledKit.settler.resolve(42);
      t.is(await fulfilledKit.consumer.getPromise(), 42);

      const rejectedKit = zone.makeOnce('rejectedKit', makeKit);
      rejectedKit.settler.reject(Error('nope'));
      await t.throwsAsync(rejectedKit.consumer.getPromise(), {
        message: 'nope',
      });
    });
  },
);

/**
 * A settlement that happened before an upgrade is replayed durably: the
 * revived promise settles with the same value / reason.
 */
test.serial(
  'settled durable ephemeral promise replays across upgrade',
  async t => {
    annihilate();

    await startLife(baggage => {
      const zone = makeDurableZone(baggage, 'durableRoot');
      const makeKit = prepareDurableEphemeralPromiseKit(zone);

      zone.makeOnce('fulfilledKit', makeKit).settler.resolve(42);
      zone
        .makeOnce('rejectedKit', makeKit)
        .settler.reject(Error('stored reason'));
    });

    await startLife(async baggage => {
      const zone = makeDurableZone(baggage, 'durableRoot');
      const makeKit = prepareDurableEphemeralPromiseKit(zone);

      // The maker must NOT be called again; the kits come from baggage.
      const fulfilledKit = zone.makeOnce('fulfilledKit', () => {
        t.fail('fulfilledKit maker called on revival');
        return makeKit();
      });
      t.is(
        await fulfilledKit.consumer.getPromise(),
        42,
        'fulfillment value survived upgrade',
      );

      const rejectedKit = zone.makeOnce('rejectedKit', () => {
        t.fail('rejectedKit maker called on revival');
        return makeKit();
      });
      await t.throwsAsync(
        rejectedKit.consumer.getPromise(),
        { message: 'stored reason' },
        'rejection reason survived upgrade',
      );
    });
  },
);

/**
 * A promise still pending at upgrade is rejected on revival -- the in-flight
 * work is not retried. This is the defining contrast with a Vow.
 */
test.serial(
  'pending durable ephemeral promise rejects across upgrade',
  async t => {
    annihilate();

    await startLife(baggage => {
      const zone = makeDurableZone(baggage, 'durableRoot');
      const makeKit = prepareDurableEphemeralPromiseKit(zone);
      // Created but never settled.
      zone.makeOnce('pendingKit', makeKit);
    });

    await startLife(async baggage => {
      const zone = makeDurableZone(baggage, 'durableRoot');
      const makeKit = prepareDurableEphemeralPromiseKit(zone);

      const pendingKit = zone.makeOnce('pendingKit', () => {
        t.fail('pendingKit maker called on revival');
        return makeKit();
      });

      const reason = await pendingKit.consumer.getPromise().then(
        value => t.fail(`expected rejection, got ${value}`),
        r => r,
      );
      t.deepEqual(reason, {
        name: 'vatUpgraded',
        upgradeMessage:
          'durable ephemeral promise was still pending when its vat was upgraded',
        incarnationNumber: 2,
      });
    });
  },
);

/**
 * A durable ephemeral promise can only fulfill with a storable value (so it can
 * be replayed after upgrade). Resolving with a non-storable value rejects
 * instead of fulfilling, and that rejection is itself durable.
 */
test.serial('resolving to a non-storable value rejects, durably', async t => {
  annihilate();

  await startLife(async baggage => {
    const zone = makeDurableZone(baggage, 'durableRoot');
    const makeKit = prepareDurableEphemeralPromiseKit(zone);

    const kit = zone.makeOnce('nonStorableKit', makeKit);
    // A bare function is not a passable, so not storable.
    kit.settler.resolve(() => 'not storable');

    // Rejects in the same incarnation rather than fulfilling.
    await t.throwsAsync(kit.consumer.getPromise(), {
      message: /cannot fulfill with a non-storable value/,
    });
  });

  // The rejection persists across upgrade (it was recorded durably).
  await startLife(async baggage => {
    const zone = makeDurableZone(baggage, 'durableRoot');
    const makeKit = prepareDurableEphemeralPromiseKit(zone);

    const kit = zone.makeOnce('nonStorableKit', () => {
      t.fail('nonStorableKit maker called on revival');
      return makeKit();
    });
    await t.throwsAsync(kit.consumer.getPromise(), {
      message: /cannot fulfill with a non-storable value/,
    });
  });
});

/**
 * Resolving one durable ephemeral promise to another (via its `getPromise()`)
 * adopts the inner's settlement, like a native Promise. The adopted value is
 * stored durably, so it replays across upgrade.
 */
test.serial(
  'a durable ephemeral promise can chain to another, durably',
  async t => {
    annihilate();

    await startLife(async baggage => {
      const zone = makeDurableZone(baggage, 'durableRoot');
      const makeKit = prepareDurableEphemeralPromiseKit(zone);

      const inner = zone.makeOnce('inner', makeKit);
      const outer = zone.makeOnce('outer', makeKit);

      // outer adopts inner's (still pending) promise...
      outer.settler.resolve(inner.consumer.getPromise());
      // ...then inner settles, and outer follows.
      inner.settler.resolve(7);
      t.is(await outer.consumer.getPromise(), 7, 'outer adopts inner value');
    });

    await startLife(async baggage => {
      const zone = makeDurableZone(baggage, 'durableRoot');
      const makeKit = prepareDurableEphemeralPromiseKit(zone);

      const outer = zone.makeOnce('outer', () => {
        t.fail('outer maker called on revival');
        return makeKit();
      });
      t.is(
        await outer.consumer.getPromise(),
        7,
        'adopted value survived upgrade',
      );
    });
  },
);

/**
 * Chaining propagates rejection: if the adopted promise rejects, the adopting
 * promise rejects with the same reason.
 */
test.serial('chaining propagates rejection', async t => {
  annihilate();

  await startLife(async baggage => {
    const zone = makeDurableZone(baggage, 'durableRoot');
    const makeKit = prepareDurableEphemeralPromiseKit(zone);

    const inner = zone.makeOnce('inner', makeKit);
    const outer = zone.makeOnce('outer', makeKit);

    outer.settler.resolve(inner.consumer.getPromise());
    inner.settler.reject(Error('inner failed'));
    await t.throwsAsync(outer.consumer.getPromise(), {
      message: 'inner failed',
    });
  });
});

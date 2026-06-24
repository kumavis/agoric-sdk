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
test('durable ephemeral promise is awaitable within an incarnation', async t => {
  annihilate();

  await startLife(async baggage => {
    const zone = makeDurableZone(baggage, 'durableRoot');
    const makeKit = prepareDurableEphemeralPromiseKit(zone);

    const fulfilledKit = zone.makeOnce('fulfilledKit', makeKit);
    fulfilledKit.settler.resolve(42);
    t.is(await fulfilledKit.consumer.getPromise(), 42);

    const rejectedKit = zone.makeOnce('rejectedKit', makeKit);
    rejectedKit.settler.reject(Error('nope'));
    await t.throwsAsync(rejectedKit.consumer.getPromise(), { message: 'nope' });
  });
});

/**
 * A settlement that happened before an upgrade is replayed durably: the
 * revived promise settles with the same value / reason.
 */
test('settled durable ephemeral promise replays across upgrade', async t => {
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
});

/**
 * A promise still pending at upgrade is rejected on revival -- the in-flight
 * work is not retried. This is the defining contrast with a Vow.
 */
test('pending durable ephemeral promise rejects across upgrade', async t => {
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

    await pendingKit.consumer.getPromise().then(
      value => t.fail(`expected rejection, got ${value}`),
      reason => {
        t.deepEqual(reason, {
          name: 'vatUpgraded',
          upgradeMessage:
            'durable ephemeral promise was still pending when its vat was upgraded',
          incarnationNumber: 2,
        });
      },
    );
  });
});

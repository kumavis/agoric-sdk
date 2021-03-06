import '@agoric/install-ses';
import { test } from 'tape-promise/tape';
import path from 'path';
import { buildVatController, loadBasedir } from '../src/index';

const RETIRE_KPIDS = true;

test('flush', async t => {
  const config = await loadBasedir(path.resolve(__dirname, 'basedir-promises'));
  const c = await buildVatController(config, ['flush']);
  // all promises should settle before c.step() fires
  await c.step();
  t.deepEqual(c.dump().log, ['bootstrap called', 'then1', 'then2']);
  t.end();
});

test('E() resolve', async t => {
  const config = await loadBasedir(path.resolve(__dirname, 'basedir-promises'));
  const c = await buildVatController(config, ['e-then']);

  await c.run();
  t.deepEqual(c.dump().log, [
    'bootstrap called',
    'left.callRight 1',
    'right 2',
    'b.resolved 3',
    'left.then 4',
  ]);
  t.end();
});

test('E(E(x).foo()).bar()', async t => {
  const config = await loadBasedir(path.resolve(__dirname, 'basedir-promises'));
  const c = await buildVatController(config, ['chain1']);

  /*
  while (true) {
    console.log('--- STEP ----------------------------------------------------------------');
    await c.step();
    console.log(c.dump());
    if (!c.dump().runQueue.length)
      break;
  } */
  await c.run();

  t.deepEqual(c.dump().log, [
    'bootstrap called',
    'b.call2',
    'left.call2 1',
    'left.call3 2',
    'b.resolved 3',
  ]);
  t.end();
});

test('E(Promise.resolve(presence)).foo()', async t => {
  const config = await loadBasedir(path.resolve(__dirname, 'basedir-promises'));
  const c = await buildVatController(config, ['chain2']);

  await c.run();
  t.deepEqual(c.dump().log, [
    'bootstrap called',
    'b.call2',
    'left.call2 1',
    'left.call3 2',
    'b.resolved 3',
  ]);
  t.end();
});

test('E(local).foo()', async t => {
  const config = await loadBasedir(path.resolve(__dirname, 'basedir-promises'));
  const c = await buildVatController(config, ['local1']);

  await c.run();
  t.deepEqual(c.dump().log, [
    'bootstrap called',
    'b.local1.finish',
    'local.foo 1',
    'b.resolved 2',
  ]);
  t.end();
});

test('resolve-to-local', async t => {
  const config = await loadBasedir(path.resolve(__dirname, 'basedir-promises'));
  const c = await buildVatController(config, ['local2']);

  await c.run();
  t.deepEqual(c.dump().log, [
    'bootstrap called',
    'b.local2.finish',
    'left.returnArg',
    'local.foo 2',
    'b.resolved 3',
  ]);
  t.end();
});

test('send-promise-resolve-to-local', async t => {
  const config = await loadBasedir(path.resolve(__dirname, 'basedir-promises'));
  const c = await buildVatController(config, ['send-promise1']);

  await c.run();
  t.deepEqual(c.dump().log, [
    'bootstrap called',
    'b.send-promise1.finish',
    'left.takePromise',
    'left.takePromise.then',
    'local.foo 1',
    'b.resolved 4',
  ]);
  t.end();
});

test('send-harden-promise-1', async t => {
  const config = await loadBasedir(
    path.resolve(__dirname, 'basedir-promises-2'),
  );
  const c = await buildVatController(config, ['harden-promise-1']);

  await c.run();
  t.deepEqual(c.dump().log, [
    'bootstrap called',
    'p2 frozen true',
    'p3 frozen true',
    // TODO: p4 = x!foo(), and we'd like it to be frozen, but the Handled
    // Promise API does not currently provide a place for us to freeze it.
    // See #95 for details.
    // 'p4 frozen true',
    // 'o1 frozen true',
    'o1 frozen true',
    'o1 frozen true',
    'b.harden-promise-1.finish',
  ]);
  t.end();
});

test('circular promise resolution data', async t => {
  const config = await loadBasedir(path.resolve(__dirname, 'basedir-circular'));
  const c = await buildVatController(config);

  await c.run();
  const expectedPromises = [
    {
      id: 'kp41',
      state: 'fulfilledToData',
      refCount: 3,
      data: {
        body: '[{"@qclass":"slot","index":0}]',
        slots: ['kp42'],
      },
    },
    {
      id: 'kp42',
      state: 'fulfilledToData',
      refCount: 3,
      data: {
        body: '[{"@qclass":"slot","index":0}]',
        slots: ['kp41'],
      },
    },
  ];
  if (!RETIRE_KPIDS) {
    expectedPromises.push({
      id: 'kp43',
      state: 'fulfilledToData',
      refCount: 0,
      data: {
        body: '{"@qclass":"undefined"}',
        slots: [],
      },
    });
  }
  t.deepEqual(c.dump().promises, expectedPromises);
  t.end();
});

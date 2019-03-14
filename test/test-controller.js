import path from 'path';
import { test } from 'tape-promise/tape';
import { buildVatController, loadBasedir } from '../src/index';

test('load empty', async t => {
  const config = {
    vatSources: new Map(),
    bootstrapIndexJS: undefined,
  };
  const controller = await buildVatController(config);
  await controller.run();
  t.end();
});

async function simpleCall(t, controller) {
  await controller.addVat('vat1', require.resolve('./d1'));
  const data = controller.dump();
  t.deepEqual(data.vatTables, [{ vatID: 'vat1' }]);
  t.deepEqual(data.kernelTable, []);

  controller.queue('vat1', 1, 'foo', 'args');
  t.deepEqual(controller.dump().runQueue, [
    { vatID: 'vat1', facetID: 1, method: 'foo', argsString: 'args', slots: [] },
  ]);
  await controller.run();
  t.deepEqual(JSON.parse(controller.dump().log[0]), {
    facetID: 1,
    method: 'foo',
    argsString: 'args',
    slots: [],
  });

  controller.log('2');
  t.equal(controller.dump().log[1], '2');

  t.end();
}

test('simple call with SES', async t => {
  const controller = await buildVatController({});
  await simpleCall(t, controller);
});

test('simple call non-SES', async t => {
  const controller = await buildVatController({}, false);
  await simpleCall(t, controller);
});

test('reject module-like sourceIndex', async t => {
  const vatSources = new Map();
  // the keys of vatSources are vat source index strings: something that
  // require() or rollup can use to import/stringify the source graph that
  // should be loaded into the vat. We want this to be somewhere on local
  // disk, so it should start with '/' or '.'. If it doesn't, the name will
  // be treated as something to load from node_modules/ (i.e. something
  // installed from npm), so we want to reject that.
  vatSources.set('vat1', 'vatsource');
  t.rejects(
    async () => buildVatController({ vatSources }, false),
    /sourceIndex must be relative/,
  );
  t.end();
});

async function bootstrap(t, withSES) {
  const config = await loadBasedir(path.resolve(__dirname, 'd2'));
  // the controller automatically runs the bootstrap function.
  // d2/bootstrap.js logs "bootstrap called" and queues a call to
  // left[0].bootstrap
  const c = await buildVatController(config, withSES);
  t.deepEqual(c.dump().log, ['bootstrap called']);
  t.end();
}

test('bootstrap with SES', async t => {
  await bootstrap(t, true);
});

test('bootstrap without SES', async t => {
  await bootstrap(t, false);
});

async function bootstrapExport(t, withSES) {
  const config = await loadBasedir(path.resolve(__dirname, 'd3'));
  const c = await buildVatController(config, withSES);
  // console.log(c.dump());
  // console.log('SLOTS: ', c.dump().runQueue[0].slots);
  t.deepEqual(c.dump().kernelTable, []);

  t.deepEqual(c.dump().runQueue, [
    {
      vatID: '_bootstrap',
      facetID: 0,
      method: 'bootstrap',
      argsString:
        '{"args":[[],{"left":{"@qclass":"slot","index":0},"right":{"@qclass":"slot","index":1}}]}',
      slots: [{ vatID: 'left', slotID: 0 }, { vatID: 'right', slotID: 0 }],
    },
  ]);

  t.deepEqual(c.dump().log, [
    'left.setup called',
    'right.setup called',
    'bootstrap called',
  ]);
  // console.log('--- c.step() running bootstrap.obj0.bootstrap');
  await c.step();
  t.deepEqual(c.dump().log, [
    'left.setup called',
    'right.setup called',
    'bootstrap called',
    'bootstrap.obj0.bootstrap()',
  ]);
  t.deepEqual(c.dump().kernelTable, [
    ['_bootstrap', -2, 'right', 0],
    ['_bootstrap', -1, 'left', 0],
  ]);
  t.deepEqual(c.dump().runQueue, [
    {
      vatID: 'left',
      facetID: 0,
      method: 'foo',
      argsString:
        '{"args":[1,{"@qclass":"slot","index":0}],"resolver":{"@qclass":"slot","index":1}}',
      slots: [
        { vatID: 'right', slotID: 0 },
        { vatID: '_bootstrap', slotID: 1 },
      ],
    },
  ]);
  await c.step();
  t.deepEqual(c.dump().log, [
    'left.setup called',
    'right.setup called',
    'bootstrap called',
    'bootstrap.obj0.bootstrap()',
    'left.foo 1',
  ]);
  t.deepEqual(c.dump().kernelTable, [
    ['_bootstrap', -2, 'right', 0],
    ['_bootstrap', -1, 'left', 0],
    ['left', -2, '_bootstrap', 1],
    ['left', -1, 'right', 0],
  ]);
  t.deepEqual(c.dump().runQueue, [
    {
      vatID: 'right',
      facetID: 0,
      method: 'bar',
      argsString:
        '{"args":[2,{"@qclass":"slot","index":0}],"resolver":{"@qclass":"slot","index":1}}',
      slots: [{ vatID: 'right', slotID: 0 }, { vatID: 'left', slotID: 1 }],
    },
    {
      vatID: '_bootstrap',
      facetID: 1,
      method: 'resolve',
      argsString: '{"args":[{"@qclass":"undefined"}]}',
      slots: [],
    },
  ]);

  await c.step();
  t.deepEqual(c.dump().log, [
    'left.setup called',
    'right.setup called',
    'bootstrap called',
    'bootstrap.obj0.bootstrap()',
    'left.foo 1',
    'right.obj0.bar 2 true',
  ]);
  t.deepEqual(c.dump().runQueue, [
    {
      vatID: '_bootstrap',
      facetID: 1,
      method: 'resolve',
      argsString: '{"args":[{"@qclass":"undefined"}]}',
      slots: [],
    },
    {
      vatID: 'left',
      facetID: 1,
      method: 'resolve',
      argsString: '{"args":[3]}',
      slots: [],
    },
  ]);

  await c.step();
  t.deepEqual(c.dump().runQueue, [
    {
      vatID: 'left',
      facetID: 1,
      method: 'resolve',
      argsString: '{"args":[3]}',
      slots: [],
    },
  ]);

  await c.step();
  t.deepEqual(c.dump().runQueue, []);

  t.end();
}

test('bootstrap export with SES', async t => {
  await bootstrapExport(t, true);
});

test('bootstrap export without SES', async t => {
  await bootstrapExport(t, false);
});
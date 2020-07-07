// import '@agoric/install-metering-and-ses';
// import path from 'path';
// import { test } from 'tape';
// import { initSwingStore } from '@agoric/swing-store-simple';
// import bundleSource from '@agoric/bundle-source';
// import { buildVatController, loadBasedir } from '@agoric/swingset-vat';

// function nonBundleFunction(_E) {
//   return {};
// }

// async function doTestSetup(mode) {
//   const config = await loadBasedir(__dirname);
//   config.hostStorage = initSwingStore().storage;
//   const adminBundle = await bundleSource(
//     path.join(__dirname, 'vat-counter.js'),
//   );
//   const nonBundle = `${nonBundleFunction}`;
//   const bundles = { adminBundle };
//   const c = await buildVatController(config, [mode, bundles]);
//   return c;
// }
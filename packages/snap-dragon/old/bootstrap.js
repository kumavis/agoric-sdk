/* global harden */
import bundleSource from '@agoric/bundle-source';

// async function run() {
//   const bundle = await bundleSource('.../vat-counter.js');
//   // 'bundle' can be JSON serialized
//   const control = await E(vatAdminService).createVat(bundle);
//   // const { root, adminNode } = await E(vatAdminService).createVat(bundle);
//   await E(root).increment();
//   let count = E(root).read();
//   console.log(count); // 1
//   await E(root).increment();
//   count = E(root).read();
//   console.log(count); // 2
// }

export default function setup(syscall, state, helpers) {
  const { log } = helpers;
  return helpers.makeLiveSlots(
    syscall,
    state,
    E =>
      harden({
        async bootstrap(argv, vats, devices) {
          const bundles = argv[1];
          const vatAdminSvc = await E(vats.vatAdmin).createVatAdminService(
            devices.vatAdmin,
          );
          log(`starting counter test`);
          const { root } = await E(vatAdminSvc).createVat(
            bundles.newVatBundle,
          );
          const c = E(root).createRcvr(1);
          log(await E(c).increment(3));
          log(await E(c).increment(5));
          log(await E(c).ticker());
          return;
          
          // case 'vatStats': {
          //   log(`starting stats test`);
          //   const { root, adminNode } = await E(vatAdminSvc).createVat(
          //     bundles.newVatBundle,
          //   );
          //   log(await E(adminNode).adminData());
          //   const c = E(root).createRcvr(1);
          //   log(await E(c).increment(3));
          //   log(await E(adminNode).adminData());
          //   return;
          // }
          // default:
          //   throw new Error(`unknown argv mode '${argv[0]}'`);
        },
      }),
    helpers.vatID,
  );
}

/* global harden */

import { allComparable } from '@agoric/same-structure';
import { makeBridgeManager } from './bridge';

console.debug(`loading bootstrap.js`);

export default function setup(syscall, state, helpers) {
  return helpers.makeLiveSlots(
    syscall,
    state,
    (E, D) => {
      async function setupCommandDevice(httpVat, cmdDevice, roles) {
        await E(httpVat).setCommandDevice(cmdDevice, roles);
        D(cmdDevice).registerInboundHandler(httpVat);
      }

      async function setupWalletVat(httpObj, httpVat, walletVat) {
        await E(httpVat).registerURLHandler(walletVat, '/private/wallet');
        const bridgeURLHandler = await E(walletVat).getBridgeURLHandler();
        await E(httpVat).registerURLHandler(
          bridgeURLHandler,
          '/private/wallet-bridge',
        );
        await E(walletVat).setHTTPObject(httpObj);
        await E(walletVat).setPresences();
      }

      // objects that live in the client's solo vat. Some services should only
      // be in the DApp environment (or only in end-user), but we're not yet
      // making a distinction, so the user also gets them.
      async function createLocalBundle(
        vats,
        _userBundle,
        _payments,
        _issuerInfo,
      ) {
        // Wallet for both end-user client and dapp dev client
        const snapController = E(vats.snapController).makeHost();

        // This will eventually be a vat spawning service. Only needed by dev
        // environments.
        const spawner = E(vats.host).makeHost();

        // Needed for DApps, maybe for user clients.
        const uploads = E(vats.uploads).getUploads();

        // Wallet for both end-user client and dapp dev client
        const wallet = E(vats.wallet).getWallet();

        // This will allow dApp developers to register in their api/deploy.js
        const httpRegCallback = {
          send(obj, connectionHandles) {
            return E(vats.http).send(obj, connectionHandles);
          },
          registerAPIHandler(handler) {
            return E(vats.http).registerURLHandler(handler, '/api');
          },
        };

        return allComparable(
          harden({
            uploads,
            spawner,
            wallet,
            network: vats.network,
            http: httpRegCallback,
            snapController,
          }),
        );
      }

      return harden({
        async bootstrap(argv, vats, devices) {
          const bridgeManager =
            devices.bridge && makeBridgeManager(E, D, devices.bridge);
          D(devices.mailbox).registerInboundHandler(vats.vattp);
          await E(vats.vattp).registerMailboxDevice(devices.mailbox);
          
          await setupCommandDevice(vats.http, devices.command, {
            client: true,
          });
          const localTimerService = await E(vats.timer).createTimerService(
            devices.timer,
          );

          const localBundle = await createLocalBundle(
            vats,
          );
          await E(vats.http).setPresences({ localTimerService }, localBundle);
          await setupWalletVat(localBundle.http, vats.http, vats.wallet);
        },
      });
    },
    helpers.vatID,
  );
}

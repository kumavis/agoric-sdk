// @ts-check
// Agoric Dapp api deployment script

// import fs from 'fs';
// import installationConstants from '../ui/public/conf/installationConstants.js';
import { E } from '@agoric/eventual-send';
// import harden from '@agoric/harden';

// deploy.js runs in an ephemeral Node.js outside of swingset. The
// spawner runs within ag-solo, so is persistent.  Once the deploy.js
// script ends, connections to any of its objects are severed.

// The deployer's wallet's petname for the tip issuer.
// const TIP_ISSUER_PETNAME = process.env.TIP_ISSUER_PETNAME || 'moola';

/**
 * @typedef {Object} DeployPowers The special powers that `agoric deploy` gives us
 * @property {(path: string) => { moduleFormat: string, source: string }} bundleSource
 * @property {(path: string) => string} pathResolve
 */

/**
 * @param {any} homePromise A promise for the references
 * available from REPL home
 * @param {DeployPowers} powers
 */
export default async function deployApi(
  homePromise,
  { bundleSource, pathResolve },
) {
  // Let's wait for the promise to resolve.
  const home = await homePromise;

  // Unpack the references.
  const {
    // Scratch is a map only on this machine, and can be used for
    // communication in objects between processes/scripts on this
    // machine.
    uploads: scratch,
    // The spawner persistently runs scripts within ag-solo, off-chain.
    spawner,
    http,
    // snap system interface
    snapController,
  } = home;

  await deploySnap('accountEth', './account-eth.js')
  await deploySnap('accountAtom', './account-atom.js')
  await deploySnap('uniswap', './ex-uniswap.js')
  await deploySnap('advisor', './agent-advisor.js')

  async function deploySnap (snapName, path) {
    // Bundle up the handler code
    const bundle = await bundleSource(pathResolve(path));
    // Install it on the spawner
    const handlerInstall = E(spawner).install(bundle);
    // Spawn the running code
    const bundleApiSurface = E(handlerInstall).spawn({ http, snapController });
    await E(scratch).set(snapName, bundleApiSurface);

    await E(snapController).install(bundleApiSurface)
  }

}

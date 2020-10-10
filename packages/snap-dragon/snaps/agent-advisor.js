// @ts-check
import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

export default harden(({ publicAPI, http, snapController }, _inviteMaker) => {
  return harden({
    serviceTags: [
      'suggest',
    ],
    api: {
      canHandle: (action, params) => {
        return true
      },
      handle: async (action, params) => {
        // suggest exchanging eth for atoms
        const [source] = await E(snapController).findByTag('eth:send')
        const [target] = await E(snapController).findByTag('atom:receive')
        const [exchange] = await E(snapController).findByTag('exchange')
        return `suggest: exchange ${await E(source.api).getName()} to ${await E(target.api).getName()} via ${await E(exchange.api).getName()}`
      },
    },
  });
});

// @ts-check
import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

export default harden(({ publicAPI, http }, _inviteMaker) => {
  return harden({
    serviceTags: [
      'exchange',
    ],
    api: {
      canHandle: (action, params) => {
        return true
      },
      handle: (action, params) => {
        debugger
      },
      getName: () => {
        return 'uniswap (exchange)'
      }
    },
  });
});

// @ts-check
import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

export default harden(({ publicAPI, http }, _inviteMaker) => {
  return harden({
    serviceTags: [
      'atom:send',
      'atom:receive',
    ],
    api: {
      canHandle: (action, params) => {
        debugger
      },
      handle: (action, params) => {
        debugger
      },
      getName () {
        return 'atom:0xabcd'
      }
    },
  });
});

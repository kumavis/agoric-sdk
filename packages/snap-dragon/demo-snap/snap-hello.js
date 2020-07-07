// @ts-check
import harden from '@agoric/harden';
import { E } from '@agoric/eventual-send';

export default harden(({ publicAPI, http }, _inviteMaker) => {
  return harden({
    hello() {
      return 'hi';
    },
    // data: 124,
  });
});

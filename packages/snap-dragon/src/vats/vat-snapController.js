// Copyright (C) 2018 Agoric, under Apache License 2.0

/* global harden */

import { makeContractHost } from '@agoric/spawner';

function setup(syscall, state, helpers, vatPowers0) {
  return helpers.makeLiveSlots(
    syscall,
    state,
    (_E, _D, vatPowers) =>
      harden({
        makeHost() {
          return harden(makeSnapController());
        },
      }),
    helpers.vatID,
    vatPowers0,
  );
}
export default harden(setup);

function makeSnapController () {
  const snaps = []
  return {
    install: async (snap) => {
      snaps.push(await snap)
    },
    findByTag: async (tag) => {
      return snaps.filter(snap => {
        return snap.serviceTags.includes(tag)
      })
    },
  }
}
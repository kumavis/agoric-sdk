/* global harden */

import makeScratchPad from './scratch';

// This vat contains the private upload scratch pad.

function build(_E, _log) {
  const uploads = makeScratchPad();

  function getUploads() {
    return uploads;
  }

  return harden({ getUploads });
}

export default function setup(syscall, state, helpers) {
  return helpers.makeLiveSlots(
    syscall,
    state,
    E => build(E, helpers.log),
    helpers.vatID,
  );
}

- ses
  - Error
    - is an encapsilation of the real one
    - unsafe mode ()
      - should work on depd! but not tested against the module

- lavamoat
  - native modules
    - compile to wasm/wasi?
    - "binding" package
      - if anything can access binding, its dangerous. 
      - doesnt matter if you swapped for a different native module
  - capability injection
    - endowing the global
  - cjs/esm interopt
    - ask kriskowal

- snaps
  - multi-vats
    - asyncly coupled
    - prevents re-entrancy
    - orthognal persistance
      - ^ maybe prohibitive due to snapshots
    - seperate termination
    - metering
    - vats are unit of migration (scifi)



- metamask ag-solo
  - native messaging
  -  

ag-solo (currently bloated for many features)
  - vats
    - network

  this is the one you care about
    https://github.com/Agoric/agoric-sdk/blob/b4c421d6bdc042f1690c0672c89b68889e781804/packages/cosmic-swingset/lib/ag-solo/vats/bootstrap.js#L464-L496


starting from scratch
  
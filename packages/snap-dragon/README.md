### "demo" directory is an instance of a "swingset configuration"

- create this via snapdragon cli
```
./bin/snap-dragon.sh init demo
```
- this creates the initial conditions for the swingset machine
- from "demo" dir, start with
```
(cd demo && ../bin/snap-dragon.sh start)
```

### "demo-snap" directory is an example snap that can be installed

- install via agoric cli
```
agoric deploy ./snaps/deploy.js
```

### boostrap
if you change this, reinit

### future work

- wrap deploy
- api for snaps
  - return metadata, like "service discovery"
- "snapdragon deploy" to constrain permissions
  - set env var + call agoric deploy

### todo

file bug for swallowed error
  Error: cannot serialize objects with non-methods


- ag-solo
  - cap 

- live slots
  - orthog persist



ocap-pub

comdex
  capdesk
    capability java desktop

miller columns by markm


can snaps async require
  tofu config
  
### "t" directory is an instance of a "swingset configuration"

- create this via snapdragon cli "./bin/snap-dragon.sh init"
- this creates the initial conditions for the swingset machine
- start with "./bin/snap-dragon.sh start"

### "demo-snap" directory is an example snap that can be installed

- install via agoric cli "agoric deploy ./deploy.js"

### future work

- wrap deploy
- api for snaps
  - return metadata, like "service discovery"
- "snapdragon deploy" to constrain permissions
  - set env var + call agoric deploy
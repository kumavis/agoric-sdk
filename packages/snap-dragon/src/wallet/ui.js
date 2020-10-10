// import './install-ses.js'
// import { E } from '@agoric/captp'

import { Duplex } from 'stream'

// import wsCaptp from 'node-ws-captp';
// const { createServer, createClient } = wsCaptp
// const { createServer, createClient } = require('node-ws-captp');

// const greeting = 'Hello, world!';

// const bootstrap  = {
//   greet: async () => greeting,
// };

// const killServer = createServer(bootstrap, 8088);

// createClient

main()
 
async function main () {
  const hostport = '127.0.0.1:8000'
  const wsurl = `ws://${hostport}/private/captp`;
  const { E, getBootstrap, abort } = createClient(wsurl);
  
  
  let bootP = getBootstrap();
  const loaded = await E.G(bootP).LOADING;
  log.info('Chain loaded:', loaded);
  // Take a new copy, since the chain objects have been added to bootstrap.
  bootP = getBootstrap()
  
}



// const value = await E(getBootstrap()).greet();

// const { getBootstrap, captpStream } = makeCaptpStream() 
// const ws = websocket('ws://echo.websocket.org')

// pump(
//   ws,
//   captpStream,
//   ws,
//   (err) => console.log('did close', err)
// )



console.log(window.location)

export default async () => {
  globalThis.E = E

  let bootP = getBootstrap();
  const loaded = await E.G(bootP).LOADING;
  log.info('Chain loaded:', loaded);
  // Take a new copy, since the chain objects have been added to bootstrap.
  bootP = getBootstrap()

  // const { dispatch, getBootstrap } = makeCapTP('bundle', obj =>
  //   sendJSON(ws, obj),
  // );

  // Wait for the chain to become ready.
  // let bootP = getBootstrap();
  // const loaded = await E.G(bootP).LOADING;
  // log.info('Chain loaded:', loaded);
  // // Take a new copy, since the chain objects have been added to bootstrap.
  // bootP = getBootstrap();

  // const obj = JSON.parse(data);
  // log.debug('receiving', data.slice(0, 200));
  // if (obj.type === 'CTP_ERROR') {
  //   throw obj.error;
  // }
  // dispatch(obj);

  // const home = await bootP

  // const wallet = await E.G(home).wallet
  // const wallet = await E.G(home).wallet

  // wallet

  // const offerP = E(E.G(bootP).wallet).getSendOffer()
}

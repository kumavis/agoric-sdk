#!/usr/bin/env node

const process = require('process');
const fs = require('fs');
const toml = require('@iarna/toml');

// point this at ~/.ag-cosmos-chain/config/config.toml

const configString = fs.readFileSync(process.argv[2]).toString();
const config = toml.parse(configString);
const laddr = config.rpc.laddr; // like tcp://0.0.0.0:26657
const m = laddr.match(/^tcp:\/\/([\d\.]+):(\d+)$/);
if (!m) {
  throw new Error(`error, unexpected laddr format ${laddr}`);
}
let addr = m[1];
if (addr === '0.0.0.0') {
  addr = '127.0.0.1';
}
const port = m[2];
const rpcAddr = `${addr}:${port}`;
console.log(rpcAddr);
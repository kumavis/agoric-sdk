import parseArgs from 'minimist';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';

export default async function installMain(progname, rawArgs, priv) {
  const { console, error } = priv;
  const {
    _: args,
  } = parseArgs(rawArgs);

  const pspawn = (...args) => new Promise((resolve, reject) => {
    const cp = spawn(...args);
    cp.on('exit', resolve);
    cp.on('error', () => resolve(-1));
  });
  
  // Install Yarn.
  const pmRet = await pspawn('yarn', ['--version']);
  if (pmRet !== 0) {
    await pspawn('npm', ['install', '-g', 'yarn'], { stdio: 'inherit' });
  }
  const pm = 'yarn';

  // FIXME: Check for version 1.13.
  const goRet = await pspawn('go', ['version']);
  const goCmd = goRet === 0 && pspawn('npm', ['install'], { cwd: '.agservers', stdio: 'inherit' });

  await Promise.all([
    pspawn(pm, ['install'], { cwd: 'ui', stdio: 'inherit' }),
    pspawn(pm, ['install'], { cwd: 'api', stdio: 'inherit' }),
    pspawn(pm, ['install'], { cwd: 'contract', stdio: 'inherit' }),
    goCmd,
  ]);

  if (!goCmd) {
    console.log(chalk.bold.yellow(`To run Agoric locally you will need to install Go and rerun '${progname} install'`));
  } else {
    // FIXME: Build the wallet
    await pspawn(pm, ['install'], { cwd: '.agservers/node_modules/@agoric/wallet-frontend' });
    await pspawn(pm, ['run', 'build'], { cwd: '.agservers/node_modules/@agoric/wallet-frontend' });
  }
  console.log(chalk.bold.green('Done installing'));
}
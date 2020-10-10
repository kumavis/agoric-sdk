import { promises as fs } from 'fs'
import path from 'path'
import bundleSource from '@agoric/bundle-source'
import builtins from 'rollup-plugin-node-builtins'
import globals from 'rollup-plugin-node-globals'

start()

async function start () {
  return build({
    buildMode: 'nestedEvaluate',
    // buildMode: 'getExport',
  })
}

async function build ({ buildMode }) {
  const bundle = await bundleSource(
    path.join(__dirname, 'ui.js'),
    // path.join(__dirname, 'bug.js'),
    buildMode,
    null,
    {
      browser: true,
      plugins: [
        globals(),
        builtins(),
      ]
    }
  )

  const initFn = buildMode === 'nestedEvaluate' ? nestedEvaluateInitFn : getExportInitFn 
  const initFnSource = `;(function(){${initFn()}})()\n`
  await fs.writeFile(path.join(__dirname, 'bundle.js'), bundle.source)
  await fs.writeFile(path.join(__dirname, 'bundle-init.js'), initFnSource)
}

function nestedEvaluateInitFn () {
  return `
  // bug workaround
  globalThis.require = () => (x) => { debugger; return x }
  // nestedEvaluate
  globalThis.nestedEvaluate = (src) => { return (0,eval)(src) }
  const { default: activate } = getExportWithNestedEvaluate()
  `
}

function getExportInitFn () {
  return `
  const { default: activate } = getExport()
  `
}
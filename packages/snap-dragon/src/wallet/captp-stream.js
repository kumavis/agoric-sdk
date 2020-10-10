import Readable from 'readable-stream'
import duplexifyPackage from 'duplexify'
import pumpify from 'pumpify'
import flushWriteStream from 'flush-write-stream'
import throughPackage from 'through2'
import callbackify from 'util-callbackify'
import { makeCapTP } from '@agoric/captp'

const { obj: makeWriteable } = flushWriteStream
const { obj: duplexify } = duplexifyPackage
const { obj: pipeline } = pumpify
const { obj: through } = throughPackage

function makeCaptpStream () {
  const readable = new Readable({
    // read(size) {
    //   // ...
    // }
  })
  const { dispatch, getBootstrap } = makeCapTP('bundle', obj => {
    readable.push(obj)
  })
  const writeable = makeWriteable(callbackify(async (data, _) => {
    dispatch(data)
  }))

  const serialize = through(callbackify(async (chunk, _) => {
    return JSON.stringify(chunk)
  }))
  const deserialize = through(callbackify(async (chunk, _) => {
    return JSON.parse(chunk)
  }))

  const captpStream = pipeline(
    // serialize,
    deserialize,
    duplexify(
      writeable,
      readable,
    ),
    // deserialize,
    serialize,
  )
  return { getBootstrap, captpStream }
}


export default makeCaptpStream
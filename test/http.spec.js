/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const Promise = require('bluebird')
const tmp = Promise.promisifyAll(require('tmp'))
const port = 3000
const request = require('request-promise').defaults({
  baseUrl: `http://127.0.0.1:${port}`,
  json: true
})
const fs = Promise.promisifyAll(require('fs'))
tmp.setGracefulCleanup()

const exec = require('child_process').exec
const executeInShell = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error)
      }
      resolve(stdout ? stdout : stderr)
    })
  })
}

const server = require('../src/server')
const POOL_NAME = 'http-test'
const ZFS = require('../src/zfs')
const zfs = new ZFS({
  pool: POOL_NAME
})

ava.afterEach.always(async (test) => {
  return executeInShell(`zpool destroy ${POOL_NAME}`)
})

ava.beforeEach(async (test) => {
  const tmpStorage = await tmp.fileAsync()
  test.context.storage = tmpStorage
  await fs.writeFileAsync(tmpStorage, Buffer.alloc(1024*1024*100))
  await executeInShell(`zpool create ${POOL_NAME} ${tmpStorage}`)
  await server.start({
    port: 3000,
    pool: POOL_NAME
  })
  await zfs.init()
})

ava.serial('Should be able to get and create caches', async (test) => {
  console.log('starting test')
  const caches = await request.get('/caches')
  console.log('got caches')
  test.deepEqual(['http-test/caches'], caches)

  const first = await request.post('/caches')
  console.log(first)

})

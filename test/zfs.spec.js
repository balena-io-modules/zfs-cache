/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const ava = require('ava')
const Promise = require('bluebird')
const tmp = Promise.promisifyAll(require('tmp'))
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

const POOL_NAME = 'test'
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
})

ava.serial('Should be able to create a cache', async (test) => {
  const cache = await zfs.createCache('test')

  const hasCache = await zfs.existsCache('test')
  test.truthy(hasCache)
})

ava.serial.only('Should be able to create a branch from a cache', async (test) => {
  const cache = await zfs.createCache('test')
  const snapshotIdentifier = 0
  const branchIdentifier = 'AAAAAAA'

  const snapshot = await zfs.createSnapshot(cache, snapshotIdentifier)
  const branch = await zfs.createBranch(snapshot, 'test', branchIdentifier)

  const hasCache = await zfs.existsCache('test')
  test.truthy(hasCache)

  const hasBranch = await zfs.existsBranch('test', {
    snapshotIdentifier,
    branchIdentifier
  })
  test.truthy(hasBranch)
})

ava.serial('Should be able to promote a branch to a new cache', async (test) => {
  const cache = await zfs.createCache('test')
  const snapshotIdentifier = 0
  const branchIdentifier = 'AAAAAAA'

  await zfs.createSnapshot('test', {
    snapshotIdentifier
  })
  await zfs.createBranch('test', {
    snapshotIdentifier,
    branchIdentifier
  })

  await zfs.promoteBranch('test', {
    branchIdentifier
  })

  const hasCache = await zfs.existsCache('test')

  test.truthy(hasCache)
})

ava.serial('Should persist files from a branch when promoting it to a cache', async (test) => {
  const cache = await zfs.createCache('test')
  const snapshotIdentifier = 0
  const branchIdentifier = 'AAAAAAA'

  await zfs.createSnapshot('test', {
    snapshotIdentifier
  })
  await zfs.createBranch('test', {
    snapshotIdentifier,
    branchIdentifier
  })

  const branchInfo = await zfs.existsBranch('test', {
    branchIdentifier
  })

  const branchPath = branchInfo[4]
  await fs.writeFileAsync(`${branchPath}/test`, Buffer.alloc(12))
  await zfs.promoteBranch('test', {
    branchIdentifier
  })

  const cacheInfo = await zfs.existsCache('test')
  const cachePath = cacheInfo[4]

  const exists = fs.existsSync(`${cachePath}/test`)
  test.truthy(exists)
})


ava.serial('Should remove extra branches after one is promoted', async (test) => {
  const cache = await zfs.createCache('test')
  const snapshotIdentifier = 0
  const branchIdentifierA = 'AAAAAAA'
  const branchIdentifierB = 'BBBBBBB'

  const snapshot = await zfs.createSnapshot('test', {
    snapshotIdentifier
  })
  const branchA = await zfs.createBranch('test', {
    snapshotIdentifier,
    branchIdentifier: branchIdentifierA
  })
  const branchB = await zfs.createBranch('test', {
    snapshotIdentifier,
    branchIdentifier: branchIdentifierB
  })

  const branchInfo = await zfs.existsBranch('test', {
    branchIdentifier: branchIdentifierA
  })

  const branchPath = branchInfo[4]
  await fs.writeFileAsync(`${branchPath}/test`, Buffer.alloc(1024))
  const l1 = await zfs.list({
    recurse: 'test'
  })
  const s1 = await zfs.list({
    recurse: 'test',
    snapshot: true
  })
  console.log('l1', l1)
  console.log('s1', s1)
  await zfs.promoteBranch('test', {
    branchIdentifier: branchIdentifierA
  })
  const l2 = await zfs.list({
    recurse: 'test'
  })
  const s2 = await zfs.list({
    recurse: 'test',
    snapshot: true
  })
  console.log('l2', l2)
  console.log('s2', s2)
  const hasCache = await zfs.existsCache('test')
  test.truthy(hasCache)

  // const hasBranch = await zfs.existsBranch('test', {
  //   branchIdentifier: branchIdentifierB
  // })
  // test.is(hasBranch, undefined)
})

// ava.serial.only('Should emulate PR flow', async (test) => {
//   const cache = await zfs.createCache('test')
//   const snapshotIdentifier = 0
//   const branchIdentifierA = 'AAAAAAA'
//   const branchIdentifierB = 'BBBBBBB'
//   const branchIdentifierC = 'CCCCCCC'
//
//   const snapshot = await zfs.createSnapshot('test', {
//     snapshotIdentifier
//   })
//
//   const branchA = await zfs.createBranch('test', {
//     snapshotIdentifier,
//     branchIdentifier: branchIdentifierA
//   })
//   const branchB = await zfs.createBranch('test', {
//     snapshotIdentifier,
//     branchIdentifier: branchIdentifierB
//   })
//
//   const branchInfo = await zfs.existsBranch('test', {
//     branchIdentifier: branchIdentifierA
//   })
//
//   const branchPath = branchInfo[4]
//   await fs.writeFileAsync(`${branchPath}/a`, Buffer.alloc(1024))
//
//   await zfs.promoteBranch('test', {
//     branchIdentifier: branchIdentifierA
//   })
//
//   const hasCache = await zfs.existsCache('test')
//   test.truthy(hasCache)
//
//   const snapshot2 = await zfs.createSnapshot('test', {
//     snapshotIdentifier: 1
//   })
//
//   const branchC = await zfs.createBranch('test', {
//     snapshotIdentifier: 1,
//     branchIdentifier: branchIdentifierC
//   })
//
//   const branchCInfo = await zfs.existsBranch('test', {
//     branchIdentifier: branchIdentifierC
//   })
//
//   const branchCPath = branchCInfo[4]
//   await fs.writeFileAsync(`${branchCPath}/c`, Buffer.alloc(1024))
//
//   await zfs.promoteBranch('test', {
//     branchIdentifier: branchIdentifierC
//   })
// })

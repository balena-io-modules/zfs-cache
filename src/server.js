/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const express = require('express')
const bodyParser = require('body-parser')
const _ = require('lodash')
const ZFS = require('./zfs')

const extractNames = (list) => {
  return _.map(list.slice(1), (ds) => ds[0])
}

module.exports.start = async (opts) => {
  const {
    pool,
    port
  } = opts
  const zfs = new ZFS({
    pool
  })
  const app = express()
  app.use(bodyParser.json())

// CACHES
  app.get('/caches', async (req, res) => {
    console.log('got caches')
    const list = await zfs.list({
      recurse: zfs.getCachePrefix()
    })
    console.log('done')
    return res.json(extractNames(list))
  })

  app.post('/caches', async (req, res) => {
    const name = req.body.name
    console.log(req.body)
    if (_.isUndefined(name)) {
      return res.status(400).send('You must specify a name for the cache')
    }
    await zfs.createCache(name)
    return res.sendStatus(200)
  })

  app.delete('/caches/:name', async (req, res) => {
    const name = req.params.name
    await zfs.destroyCache(name)
    return res.sendStatus(200)
  })


// BRANCHES
  app.get('/caches/:name/branches', async (req, res) => {
    const name = req.params.name
    const list = await zfs.list({
      recurse: zfs._addBranchPrefix(name)
    })
    res.json(extractNames(list))
  })

  app.post('/caches/:name/branches', async (req, res) => {
    const name = req.params.name
    const sha = req.body.sha
    const parent_sha = req.body.parent_sha

    let currentSnapshots
    const withParent = !_.isUndefined(parent_sha)
    if (withParent) {
      currentSnapshots = await zfs.list({
        recurse: zfs._branch(parent_sha, name),
        snapshot: true
      })
    } else {
      currentSnapshots = await zfs.list({
        recurse: zfs._addCachePrefix(name),
        snapshot: true
      })
    }

    console.log(currentSnapshots)
    const newSnapShotIdentifier =
      currentSnapshots.length <= 1 // First line is headers
      ? 1
      : _.max(
          _.map(extractNames(currentSnapshots), (snapshot) => {
            return _.toInteger(snapshot.slice(snapshot.lastIndexOf('@') + 1))
          })
        ) + 1
    console.log(newSnapShotIdentifier)

    await zfs.createSnapshot(withParent ? `${name}/${parent_sha}` : name, {
      snapshotIdentifier: newSnapShotIdentifier,
      fromCache: !withParent
    })
    await zfs.createBranch(name, {
      branchIdentifier: sha,
      snapshotIdentifier: newSnapShotIdentifier,
      fromCache: !withParent
    })
    return res.sendStatus(200)
  })

  app.listen(port, () => {
    console.log('SERVER IS UP')
  })
}

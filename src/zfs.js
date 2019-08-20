/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

const Promise = require('bluebird')
const _ = require('lodash')

const exec = require('child_process').exec
const executeInShell = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        resolve(error)
      }
      resolve(stdout ? stdout : stderr)
    })
  })
}

const parseTabSeperatedTable = (data) => {
  const lines = data.trim().split('\n')
  const rows = []
  return _.map(lines, (row) => {
    return row.split(/\s+/)
  })
}


module.exports = class Zfs {

  constructor (opts) {
    const {
      pool,
      zfsPath = 'zfs'
    } = opts

    this.pool = pool
    this.zfsPath = zfsPath
  }

  async init () {
    await executeInShell(`${this.zfsPath} create ${this._addPoolPrefix('caches')}`)
    await executeInShell(`${this.zfsPath} create ${this._addPoolPrefix('branches')}`)
  }

  async destroy () {
    await executeInShell(`${this.zfsPath} destroy ${this._addPoolPrefix('caches')}`)
    await executeInShell(`${this.zfsPath} destroy ${this._addPoolPrefix('branches')}`)
  }

  _addPoolPrefix (identifier) {
    return `${this.pool}/${identifier}`
  }

  _addCachePrefix (cache) {
    return `${this.getCachePrefix()}/${cache}`
  }

  _addBranchPrefix (branch) {
    return `${this.getBranchPrefix()}/${branch}`
  }

  _snapshot (identifier, target) {
    return `${target}@${identifier}`
  }

  _branch (identifier, target) {
    return `${target}/${identifier}`
  }

  getCachePrefix () {
    return `${this.pool}/caches`
  }

  getBranchPrefix () {
    return `${this.pool}/branches`
  }

  async list (opts = {}) {
    let args = ''
    if (opts.snapshot) {
      args += `-t snapshot `
    }
    if (opts.recurse) {
      args += `-r ${opts.recurse} `
    }
    console.log('executeInShell')
    console.log(args)
    const list = await executeInShell(`${this.zfsPath} list ${args}`)
    console.log('done')
    return parseTabSeperatedTable(list)
  }

  async _exists (cache) {
    const table = await this.list()
    return _.find(table, (row) => {
      // First row item is the name
      return row[0] === cache
    })
  }

  async existsCache (cache) {
    return this._exists(this._addCachePrefix(cache))
  }

  async existsBranch (cache, opts) {
    const {
      branchIdentifier
    } = opts

    return this._exists(this._branch(branchIdentifier, cache))
  }

  async createCache (cache) {
    const fullName = this._addCachePrefix(cache)
    await executeInShell(`${this.zfsPath} create -p ${fullName}`)
    return fullName
  }

  async createSnapshot (snapshotName, identifier) {
    const snapshot = this._snapshot(identifier, snapshotName)
    await executeInShell(`${this.zfsPath} snapshot ${snapshot}`)
    return snapshot
  }

  async createBranch (snapshot, branchName, identifier) {
    const branch = this._branch(identifier, branchName)
    // const branchRoot = await this._exists(this._addBranchPrefix(cache))
    // if (_.isUndefined(branchRoot)) {
    //   await executeInShell(`${this.zfsPath} create -p ${this._addBranchPrefix(cache)}`)
    // }
    await executeInShell(`${this.zfsPath} clone ${snapshot} ${branch}`)
    return branch
  }

  async destroyCache (cache) {
    await executeInShell(`${this.zfsPath} destroy ${this._addCachePrefix(cache)}`)
  }

  async shareNFS (cache, opts) {
    const {
      branchIdentifier
    } = opts

    const branch = this._branch(branchIdentifier, cache)
    await executeInShell(`${this.zfsPath} set sharenfs=on ${branch}`)
  }

  async promoteBranch (cache, opts) {
    const {
      branchIdentifier
    } = opts

    const branch = this._branch(branchIdentifier, cache)
    const cacheID = this._addCachePrefix(cache)
    await executeInShell(`${this.zfsPath} promote ${branch}`)
    await executeInShell(`${this.zfsPath} destroy ${cacheID}`)
    return executeInShell(`${this.zfsPath} rename ${branch} ${cacheID}`)
  }
}

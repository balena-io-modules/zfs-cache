const server = require('./src/server.js')

server.start({
  port: 3000,
  pool: 'tank'
})

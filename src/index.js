const express = require('express')
const path = require('path')
const cors = require('cors')
const server = require('./server')

const app = express()

app.use(cors())
app.use('/static/image', express.static(path.resolve(__dirname, '..', 'files')))
server.applyMiddleware({ app })

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`)
})

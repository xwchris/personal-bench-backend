const { ApolloServer, gql } = require('apollo-server-express')
const dayjs = require('dayjs')
const fs = require('fs')
const crypto = require('crypto')
const path = require('path')
const GithubClient = require('./github')
const DB = require('./db')
const authenticated = require('./auth-helpers').authenticated
const config = require('../config')

const HEADER_NAME = 'authorization'

const typeDefs = gql`
  # Article def
  type Article {
    id: ID!,
    issueId: ID,
    title: String!,
    abstract: String,
    content: String!,
    view_count: Int!,
    create_time: String!,
    cover: String!
  }

  type Essay {
    id: ID!,
    content: String!,
    create_time: String!
  }

  type Project {
    id: ID!,
    html_url: String!,
    name: String!,
    full_name: String,
    description: String,
    forks_count: Int!,
    stargazers_count: Int!,
    language: String
  }

  type Issue {
    id: ID!,
    number: Int!,
    title: String!,
    body: String,
    state: String!
  }

  type Photo {
    id: ID!,
    fileId: ID,
    url: String,
    description: String!,
    shooting_time: String!,
    shooting_place: String!,
  }

  type File {
    id: ID,
    filename: String!,
    mimetype: String!,
    encoding: String!,
    create_time: String,
  }

  type TimelineDateItem {
    id: ID!,
    type: String!,
    text: String!,
    url: String,
  }

  type TimelineDate {
    date: String!,
    data: [TimelineDateItem]!
  }

  type TimelineMonth {
    month: String!,
    data: [TimelineDate]!
  }

  type Token {
    id: ID!,
    token: String!,
    create_time: String
  }

  type UploadResult {
    files: [File!]!,
  }

  type Query {
    article(id: ID): Article,
    articles: [Article],
    essays: [Essay],
    projects: [Project]
    issues: [Issue]
    photos: [Photo],
    timelines: [TimelineMonth],
    tokens: [Token],
    token: String,
    files: [File],
  }

  type Mutation {
    createArticle(
      title: String!,
      issueId: ID,
      abstract: String,
      content: String!,
      cover: String!
    ): Boolean,
    deleteArticle(id: ID!): Boolean,
    updateArticle(
      id: ID!,
      issueId: ID,
      title: String!,
      abstract: String,
      content: String!,
      cover: String!
    ): Boolean
    createEssay(
      content: String!
    ): Boolean,
    deleteEssay(
      id: ID!
    ): Boolean,
    updateEssay(
      id: ID!,
      content: String!
    ): Boolean,
    deleteToken(id: ID!): Boolean,
    generateToken: Boolean,
    uploadFiles(files: [Upload!]!): UploadResult,
    createPhoto(
      fileId: ID!,
      description: String!,
      shooting_time: String!,
      shooting_place: String!,
    ): Boolean,
    updatePhoto(
      id: ID!,
      fileId: ID!,
      description: String!,
      shooting_time: String!,
      shooting_place: String!,
    ): Boolean,
    deletePhoto(
      id: ID!
    ): Boolean,
    createIssue(
      title: String!,
      body: String
    ): Boolean,
    updateIssue(
      id: ID!,
      title: String!,
      body: String,
      state: String
    ): Boolean
  }
`;

const db = new DB()
// 目前只展示2020的数据
const YEAR = '2020'

const queryFromGithub = ({ method = 'GET', path = '', data = {} }) => {
  return db.queryGithubs().then(result => new GithubClient({
    baseURL: 'https://api.github.com',
    token: result[0].token || ''
  })).then(githubClient => githubClient.callGithubAPI({
    path,
    data,
    method
  }))
}

const updateIssue = (args) => queryFromGithub({
  method: 'PATCH',
  path: `/repos/${config.github.username}/${config.github.blogRepoName}/issues/${args.id}`,
  data: { title: args.title || '', body: args.body || '', state: args.state || 'open' }
}).then(data => !!data)

const createIssue = (args) => queryFromGithub({
  method: 'POST',
  path: `/repos/${config.github.username}/${config.github.blogRepoName}/issues`,
  data: { ...args }
})

const resolvers = {
  Query: {
    article: (root, args) => db.queryArticleById(args.id),
    articles: () => db.queryArticles(),
    essays: () => db.queryEssays(),
    projects: () => queryFromGithub({
      path: '/user/repos',
      data: {
        visibility: 'public',
        affiliation: 'owner',
        sort: 'pushed'
      }
    }),
    photos: () => db.queryPhotos()
      .then(photos => photos.map(photo => ({ ...photo, shooting_time: dayjs(photo.shooting_time).format('YYYY/MM/DD')}))),
    files: authenticated((root, args) => db.queryFiles(args)),
    issues: () => queryFromGithub({
      path: `/repos/${config.github.username}/${config.github.blogRepoName}/issues`,
      data: {
        sort: 'updated'
      }
    }),
    timelines: async () => {
      const [articles, essays] = await Promise.all([db.queryArticles(), db.queryEssays()])
      let data = {}

      const parseAndDealItem = (item, resolver) => {
        const time = dayjs(item.create_time).format('YYYY MM DD')
        const [year, month, date] = time.split(' ')

        let yearData = data[year] || {}
        let monthData = yearData[month] || {}
        let dateData = monthData[date] || []

        dateData.push(resolver(item))

        monthData[date] = dateData
        yearData[month] = monthData
        data[year] = yearData
      }

      articles.forEach(item => parseAndDealItem(item, (current) => ({
        id: current.id,
        type: 'article',
        text: current.title,
        url: `/article/${current.id}`
      })))
      essays.forEach(item => parseAndDealItem(item, (current) => ({
        id: current.id,
        type: 'essay',
        text: current.content,
        url: ``
      })))

      const sortDecrease = (a, b) => +b - +a
      const result = Object.keys(data[YEAR]).sort(sortDecrease).map(monthKey => ({
        month: monthKey,
        data: Object.keys(data[YEAR][monthKey]).sort(sortDecrease).map(dateKey => ({ date: dateKey, data: data[YEAR][monthKey][dateKey] }))
      }))

      return result;
    },
    tokens: authenticated(() => db.queryTokens()),
    token: authenticated((root, args, context) => context.token)
  },
  Mutation: {
    createArticle: authenticated((root, args) => {
      return createIssue({
        title: args.title || '',
        body: args.content || ''
      }).then(result => db.insertArticle({ ...args, issueId: result.number })).catch(() => {
        return false
      })
    }),
    updateArticle: authenticated((root, args) => {
      if (args.issueId) {
        return updateIssue({
          id: args.issueId,
          title: args.title || '',
          body: args.content || '',
        }).then(() => db.updateArticle(args)).catch((err) => false)
      }

      return db.updateArticle(args)
    }),
    deleteArticle: authenticated((root, args) => {
      return db.queryArticleById(args.id).then(result => {
        if (result.issueId) {
          return updateIssue({
            id: result.issueId,
            title: result.title,
            body: result.content,
            state: 'closed'
          }).then(() => db.deleteArticle(args))
        }

        return db.deleteArticle(args)
      }).catch(() => false)
    }),
    createEssay: authenticated((root, args) => db.insertEssay(args)),
    updateEssay: authenticated((root, args) => db.updateEssay(args)),
    deleteEssay: authenticated((root, args) => db.deleteEssay(args)),
    generateToken: authenticated(() => db.generateToken()),
    deleteToken: authenticated((root, args) => db.deleteToken(args)),
    createPhoto: authenticated((root, args) => db.insertPhoto({ ...args, shooting_time: new Date(args.shooting_time).getTime() })),
    updatePhoto: authenticated((root, args) => db.updatePhoto({ ...args, shooting_time: new Date(args.shooting_time).getTime() })),
    deletePhoto: authenticated((root, args) => db.deletePhoto(args)),
    createIssue: authenticated((root, args) => createIssue(args)),
    updateIssue: authenticated((root, args) => updateIssue(args)),
    async uploadFiles(parent, args) {
      const { files } = args
      const fileWrite = ({ filename, mimetype, encoding, createReadStream }) => new Promise((resolve, reject) => {
        const tempFileName = new Buffer(Date.now() + filename + Math.random()).toString('base64')
        const filePath = path.resolve(__dirname, '..', config.fileSaveDir, tempFileName)
        const dirPath = path.dirname(filePath)
        if (mimetype.indexOf('image') === -1) {
          reject(new Error(`the file type is not image, it's mimetype is ${mimetype}`))
        }

        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true })
        }

        const hash = crypto.createHash('sha256')
        const input = createReadStream()
        const writable = fs.createWriteStream(filePath)

        input.on('data', chunk => {
          hash.update(chunk)
          writable.write(chunk)
        })

        input.on('end', () => {
          const hashName = hash.digest('hex')
          const suffix = '.' + mimetype.replace('image/', '')
          const targetFilename = hashName + suffix
          const newFilePath = path.resolve(__dirname, '..', config.fileSaveDir, targetFilename)
          if (fs.existsSync(newFilePath)) {
            fs.unlinkSync(newFilePath)
          }
          fs.rename(filePath, newFilePath, (err) => {
            reject(err)
          })

          resolve({ filename: targetFilename, mimetype, encoding })
        })
      })

      const result = await Promise.all(files.map(file => file.then(fileWrite)))
      await db.insertFiles(result)

      return { files: result }
    }
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    let authToken = ''
    let isValidToken = false

    try {
      authToken = req.headers[HEADER_NAME]

      if (authToken) {
        isValidToken = await db.verifyToken(authToken)
      }
    } catch(e) {
      console.warn(`Unable to authenticate using auth token: ${authToken}`)
    }

    return {
      isValidToken,
      token: authToken
    }
  }
})

module.exports = server

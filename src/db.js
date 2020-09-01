
const MongoClient = require('mongodb').MongoClient
const ObjectId = require('mongodb').ObjectId
const crypto = require('crypto-js')
const day = require('dayjs')
const dbConfig = require('../config').db
const mongoURL = composeMongoURL()

const DB_NAME = dbConfig.dbname// 数据库名称
const ARTICLE = 'article' // collection 文章
const ESSAY = 'essay' // collection 随笔
const PHOTO = 'photo' // collection 照片
const TOKEN = 'token'
const GITHUB = 'github'
const FILE = 'file'

function composeMongoURL() {
  const isProduction = process.env.NODE_ENV === 'production'
  const authStr = `${dbConfig.username}:${dbConfig.password}@`
  return `mongodb://${isProduction ? authStr : ''}${dbConfig.host}:${dbConfig.port}`
}

function formateDate(_id) {
  return day(_id.getTimestamp()).format('YYYY/MM/DD')
}

function DB() {
  this.dbo = {}

  MongoClient.connect(mongoURL, (err, db) => {
    if (err) {
      console.log('mongodb connect failed!', err.message)
    } else {
      console.log('mongodb connected now!')
      this.dbo = db.db(DB_NAME)
    }
  })
}

const queryList = (key, resolver) => function() {
  const dbo = this.dbo

  return new Promise((resolve, reject) => {
    dbo.collection(key).find({}).sort({ create_time: -1 }).toArray((err, result) => {
      if (err) reject(err)
      let list = result.map((item) => ({ ...item, id: item._id, create_time: formateDate(item._id) }))
      if (typeof resolver === 'function') {
        list = list.map(resolver)
      }
      resolve(list)
    })
  })
}

const queryItemById = (key) => function(id) {
  const dbo = this.dbo

  return new Promise((resolve, reject) => {
    dbo.collection(key).findOne({ _id: ObjectId(id) }, (err, result) => {
      if (err) reject(err)
      if (result !== null) {
        const item = { ...result, id: result._id, create_time: formateDate(result._id)}
        resolve(item)
      } else {
        resolve(null)
      }
    })
  })
}

const insertItem = (key) => function(item) {
  const dbo = this.dbo

  return new Promise((resolve, reject) => {
    dbo.collection(key).insertOne({ ...item, create_time: Date.now() }, (err, obj) => {
      if (err) reject(err)
      resolve(obj.result.ok === 1)
    })
  })
}

const insertManyItem = (key) => function(item) {
  const dbo = this.dbo

  return new Promise((resolve, reject) => {
    dbo.collection(key).insertMany(item.map(item => ({ ...item, create_time: Date.now() })), (err, obj) => {
      if (err) reject(err)
      resolve(obj.result.ok === 1)
    })
  })
}

const deleteItem = (key) => function(item) {
  const dbo = this.dbo

  return new Promise((resolve, reject) => {
    dbo.collection(key).deleteOne({ _id: ObjectId(item.id) }, (err, obj) => {
      if (err) reject(err)
      resolve(obj.result.ok === 1)
    })
  })
}

const updateItem = (key) => function(item) {
  const dbo = this.dbo

  return new Promise((resolve, reject) => {
    const newValue = {
      ...item,
    }

    delete newValue.id

    dbo.collection(key).updateOne({ _id: ObjectId(item.id) }, { $set: newValue }, (err, obj) => {
      if (err) reject(err)
      resolve(obj.result.ok === 1)
    })
  })
}

DB.prototype.queryArticles = queryList(ARTICLE)
DB.prototype.queryArticleById = queryItemById(ARTICLE)
DB.prototype.deleteArticle = deleteItem(ARTICLE)
DB.prototype.insertArticle = insertItem(ARTICLE)
DB.prototype.updateArticle = updateItem(ARTICLE)
DB.prototype.deleteEssay = deleteItem(ESSAY)
DB.prototype.insertEssay = insertItem(ESSAY)
DB.prototype.updateEssay = updateItem(ESSAY)
DB.prototype.queryEssays = queryList(ESSAY)
DB.prototype.queryPhotos = queryList(PHOTO)
DB.prototype.insertPhoto = insertItem(PHOTO)
DB.prototype.updatePhoto = updateItem(PHOTO)
DB.prototype.deletePhoto = deleteItem(PHOTO)
DB.prototype.queryFiles = queryList(FILE)
DB.prototype.insertFiles = insertManyItem(FILE)
DB.prototype.deleteFile = deleteItem(FILE)
DB.prototype.queryTokens = queryList(TOKEN)
DB.prototype.deleteToken = deleteItem(TOKEN)
DB.prototype.queryGithubs = queryList(GITHUB)
DB.prototype.verifyToken = function(token) {
  const dbo = this.dbo
  const targetToken = token.replace('Bearer ', '')

  return new Promise((resolve, reject) => {
    dbo.collection(TOKEN).findOne({ token: targetToken }, (err, result) => {
      if (err) reject(err)
      if (result !== null) {
        resolve(true)
      } else {
        resolve(false)
      }
    })
  })
}
DB.prototype.generateToken = function() {
  const dbo = this.dbo

  return new Promise((resolve, reject) => {
    const create_time = Date.now()
    const token = crypto.enc.Base64.stringify(crypto.MD5(`token generate time in ${create_time}`))
    dbo.collection(TOKEN).insertOne({ token, create_time, role: 'admin' }, (err, obj) => {
      if (err) reject(err)
      resolve(obj.result.ok === 1)
    })
  })
}
DB

module.exports = DB

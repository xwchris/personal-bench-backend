const { NODE_ENV, MONGO_INITDB_DATABASE, MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD } = process.env

module.exports = {
  // 文件保存目录
  fileSaveDir: './files',
  db: {
    host: NODE_ENV === 'production' ? 'mongo' : 'localhost',
    port: '27017',
    dbname: MONGO_INITDB_DATABASE || 'bench',
    username: MONGO_INITDB_ROOT_USERNAME,
    password: MONGO_INITDB_ROOT_PASSWORD
  },
  github: {
    username: 'xwchris',
    blogRepoName: 'blog'
  }
}

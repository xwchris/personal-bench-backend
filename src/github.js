const axios = require('axios')

function GithubClient({ baseURL, token }) {
  this.credentials = token !== null && token.length > 0 ? `token ${token}` : null
  this.headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github.v3.full+json',
    'Authorization': this.credentials
  }

  this.requestInstance = axios.create({
    baseURL,
    // timeout: 1000,
    headers: this.headers
  })
}

GithubClient.prototype.callGithubAPI = function({ method = 'GET', path = '', data = {} }) {
  const isGetMethod = typeof method.toUpperCase() === 'GET'
  const params = isGetMethod ? { query: data } : { data }

  const response = this.requestInstance.request({
    method,
    url: path,
    ...params
  }).then(res => res.data)

  return response
}

module.exports = GithubClient

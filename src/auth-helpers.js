const authenticated = next => (root, args, context, info) => {
  if (!context.isValidToken) {
    throw new Error(`Unauthenticated!`)
  }

  return next(root, args, context, info)
}

module.exports = {
  authenticated
}

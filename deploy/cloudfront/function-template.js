async function handler(event) {
  return {
    statusCode: 200,
    statusDescription: 'OK',
    headers: {
      'content-type': { value: '__TYPE__' },
      'content-encoding': { value: 'gzip' },
      'cache-control': { value: 'public, max-age=300' },
    },
    body: { encoding: 'base64', data: '__DATA__' },
  };
}

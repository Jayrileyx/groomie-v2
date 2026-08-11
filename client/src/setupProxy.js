const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  const proxy = { target: 'http://localhost:5001', changeOrigin: true };
  app.use('/api', createProxyMiddleware(proxy));
  app.use('/uploads', createProxyMiddleware(proxy));
};

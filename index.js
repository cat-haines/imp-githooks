var http = require('http');

http.createServer(function (req, res) {
  console.log(req);

  res.statusCode = 200;
  res.end('OK');
}).listen(5000);

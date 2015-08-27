var http = require("http");
var require = require("request");
var createHandler = require("github-webhook-handler");
var handler = createHandler({ path: "/webhook", secret: "myhashsecret" });

http.createServer(function (req, res) {
  handler(req, res, function (err) {
    res.statusCode = 404;
    res.end("no such location");
  });
}).listen(process.env.PORT);

handler.on("push", function (event) {
  // Grab the information we need
  var repo = event.payload.repository.full_name;;
  var isPrivate = event.payload.repository.private;

  var ref = event.payload.ref;
  var sha = event.payload.after;

  // Ignore private repos and branches other than master for now
  if (isPrivate || ref != "/refs/head/master") return;

  var configUrl = "https://raw.githubusercontent.com/" + repo + "/master/.impconfig";
  request(configUrl, function(err, resp, body) {
    // If .impconfig isn't present, there isn't anything we can do.

    if (resp.statusCode != 200) return;

    console.log(body);
  });
});

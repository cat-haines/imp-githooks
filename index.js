var http = require("http");
var request = require("request");
var createHandler = require("github-webhook-handler");

// Grab the config data
var buildApiKey = process.env.BUILD_API_KEY;      // heroku config:set BUILD_API_KEY=apiKey
var gitPushSecret = process.env.GIT_PUSH_SECRET;  // heroku config:set GIT_PUSH_SECRET=secret
var gitUser = process.env.GIT_USER;               //heroku config:set GIT_USER=username
var gitToken = process.env.GIT_TOKEN;             // heroku config:set GIT_TOKEN=token

// Instantiate the imp object
var Imp = require("imp-api");
var imp = new Imp({ apiKey: buildApiKey });

// Instantiate the GitHook server
var handler = createHandler({ path: "/webhook", secret: gitPushSecret });

http.createServer(function (req, res) {
  handler(req, res, function (err) {
    res.statusCode = 404;
    res.end("no such location");
  });
}).listen(process.env.PORT);

// Specify the push functionality
handler.on("push", function (event) {
  // Grab the information we need
  var repo = event.payload.repository.full_name;;
  var isPrivate = event.payload.repository.private;

  var ref = event.payload.ref;
  var sha = event.payload.after;

  // Ignore private repos and branches other than master for now
  if(isPrivate || ref !== "refs/heads/master") return;

  var configUrl = "https://raw.githubusercontent.com/" + repo + "/master/.impconfig";

  request({
    url: configUrl,
    auth: {
      "user": gitUser,
      "pass": gitToken,
      "sendImmediately": true
    }
  }, function(err, resp, impconfigFile) {
    // If .impconfig isn't present, there isn't anything we can do.
    if(resp.statusCode != 200) {
      console.log("Couldn't find .impconfig in root level of repository");
      return;
    }

    // Parse the body..
    var impconfig = JSON.parse(impconfigFile);

    if (!impconfig.modelId || !impconfig.deviceFile || !impconfig.agentFile) {
      console.log("Invalid .impconfig - ensure modelId, deviceFile, and agentFile are present");
      return;
    }

    // Fetch the code
    var deviceFileUrl = "https://raw.githubusercontent.com/" + repo + "/master/" + impconfig.deviceFile;
    var agentFileUrl = "https://raw.githubusercontent.com/" + repo + "/master/" + impconfig.agentFile;

    request({
      url: deviceFileUrl,
      auth: {
        "user": gitUser,
        "pass": gitToken,
        "sendImmediately": true
      }
    }, function(deviceErr, deviceResp, deviceCode) {
      if (deviceResp.statusCode != 200) {
        console.log("Error fetching device file: " + impconfig.deviceFile);
        return;
      }

      request({
        url: deviceFileUrl,
        auth: {
          "user": gitUser,
          "pass": gitToken,
          "sendImmediately": true
        }
      }, function(agentErr, agentResp, agentCode) {
        if (agentResp.statusCode != 200) {
          console.log("Error fetching agent file: " + impconfig.agentFile);
          return;
        }

        var model = {
          device_code: deviceCode,
          agent_code: agentCode
        };

        imp.createModelRevision(impconfig.modelId, model, function(revisionErr, revisionData) {
          if (revisionErr) {
            if (revisionErr.code != "CompileFailed") {
              console.log("ERROR: " + revisionErr.message_short);
              return;
            }

            if (revisionErr.details.agent_errors) {
              for(var i = 0; i < revisionErr.details.agent_errors.length; i ++) {
                var thisErr = revisionErr.details.agent_errors[i];
                console.log("ERROR: " + thisErr.error);
                console.log("   at: " + impconfig.agentFile +":" + thisErr.row + " (col "+thisErr.column+")");
              }
            }

            if (revisionErr.details.device_errors) {
              for(var i = 0; i < revisionErr.details.device_errors.length; i ++) {
                var thisErr = revisionErr.details.device_errors[i];
                console.log("ERROR: " + thisErr.error);
                console.log("   at: " + impconfig.deviceFile +":" + thisErr.row + " (col "+thisErr.column+")");
              }
            }

            return;
          }

          imp.restartModel(impconfig.modelId, function(restartErr, restartData) {
            if (restartErr) {
              console.log("Warning: Could not restart model");
            }

            console.log("Successfully created revision " + revisionData.revision.version);
          });
        });
      });
    });
  });
});

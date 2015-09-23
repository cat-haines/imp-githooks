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

function githubRequest(url, callback) {
  request({
    url: url,
    auth: {
      "user": gitUser,
      "pass": gitToken,
      "sendImmediately": true
    }
  }, function(err, resp, data) {
    if (resp.statusCode != 200) {
      console.log("Error retreiving " + url);
      return;
    }

    callback(err, resp, data);
  });
}

// Specify the push functionality
handler.on("push", function (event) {
  // Grab the information we need
  var repo = event.payload.repository.full_name;;

  var ref = event.payload.ref;
  var sha = event.payload.after;

  // Ignore private repos and branches other than master for now
  if(ref !== "refs/heads/master") return;

  var configUrl = "https://raw.githubusercontent.com/" + repo + "/master/.impconfig";
  console.log(configUrl);
  githubRequest(configUrl, function(err, resp, impconfigFile) {
    // Parse the body..
    var impconfig = JSON.parse(impconfigFile);

    if (!impconfig.modelId || !impconfig.deviceFile || !impconfig.agentFile) {
      console.log("Invalid .impconfig - ensure modelId, deviceFile, and agentFile are present");
      return;
    }

    // Build the URLs to fetch the files
    var deviceFileUrl = "https://raw.githubusercontent.com/" + repo + "/master/" + impconfig.deviceFile;
    var agentFileUrl = "https://raw.githubusercontent.com/" + repo + "/master/" + impconfig.agentFile;

    console.log(deviceFileUrl);
    console.log(agentFileUrl);

    // Fetch the agent and device code:
    githubRequest(deviceFileUrl, function(deviceErr, deviceResp, deviceCode) {
      githubRequest(agentFileUrl, function(agentErr, agentResp, agentCode) {
        // Build the model object
        var model = {
          device_code: deviceCode,
          agent_code: agentCode
        };

        console.log(model);

        // Make a new revision
        imp.createModelRevision(impconfig.modelId, model, function(revisionErr, revisionData) {
          if (revisionErr) {
            if (revisionErr.code != "CompileFailed") {
              console.log("ERROR: " + revisionErr.message_short);
              return;
            }

            // Log errors (if they exist)
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

          // Restart the model so code runs on all the devices
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



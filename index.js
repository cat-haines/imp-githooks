var http = require("http");
var request = require("request");
var createHandler = require("github-webhook-handler");
var handler = createHandler({ path: "/webhook", secret: "myhashsecret" });

// Set BUILD_API_KEY with: `heroku config:set BUILD_API_KEY=YourApiKey`
var Imp = require("imp-api");
var imp = new Imp({ apiKey: process.env.BUILD_API_KEY });

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
  if(isPrivate || ref !== "refs/heads/master") return;

  var configUrl = "https://raw.githubusercontent.com/" + repo + "/master/.impconfig";

  request(configUrl, function(err, resp, impconfigFile) {
    // If .impconfig isn't present, there isn't anything we can do.
    if(resp.statusCode != 200) {
      console.log("Couldn't find .impconfig in root level of repository");
      return;
    }

    // Parse the body..
    var impconfig = JSON.parse(impconfigFile);

    // Make sure have the required data
    console.log(impconfig.modelId);
    console.log(impconfig.deviceFile);
    console.log(impconfig.agentFile);

    if (!impconfig.modelId || !impconfig.deviceFile || !impconfig.agentFile) {
      console.log("Invalid .impconfig - ensure modelId, deviceFile, and agentFile are present");
      return;
    }

    // Fetch the code
    var deviceFileUrl = "https://raw.githubusercontent.com/" + repo + "/master/" + impconfig.deviceFile;
    var agentFileUrl = "https://raw.githubusercontent.com/" + repo + "/master/" + impconfig.agentFile;

    request(deviceFileUrl, function(deviceErr, deviceResp, deviceCode) {
      if (deviceResp.statusCode != 200) {
        console.log("Error fetching device file: " + impconfig.deviceFile);
        return;
      }

      request(agentFileUrl, function(agentErr, agentResp, agentCode) {
        if (agentResp.statusCode != 200) {
          console.log("Error fetching agent file: " + impconfig.agentFile);
          return;
        }

        var model = {
          device_code: deviceCode,
          agent_code: agentCode
        };

        imp.createModelRevision(impconfig.modelId, model, function(err, data) {
          if (err) {
            if (err.code != "CompileFailed") {
              console.log("ERROR: " + err.message_short);
              return;
            }

            if (err.details.agent_errors) {
              for(var i = 0; i < err.details.agent_errors.length; i ++) {
                var thisErr = err.details.agent_errors[i];
                console.log("ERROR: " + thisErr.error);
                console.log("   at: " + impconfig.agentFile +":" + thisErr.row + " (col "+thisErr.column+")");
              }
            }

            if (err.details.device_errors) {
              for(var i = 0; i < err.details.device_errors.length; i ++) {
                var thisErr = err.details.device_errors[i];
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
            consle.log(restartData);
            // console.log("Successfully created revision " + restartData.revision.version);
          });
        });
      });
    });
  });
});

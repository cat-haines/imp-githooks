# imp-githooks

The imp-githooks project is an incredibly simple webserver designed to be used with [GitHub's Webhooks](https://developer.github.com/webhooks/) to deploy code to your Electric Imp devices whenever you push changes to the master branch of a tracked repository.

## Installation

This installation guide will demonstrate how to setup and configure this project on a free [Heroku](heroku.com) instance. Before getting started you will need to ensure you have done the following:

- Installed [Node.js and npm](https://docs.npmjs.com/getting-started/installing-node)
- Created a [Heroku account](https://signup.heroku.com/login)
- Installed the [Heroku Toolbelt](https://toolbelt.heroku.com/)
- Installed the [imp-cli](https://github.com/matt-haines/imp-cli#installation)
- Copied your [Build API key](https://electricimp.com/docs/buildapi/keys/)
  - **Note**: We recommend you create a separate Build API key for use with imp-githooks.

### Clone the imp-githooks repository

```bash
$ git clone git@github.com:matt-haines/imp-githooks.git
$ cd imp-webhooks
```

### Create and configure the Heroku app

```
$ heroku create
$ git push heroku master
$ heroku ps:scale web=1
$ heroku config:set BUILD_API_KEY=BuildApiKey
```

When you run the `heroku create` command, it should return with the URL of your app (in the example below it is https://damp-inlet-8875.herokuapp.com/):

```
→ heroku create
Creating damp-inlet-8875... done, stack is cedar-14
https://damp-inlet-8875.herokuapp.com/ | https://git.heroku.com/damp-inlet-8875.git
Git remote heroku added
```

### Setup a Webhook in GitHub



# License

The imp-githooks project is licensed under the [MIT License](./LICENSE).

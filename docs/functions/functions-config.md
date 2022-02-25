# Firebase Environment Configuration (Secrets) 

See [Environment configuration](https://firebase.google.com/docs/functions/config-env) and [Firebase CLI](https://firebase.google.com/docs/cli)

## How to set
- `firebase login` with a user that has access to the desired Firebase project
- If not already on the desired project run `firebase use default` for dev or `firebase use production` for prod. The project options are specified in the `.firebasesrc` file in the project root.
- Read current config with `firebase functions:config:get`
- Set environment variable / secret by running `firebase functions:config:set algolia.app="..."`
- You can read config again if you'd like to verify success
- Set up the config on dev first and then when happy, switch over to production and save the new config variables there as well.
- Next time you deploy functions, the config will be updated on Firebase's servers on a project by project basis.
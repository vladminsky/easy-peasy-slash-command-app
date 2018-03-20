# bro-bot
Your silicon bro.

#### Dev steps
1. npm install
2. npm install -g localtunnel
3. lt --port 8765 --subdomain brobot
4. Go to https://api.slack.com/applications/new
5. Add redirect url (https://brobot.localtunnel.me/oauth)
6. Setup bot settings in slack
7. Run bot locally:
   ```
   CLIENT_ID=xxx.yyy CLIENT_SECRET=abc VERIFICATION_TOKEN=123 PORT=8765 npm start
   ```
7. Visit https://brobot.localtunnel.me/login to install your bot on a team


#### Setup bot settings
- OAuth and Permissions / Add new redirect URL
    - https://brobot.localtunnel.me/oauth
- OAuth and Permissions / Install app to workspace
- Add request url to interactive components
    - url = https://brobot.localtunnel.me/slack/receive
- Slash commands / create new command
    - command = bro
    - req.url = https://brobot.localtunnel.me/slack/receive
- Event subscriptions / Enable events
    - req.url = https://brobot.localtunnel.me/slack/receive
    - subscribe to bot events = message.* (channels, groups, im, mpim)
    - Click [Save Changes]

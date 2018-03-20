const fetch = require('node-fetch');
const moment = require('moment');
const Botkit = require('botkit');
const BotkitStorage = require('botkit-storage-mongo');
const _bots = {};
const _trackBot = (bot) => _bots[bot.config.token] = bot;
const die = (err) => {
    console.log(err);
    process.exit(1);
};


const clientid = process.env.CLIENT_ID;
const clientsecret = process.env.CLIENT_SECRET;
const port = process.env.PORT;
const verificationtoken = process.env.VERIFICATION_TOKEN;
const mongolaburi = process.env.MONGOLAB_URI;
const FIBERYSERVER = 'http://localhost:9001';

if (!clientid || !clientsecret || !port || !verificationtoken) {
    console.log('Error: Specify CLIENT_ID, CLIENT_SECRET, VERIFICATION_TOKEN and PORT in environment');
    process.exit(1);
}

const debug = false;
const config = (mongolaburi
    ? {storage: BotkitStorage({mongoUri: mongolaburi}), debug}
    : {json_file_store: './db_slackbutton_slash_command/', debug});

const controller = Botkit.slackbot(config).configureSlackApp({
    clientId: clientid,
    clientSecret: clientsecret,
    scopes: ['bot', 'commands'],
});

controller.setupWebserver(port, (err, webserver) => {
    controller.createHomepageEndpoint(controller.webserver);
    controller.createWebhookEndpoints(controller.webserver);
    controller.createOauthEndpoints(controller.webserver, (err, req, res) => {
        if (err) {
            res.status(500).send('ERROR: ' + err);
        } else {
            res.send('Success!');
        }
    });
});

controller.on('rtm_open', function (bot) {
    console.log('** The RTM api just connected!');
});

controller.on('rtm_close', function (bot) {
    console.log('** The RTM api just closed');
    // you may want to attempt to re-open
});

// controller.on('create_bot', (bot, config) => {
//     console.log('create_bot', bot.config.token);
//     if (_bots[bot.config.token]) {
//         // already online! do nothing.
//         return;
//     }
//
//     bot.startRTM((err) => {
//         if (err) {
//             die(err);
//         }
//
//         _trackBot(bot);
//     });
// });
//
// controller.storage.teams.all((err, teams) => {
//     if (err) {
//         throw new Error(err);
//     }
//
//     // connect all teams with bots up to slack!
//     for (let t in teams) {
//         if (teams[t].bot) {
//             const bot = controller.spawn(teams[t]).startRTM((err) => {
//                 if (err) {
//                     console.log('Error connecting bot to Slack:', err);
//                 } else {
//                     _trackBot(bot);
//                 }
//             });
//         }
//     }
// });
//
// // message handling goes here
//
// controller.hears(
//     ["hello", "hi", "greetings", "0"],
//     ["direct_mention", "mention", "direct_message", "ambient"],
//     (bot, message) => {
//         bot.reply(message, "Hello dude!");
//     }
// );

const normalizeType = (type) => {
    return [].concat(type).reduce(
        (memo, token) => {
            if (token === 'cancel') {
                memo.action = token;
            } else if (token === 'half') {
                memo.fraction = token;
            } else {
                memo.type = token;
            }
            return memo;
        },
        {
            action: 'add',
            fraction: 'full',
            type: 'dayoff',
        });
};

const confirmMessage = ({type, start, end}) => {
    const s = start.split('T')[0];
    const e = end.split('T')[0];
    const fullMsg = normalizeType(type);
    const fmt = (s.substr(0, 4) === e.substr(0, 4)) ? 'MMM Do' : 'MMM Do YY';
    const msgDates = ((s === e)
        ? `on ${moment(start).format(fmt)}`
        : `from ${moment(start).format(fmt)} till ${moment(end).format(fmt)}`);

    return [
        `Confirm if Bro got it right.`,
        `You ${((fullMsg.action === 'cancel') ? 'want to cancel' : 'plan')}`,
        `${((fullMsg.fraction === 'half') ? 'half' : '')}`,
        `${fullMsg.type}`,
        `${msgDates}`,
        `?`].filter(x => x !== '').join(' ');
};

const wellDoneMessage = ({type, start, end}) => {
    const s = start.split('T')[0];
    const e = end.split('T')[0];
    const fullMsg = normalizeType(type);
    const fmt = (s.substr(0, 4) === e.substr(0, 4)) ? 'MMM Do' : 'MMM Do YY';
    const msgDates = ((s === e)
        ? `on ${moment(start).format(fmt)}`
        : `from ${moment(start).format(fmt)} till ${moment(end).format(fmt)}`);

    return [
        `Bro just`,
        `${((fullMsg.action === 'cancel') ? 'cancelled' : 'planned')}`,
        `${((fullMsg.fraction === 'half') ? 'half' : '')}`,
        `${fullMsg.type}`,
        `for you`,
        `${msgDates}`,
        `!`].filter(x => x !== '').join(' ');
};

const appActions = {

    async request(body) {
        const parseResult = await fetch(
            `${FIBERYSERVER}/api/data/commands?`,
            {
                method: 'POST',
                body: JSON.stringify(body),
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json; charset=utf-8',
                    'x-auth-bypass-dont-release-this-or-you-will-be-fired': 'slackbot',
                },
            });

        const result = await parseResult.json();
        return result[0];
    },

    async parse({text, user}) {
        const ts = String((new Date().getTime() / 1000));
        const body = [{command: 'vacations/parse-command', args: {text, user, ts}}];
        return await appActions.request(body);
    },

    async exec({text, user}) {
        const ts = String((new Date().getTime() / 1000));
        const body = [{command: 'vacations/exec-command', args: {text, user, ts}}];
        return await appActions.request(body);
    }
};

const dispatch = (commandsHub) => (cmd, msg) => {

    if (msg.token !== verificationtoken) {
        return;
    }

    const {command, text} = msg;

    const specific = `${command} ${text}`;
    if (commandsHub.hasOwnProperty(specific)) {
        commandsHub[specific](cmd, msg);
        return;
    }

    if (commandsHub.hasOwnProperty(command)) {
        commandsHub[command](cmd, msg);
        return;
    }

    cmd.replyPrivate(msg, `I don't know how to ${command} yet.`);
};

controller.on('slash_command', dispatch({

    '/bro ': async (cmd, msg) => {
        cmd.replyPrivate(msg, '..m? Talk to Bro. Don\'t hesitate to ask for ```/bro help```');
    },

    '/bro help': async (cmd, msg) => {
        cmd.replyPrivate(msg, 'Share your plans with Bro. Like\n ```/bro i\'m sick today``` or ```/bro vacation 26-30 March```');
    },

    '/bro': async (cmd, msg) => {
        const {text, user} = msg;
        const {success, result} = await appActions.parse({user, text});
        if (!success) {
            cmd.replyPrivate(msg, 'Oh no! Looks like Bro in troubles, try again please...');
            return;
        }

        const type = result['cmd-type'];
        const args = result['cmd-args'];
        const start = args['start-date'];
        const end = args['end-date'];
        cmd.replyPrivate(msg, {
            attachments: [
                {
                    text: confirmMessage({type, start, end}),
                    callback_id: '123',
                    attachment_type: 'default',
                    actions: [
                        {
                            "name": "yes",
                            "text": "Yes",
                            "value": JSON.stringify({code: 1, data: {raw: text, user, type, start, end}}),
                            "type": "button",
                        },
                        {
                            "name": "no",
                            "text": "No",
                            "value": JSON.stringify({code: 0, data: {raw: text, user}}),
                            "type": "button",
                        }
                    ]
                }
            ]
        });

    }
}));

controller.on('interactive_message_callback', async (bot, message) => {
    const {actions} = message;
    const answer = JSON.parse(actions[0].value);
    const {code, data} = answer;

    if (code === 0) {
        bot.replyInteractive(message, 'Please retry so Bro could understand you clearly.');
        return;
    }

    if (code === 1) {
        const {raw: text, user} = data;
        const {success} = await appActions.exec({user, text});

        if (!success) {
            bot.replyInteractive(message, 'Error when interact with fibery. Please retry.');
            return;
        }

        const {type, start, end} = data;
        bot.replyInteractive(message, wellDoneMessage({type, start, end}));
    }
});

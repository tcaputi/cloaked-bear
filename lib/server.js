/*
Goals:
	Log in with Google
	Map users with an object (permanent or non permanent)
	Request user data
*/

var express = require("express");
var http = require('http');
var https = require('https');
var fs = require('fs');
var md5 = require('MD5');
var qs = require('querystring');
var request = require('request');
var MongoClient = require('mongodb').MongoClient;

var config = require('./config');

var DEBUG = config.debug;

var HOST = config.host;
var PORT = config.port;

var IS_PERSISTENT = config.isPersistent;
var MONGO_URL = config.mongoUrl;
var COLLECTION_NAME = config.collectionName;

var IS_SECURE = config.isSecure;
var SSL_KEY_PATH = config.sslKeyPath;
var SSL_CERTIFICATE_PATH = config.sslCertificatePath;

var SECRET_KEY = config.secretKey;
var GOOGLE_CLIENT_ID = config.googleClientId;
var GOOGLE_CLIENT_SECRET = config.googleClientSecret;
var REDIRECT_PATH = config.redirectPath;
var REDIRECT_URL = ((IS_SECURE) ? 'https://' : 'http://') + HOST + ':' + PORT + REDIRECT_PATH;
var GOOGLE_AUTH_URL = config.googleAuthUrl;
var GOOGLE_TOKEN_URL = config.googleTokenUrl;
var GOOGLE_INFO_REQUEST_URL = config.googleInfoRequestUrl;
var AUTH_PATH = config.authPath;
var AUTH_CALLBACK_PATH = config.authCallbackPath;
var AUTH_SUCCESS_PATH = config.authSuccessPath;

//express
var app = express();
app.use(express.cookieParser());
app.use(express.session({
	secret: SECRET_KEY,
	store: express.session.MemoryStore({
		reapInterval: 60000 * 10
	})
}));
app.use(express.json());
app.use(express.urlencoded());
if (DEBUG) {
	app.use(function(req, res, next) {
		console.log("CALL: " + req.url);
		next();
	});
}

/*----------------------------AUTH ROUTES------------------------------*/

app.get(AUTH_PATH, function(req, res) {
	if (!req.session.access_token) {
		req.session.state = md5((new Date()).getTime() + Math.floor((Math.random() * 100) + 1) + 'totallythestate');
		var authUrl = GOOGLE_AUTH_URL + '?' + qs.stringify({
			client_id: GOOGLE_CLIENT_ID,
			redirect_uri: REDIRECT_URL,
			response_type: 'code',
			scope: 'openid profile email',
			state: req.session.state
		});
		res.redirect(authUrl);
	} else {
		request(GOOGLE_INFO_REQUEST_URL + '?' + qs.stringify({
			access_token: req.session.access_token
		}), function(err, response, body) {
			if (err) res.send(400, err);
			var payload = JSON.parse(body);
			req.session.user = payload.email.split('@')[0];
			if (DEBUG) console.log(req.session.user + ' authed');
			saveUserData(req.session.user, {}, function(result) {
				res.redirect(AUTH_SUCCESS_PATH);
			});
		});
	}
});

app.get(AUTH_CALLBACK_PATH, function(req, res) {
	if (req.session.state !== req.param('state')) res.send(400, 'bad state');
	else {
		request({
			url: GOOGLE_TOKEN_URL,
			form: {
				client_id: GOOGLE_CLIENT_ID,
				client_secret: GOOGLE_CLIENT_SECRET,
				grant_type: 'authorization_code',
				redirect_uri: REDIRECT_URL,
				code: req.param('code')
			},
			method: 'POST'
		}, function(err, response, body) {
			if (err) res.send(400, err);
			var payload = JSON.parse(body);
			req.session.access_token = payload.access_token;
			res.redirect(AUTH_PATH);
		});
	}
});

/*-------------------------------Routes---------------------------------*/
if (DEBUG) {
	app.get('/test', function(req, res) {
		res.send(200, "test successful");
	});
}

app.get('/user', function(req, res) {
	if (req.session.user) res.send(200, req.session.user);
	else res.send(400, 'not authed');
});

app.get('/user/data', function(req, res) {
	if (req.session.user) {
		getUserData(req.session.user, function(userData) {
			res.json(200, userData);
		});
	} else res.send(400, 'not authed');
});

app.post('/user/data', function(req, res) {
	if (req.session.user) {
		saveUserData(req.session.user, req.body, function(result) {
			res.send(200, result);
		});

	} else res.send(400, 'not authed');
});

/*-------------------------------Data Storage---------------------------------*/
var map = {};
var getUserData, saveUserData;

if (IS_PERSISTENT) {
	getUserData = function(userId, cb) {
		MongoClient.connect(MONGO_URL + COLLECTION_NAME, function(err, db) {
			if (err) throw err;
			var collection = db.collection(COLLECTION_NAME);
			collection.findOne({
				userId: userId
			}, {
				_id: 0,
				userId: 0
			}, function(err, doc) {
				if (err) throw err;
				cb(doc);
			});
		});
	}

	saveUserData = function(userId, userObj, cb) {
		MongoClient.connect(MONGO_URL + COLLECTION_NAME, function(err, db) {
			if (err) throw err;
			var collection = db.collection(COLLECTION_NAME);
			userObj.userId = userId;
			collection.update({
				userId: userId
			}, userObj, {
				upsert: true,
				multi: false
			}, function(err, result) {
				if (err) throw err;
				cb(result);
			});
		});
	}
} else {
	getUserData = function(userId, cb) {
		cb(map[userId]);
	}

	saveUserData = function(userId, userObj, cb) {
		map[userId] = userObj;
		cb(true);
	}
}

if (IS_SECURE) {
	var options = {
		key: fs.readFileSync(SECURE_PEM_KEY_PATH),
		cert: fs.readFileSync(SECURE_CERTIFICATE_PATH)
	};
	https.createServer(options, app).listen((PORT) ? PORT : 443);
	if (DEBUG) console.log('https server listening on port ' + ((PORT) ? PORT : 443));
} else {
	http.createServer(app).listen((PORT) ? PORT : 80);
	if (DEBUG) console.log('http server listening on port ' + ((PORT) ? PORT : 80));
}

module.exports.app = app;
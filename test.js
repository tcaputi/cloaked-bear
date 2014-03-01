var app = require('./lib/server.js').app;

app.get('/test2', function(req, res) {
	res.send(200, "test2 successful");
});
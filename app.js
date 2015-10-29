var express = require('express');
var jade = require('jade');
var passport = require('passport');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var mysql = require('mysql');
var hogan = require('hogan-express');
var http = require('http');
var OpenIDConnectStrategy = require('passport-idaas-openidconnect').IDaaSOIDCStrategy;

var port = (process.env.VCAP_APP_PORT || 3000);
var host = (process.env.VCAP_APP_HOST || 'localhost');

console.log(port);
console.log(host);

// all environments
var app = express();

//check if application is being run in cloud environment
if (process.env.VCAP_SERVICES) {
  var services = JSON.parse(process.env.VCAP_SERVICES);
  console.log(services);
  

  // look for a service starting with 'SQL'
  for (var svcName in services) {
    if (svcName.match(/^sql/)) {
      var mysqlCreds = services[svcName][0]['credentials'];
      var db = mysql.createConnection({
        host: mysqlCreds.host,
        port: mysqlCreds.port,
        user: mysqlCreds.user,
        password: mysqlCreds.password,
        database: mysqlCreds.name
      });
      console.log(db);
      createTable();
    }
  }
}

app.set('port', port);
// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));
// set the directory for views
app.set("views", __dirname + "/public");
// set view engine
app.set('view engine', 'html');
app.engine('html', hogan);


app.use(cookieParser());
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session()); 

passport.serializeUser(function(user, done) {
   done(null, user);
}); 

passport.deserializeUser(function(obj, done) {
   done(null, obj);
});

//var services = JSON.parse(process.env.VCAP_SERVICES || "{}");
var ssoConfig = services.SingleSignOn[0]; 
var client_id = ssoConfig.credentials.clientId;
var client_secret = ssoConfig.credentials.secret;
var authorization_url = ssoConfig.credentials.authorizationEndpointUrl;
var token_url = ssoConfig.credentials.tokenEndpointUrl;
var issuer_id = ssoConfig.credentials.issuerIdentifier;
var callback_url = 'http://voucherhoundbeta.mybluemix.net/auth/sso/callback';

var OpenIDConnectStrategy = require('passport-idaas-openidconnect').IDaaSOIDCStrategy;
var Strategy = new OpenIDConnectStrategy({
        authorizationURL : authorization_url,
        tokenURL : token_url,
        clientID : client_id,
        scope: 'openid',
        response_type: 'code',
        clientSecret : client_secret,
        callbackURL : callback_url,
        skipUserProfile: true,
        issuer: issuer_id 
    }, function(accessToken, refreshToken, profile, done) {
        process.nextTick(function() {
        profile.accessToken = accessToken;
        profile.refreshToken = refreshToken;
        done(null, profile);
    });
});

passport.use(Strategy);
app.get('/login', passport.authenticate('openidconnect', {}));

function ensureAuthenticated(req, res, next) {
    if(!req.isAuthenticated()) {
        req.session.originalUrl = req.originalUrl;
        res.redirect('/');
    } else {
        return next();
    }
}

// start server
http.createServer(app).listen(app.get('port'), function () {
	  console.log('Express server listening at http://' + host + ':' + port);
	});

// try to render database
//show table
app.all('/vouchers', function (req, res) {
  getOffers(function (err, offers) {
    if (err) return res.json(err);
    res.render('index.html', {offers: offers});
  });
});

function getOffers(cb) {
	console.log("getting offers...");
	  var sql = 'SELECT * FROM USER03754.test_data';
	  db.query(sql, function (err, result) {
		  console.log(err, result);
	    if (err) return cb(err);
	    cb(null, result);
	  });
	}

function createTable() {
	console.log("creating table");
	  var sql = 'CREATE TABLE IF NOT EXISTS USER03754.test_data ('
	            + 'OfferId INTEGER PRIMARY KEY AUTO_INCREMENT,'
	            + 'Title VARCHAR(50),'
	            + 'Company VARCHAR(50),'
	            + 'Description VARCHAR(255),'
	            + 'VoucherCode VARCHAR(20),'
	            + 'Type VARCHAR(20),'
	            + 'ExpiryDate DATE,'
	            + 'Lat VARCHAR(20),'
	            + 'Long VARCHAR(20)'
	          + ');'; 
	  db.query(sql, function (err, result) {
	    if (err) console.log(err);
	  });
	}

function isNotEmpty(str) {
	  return str && str.trim().length > 0;
	}


// actual app routes

app.get('/auth/sso/callback', function(req, res, next) {
	authenticated = true;
    var redirect_url = req.session.originalUrl;                
    passport.authenticate('openidconnect', {
        successRedirect: '/dashboard',                                
        failureRedirect: '/failure',                        
    })(req,res,next);
});

//app.get('/hello', ensureAuthenticated, function(request, response) {
//	 response.redirect('/welcome.html');
//});
    
app.get('/dashboard', ensureAuthenticated, function(request, response) {
	  var displayName = request.user['_json'].displayName;
	  response.render('welcome', {displayn: displayName});
	//response.redirect('/welcome.html');
    //response.send('<!DOCTYPE html><html><head><title>Voucher Hound</title><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="stylesheets/style.css" media="min-device-width: 481px"><link rel="stylesheet" type="text/css" media="only screen and (max-device-width: 480px)" href="stylesheets/mobile.css"></head><body><div id="bodyContent"><img class = "newappIconWelcome" src="images/hound_dog_logo.png"><div id="welcomeContent"><h3>Welcome ' + displayName + '</h3></div><div id="optionMenu"><ul><li title="Vouchers"><img class="imgGrayscale" src="images/vouchers.png" width="90px" height="90px"></li><li title="Hound"><img class="imgGrayscale" src="images/geo.png" width="90px" height="90px"></li><li title="Map"><a href="/map"><img class="imgGrayscale" src="images/map.png" width="90px" height="90px"></a></li><li title="Account"><img class="imgGrayscale" src="images/account.png" width="90px" height="90px"></li><li title="Settings"><img class="imgGrayscale" src="images/preferences.png" width="90px" height="90px"></li><li title="Log Out"><a href="/logout"><img class="imgGrayscale" src="images/logout.png" width="90px" height="90px"></a></li></ul></div></div></body></html>');
});

app.get('/map', ensureAuthenticated, function(request, response) {
	response.render('map');
});

app.get('/list', ensureAuthenticated, function(request, response) {
	response.render('list');
});

app.get('/hound', ensureAuthenticated, function(request, response) {
	response.render('hound');
});

app.get('/logout', function(req, res){
    authenticated = false;
	req.logout();
    res.redirect('/');
});

app.get('/failure', function(req, res) { 
    res.redirect('/'); 
});

//app.get('/', function (req, res) {
//    res.send('<h1>Bluemix Service: Single Sign On</h1>' + '<p>Sign In with a Social Identity Source (SIS): Cloud directory, Facebook, Google+ or LinkedIn.</p>' + '<a href="/auth/sso/callback">Sign In with a SIS</a>');
//});
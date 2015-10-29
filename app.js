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

// DATABASE CONNECTION
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
        user: mysqlCreds.username,
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

// functions

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

// ARRAY FUNCTION

//function getArray() {
//    return ["{" [ "1", "Free coffee with every cake", "Starbucks", "Offer ends 25/12/2015", "WET97906144", "Available in store", "01/04/16", "51.506151", "-0.115085"], 
//             [ "2, 15% off all items on the breakfast menu, Strada, Offer available from 8am till 11am on breakfast items only when presenting this voucher, BRI99178872, Voucher required, 01/02/16, 51.504953, -0.117323"], 
//            [ "3", "Free glass of wine or soft drink with any pasta dish", "Bella Italia", "Customers must be over 18 to claim alcohol with their meal", "Offer applies before 5pm everyday when presenting this voucher", "BEL60525543", "Voucher required", "01/12/16", "51.506718", "-0.114380"],
//             [ "6",  "Toddlers eat free with any adult main", "Cafe Rouge", "Offer applies Monday to Friday only before 3pm with this voucher", "CAF39292084", "Available in store", "01/03/16", "51.507188", "-0.111523"], "}"];
//};

// actual app routes

app.get('/vouchers', ensureAuthenticated, function(request, response) {
	var data = getArray();
		 response.render('map.html', {data: data});
});

app.get('/auth/sso/callback', function(req, res, next) {
	authenticated = true;
    var redirect_url = req.session.originalUrl;                
    passport.authenticate('openidconnect', {
        successRedirect: '/dashboard',                                
        failureRedirect: '/failure',                        
    })(req,res,next);
});
  
app.get('/dashboard', ensureAuthenticated, function(request, response) {
	  var displayName = request.user['_json'].displayName;
	  response.render('welcome', {displayn: displayName});
	  });

app.get('/map', ensureAuthenticated, function(request, response) {
	var data = getArray();
	response.render('map', {data: data});
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
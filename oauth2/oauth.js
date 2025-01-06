'use strict';
const dotenv = require('dotenv');
dotenv.config({ path: 'C:/Users/rmisu/OneDrive/Desktop/api/paymentApp/.env' });


const consumerKey = process.env.consumerKey;
const consumerSecret = process.env.consumerSecret;

//console.log('Consumer Key:', consumerKey);
//console.log('Consumer Secret:', consumerSecret);
//console.log('PORT ', process.env.PORT);



// Required modules
var http = require('http');
var port = process.env.PORT || 3000;
var request = require('request');
var qs = require('querystring');
var util = require('util');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var express = require('express');
var app = express();
var QuickBooks = require('../QBmodules');
var Tokens = require('csrf');
var csrf = new Tokens();
const path = require('path');

QuickBooks.setOauthVersion('2.0');

// Generic Express config
app.set('port', port);
app.set('views', path.join(__dirname, 'views'));
//app.set('views', 'views');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser('brad'));
app.use(session({ resave: false, saveUninitialized: false, secret: 'smith' }));

app.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});


//var consumerKey = 'ABHA5tFBMs2mTS4mceqGW5D9qKqRNJ2Cg9FEwvjwnlgxEouII5';
//var consumerSecret = '8huVQ5nnz2XHKfQByAePqItUKZlM24wf5f1Gg2Pe';
//console.log('consumer key ', consumerKey);
//console.log('consumerSecret ', consumerSecret);

// Variables
let accessToken = null; 
let qbo = null;
let realmId = null; // Stores the Realm ID

// Home route
app.get('/', function (req, res) {
  res.redirect('/start');
});

// Render the start page
app.get('/start', function (req, res) {
  res.render('intuit.ejs', { port: port, appCenter: QuickBooks.APP_CENTER_BASE });
});

// Generate CSRF token for anti-forgery
function generateAntiForgery(session) {
  session.secret = csrf.secretSync();
  return csrf.create(session.secret);
}

// Step 1: Request token
app.get('/requestToken', function (req, res) {
  var redirecturl = QuickBooks.AUTHORIZATION_URL +
    '?client_id=' + consumerKey +
    '&redirect_uri=' + encodeURIComponent('http://localhost:' + port + '/callback/') + // Match dashboard entry
    '&scope=com.intuit.quickbooks.accounting' +
    '&response_type=code' +
    '&state=' + generateAntiForgery(req.session);

  res.redirect(redirecturl);
});

// Step 2: Handle OAuth callback and exchange code for tokens
app.get('/callback', function (req, res) {
  if (!req.query.realmId) {
    console.error('Realm ID is missing from callback URL');
    res.status(400).send('Error: Realm ID is missing');
    return;
  }

  realmId = req.query.realmId; // Save the Realm ID
  console.log('Realm ID received:', realmId);

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  const postBody = {
    url: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + auth,
    },
    form: {
      grant_type: 'authorization_code',
      code: req.query.code,
      redirect_uri: `http://localhost:${port}/callback/`, // Match dashboard entry
    },
  };

  request.post(postBody, function (err, response, body) {
    if (err) {
      console.error('Error during token exchange:', err);
      res.status(500).send('Error exchanging tokens');
      return;
    }

    //console.log('Response Body:', body); // Log the response for debugging
    const parsedToken = JSON.parse(body);

    if (!parsedToken.access_token) {
      console.error('Access token is missing or invalid:', parsedToken);
      res.status(500).send('Error: Invalid access token');
      return;
    }

    accessToken = parsedToken;

    // Initialize QuickBooks instance
    qbo = new QuickBooks(
      consumerKey,
      consumerSecret,
      accessToken.access_token, // OAuth access token
      false, // No token secret for OAuth 2.0
      realmId, // Use the saved Realm ID
      true, // Use sandbox account
      true, // Enable debugging
      4, // Minor version
      '2.0', // OAuth version
      accessToken.refresh_token, // Refresh token
    );

    console.log('QuickBooks instance initialized');
    res.send('<!DOCTYPE html><html><head></head><body><script>window.opener.location.reload(); window.close();</script></body></html>');
  });
});

// Export the QuickBooks instance and Realm ID
module.exports = {
  getQboInstance: () => qbo,
  getRealmId: () => realmId,
};

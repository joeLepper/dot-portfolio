require("babel-register")

const webpack = require('webpack')
const express = require('express')
const app = express()
const webpackDevMiddleware = require('webpack-dev-middleware')
const config = require('./webpack.config')
const React = require('react')
const ReactDOM = require('react-dom/server')
let port = 3000

const Page = require('./src/page').Page

const __PROD__ = process.env.NODE_ENV === 'production'
const __STAGING__ = process.env.NODE_ENV === 'staging'
const __DEV__ = !__PROD__ && !__STAGING__
const __COLS__ = Math.min(process.env.COLS, 128)

if (__DEV__) app.use(webpackDevMiddleware(webpack(config), { stats: { colors: true } }))
else {
  if (__PROD__) port = 80
  app.use(express.static('dist'))
}


// Storage Backend
const leStore = require('le-store-certbot').create({
  configDir: '~/letsencrypt/etc',                         // or /etc/letsencrypt or wherever
  debug: false,
});


// ACME Challenge Handlers
const leChallenge = require('le-challenge-fs').create({
  webrootPath: '~/letsencrypt/var/',                       // or template string such as
  debug: false,                                            // '/srv/www/:hostname/.well-known/acme-challenge'
});


const  leAgree = (opts, agreeCb) => {
  // opts = { email, domains, tosUrl }
  agreeCb(null, opts.tosUrl);
}

const LE = require('letsencrypt')
const le = LE.create({
  server: __PROD__ ? LE.productionServerUrl : LE.stagingServerUrl,
  store: leStore,
  challenges: { 'http-01': leChallenge },
  challengeType: 'http-01',
  agreeToTerms: leAgree,
//, sni: require('le-sni-auto').create({})                // handles sni callback
  debug: false,
  log: (msg) => console.error(msg)
})
app.use('/', le.middleware());

// Check in-memory cache of certificates for the named domain
le.check({ domains: [ process.env.DOMAIN ] }).then(function (results) {
  if (results) return;

  // Register Certificate manually
  le.register({
    domains: [process.env.DOMAIN],
    email: process.env.EMAIL,
    agreeTos: true,
    rsaKeySize: 2048,
    challengeType: 'http-01',
  }).then(function (results) {

    console.log('success');

  }, function (err) {

    // Note: you must either use le.middleware() with express,
    // manually use le.challenges['http-01'].get(opts, domain, key, val, done)
    // or have a webserver running and responding
    // to /.well-known/acme-challenge at `webrootPath`
    console.error('[Error]: node-letsencrypt/examples/standalone');
    console.error(err.stack);
  })
})

const validCols = [16, 32, 64, 128]

function closest (candidate) {
  const currentClosest = validCols[0]
  validCols.forEach(function (val) {
    if (Math.abs(candidate - val) < Math.abs(candidate - currentClosest)) currentClosest = val
  })
  return currentClosest
}

app.get('/', function (req, res) {
  const cols = closest(req.query.cols || __COLS__)
  const rows = cols / 16 * 9
  const brand = req.query.brand || true

  const page = React.createElement(Page, {
    cols: cols,
    rows: rows,
    brand: brand
  })
  res.status(200).send(ReactDOM.renderToStaticMarkup(page))
})

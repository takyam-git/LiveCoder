var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  console.log('req', req);

  res.render('index', { title: 'Express' });
});

module.exports = router;

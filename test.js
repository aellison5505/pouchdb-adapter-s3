var PouchDB = require('pouchdb');
var AWS = require('aws-sdk');
var plug = require('./index.js');

var accessKeyId = 'AKIAILBZUF2AMWXMXMMA';
var secretAccessKey = '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';

AWS.config.update({
  region: 'us-east-1'
});
var cred = new AWS.Credentials(accessKeyId, secretAccessKey, sessionToken = null);

PouchDB.plugin(plug);

var db = new PouchDB('mydb', {
  adapter: 's3',
  region: 'us-east-1',
  bucket: 'jbmdl.pouchdb',
  credentials: cred
});

fx1 = function() {
  db.info(function(err, info) {
    if (err) {
      console.log(err);
      return;
    } else {
      console.log(info);
      fx2();
    }
  });
}

fx2 = function() {
  db.put({
    _id: 'mydoc',
    title: 'this is good'
  }, function(err, response) {
    if (err) {
      return console.log('re ',err);
    }
    // handle response
    console.log('re',response);
  });
}

fx3 = function() {
  db.get('mydoc1', function(err, doc) {
  if (err) { return console.log(err); }
  else {
    console.log(doc);
  }
});
}

fx3();

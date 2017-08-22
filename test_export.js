var test_id = require('./id_index');
var db = require('./backend');
var AWS = require('aws-sdk');


var accessKeyId = 'AKIAILBZUF2AMWXMXMMA';
var secretAccessKey = '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';

AWS.config.update({
  region: 'us-east-1'
});
var cred = new AWS.Credentials(accessKeyId, secretAccessKey, sessionToken = null);


var metadata = {
  db_name : 'mydb',
  bucket : 'jbmdl.pouchdb',
  prex : 'mydb' + '/',
  apiVersion : '2006-03-01',
  sslEnabled : true,
  credentials : cred,
  region : 'us-east-1'
}

db.load(metadata);
/*
db.put('db_index', '{}', function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else {
    console.log(data); // successful response
  }
});
*/
var index_id = null;

test_id.IdIndex(db, index_id, function(err,data){
  if(err){
    console.log(err);
  }else{
    console.log(data.pages);
    index_id = data;
    fx2();
  }
});


fx2 = function(){
  //console.log(index);
  test_id.addDoc('mydoc', function(err,ret){
    if(err){
      console.log('err',err);
    }else{
      console.log('ret',ret);
    }
  });
}

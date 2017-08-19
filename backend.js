var AWS = require('aws-sdk');

s3 = null;

metadata = {};

function load(mdata){
  metadata = mdata;

  var params = {
    apiVersion: metadata.apiVersion,
    sslEnabled: true,
    credentials: metadata.credentials
  };

  s3 = new AWS.S3(params);


}


function get(key, callback) {
  var params = {
    Bucket: metadata.bucket,
    Key: metadata.db_name + '/' + key
  };
  s3.getObject(params, function(err, data) {
    callback(err, data);
  });

}

function put(key, body, callback){
  var params = {
    Bucket: metadata.bucket,
    Key: metadata.prex + key,
    Body: body
  };

  //console.log(params);
  s3.putObject(params, function(err, data) {
    callback(err, data);
  });
}

function getBucketHead(bucket, callback){
  var HeadParams = {
    Bucket: bucket
  };

  s3.headBucket(HeadParams, function(err, data) {
    callback(err,data);
  });


}

module.exports = {
  load,
  get,
  put,
  getBucketHead
}

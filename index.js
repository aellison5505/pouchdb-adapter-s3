var uuid = require('uuid');
var utils = require('pouchdb-adapter-utils');
var db = require('./backend');
var merge = require('pouchdb-merge');
var error = require('pouchdb-errors');
var ADAPTER_NAME = 's3';
var metadata = {};
var api = null;

function getWinningRev(doc_metadata) {
  return 'winningRev' in doc_metadata ?
    doc_metadata.winningRev : merge.winningRev(metadata);
}

function getIsDeleted(doc_metadata, winningRev) {
  return 'deleted' in metadata ?
    doc_metadata.deleted : utils.isDeleted(doc_metadata, winningRev);
}

function build_db(callback) {
  metadata.uuid = uuid.v4().toString();


  db.put('db_uuid', metadata.uuid, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else {
      //console.log(data); // successful response
      fx1();
    }
  });

  fx1 = function() {
    db.put('db_doc_count', '0', function(err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else {
        //console.log(data); // successful response
        fx2();
      }
    });
  }
  fx2 = function() {
    db.put('db_seq', '0', function(err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else {
        //console.log(data); // successful response
        callback(null);
      }
    });
  }

}

function s3DBPouch(opts, callback) {
  api = this;
  //console.log(opts);
  metadata.db_name = opts.name.replace('_pouch_', '');
  metadata.bucket = opts.bucket;
  metadata.prex = metadata.db_name + '/';
  metadata.apiVersion = '2006-03-01';
  metadata.sslEnabled = true;
  metadata.credentials = opts.credentials;

  db.load(metadata);

  db.getBucketHead(opts.bucket, function(err, data) {
    if (err) {
      throw ('error');
      return;
    }
  });

  db.get('db_uuid', function(err, data) {
    if (err) {
      console.log(err.code); // an error occurred
      build_db(function(err, sec) {
        if (err) {
          //console.log(err);
          return;
        } else {
          fxFinalLoad();
        }
      });
    } else {
      //console.log(data, data.Body.toString());           // successful response
      metadata.uuid = data.Body.toString();
      fxFinalLoad();
    }
  });

  fxFinalLoad = function() {
    //console.log(metadata);


    api._remote = true;

    api.type = function() {
      return ADAPTER_NAME;
    };

    //check if idb is needed?
    api._id = function(idb, cb) {
      cb(null, metadata.db_name);
    };

    api._info = function(callback) {

      db.get('db_doc_count', function(err, data) {
        if (err) {
          console.log(err);
          final(err);
        } else {
          metadata.count = Number(data.Body.toString());
          fx2();
        }
      });

      function fx2() {
        db.get('db_doc_count', function(err, data) {
          if (err) {
            console.log(err);
            final(err);
          } else {
            metadata.seq = Number(data.Body.toString());
            final(null);
          }
        });
      }

      function final(err) {
        process.nextTick(function() {
          if (err) {
            callback(err);
          } else {
            callback(null, {
                db_name: metadata.db_name,
                doc_count: metadata.count,
                update_seq: metadata.seq

            });
          }
        });
      }
    };


    api._get = function(id, opts, callback) {

       //opts = utils.clone(opts);
        console.log(opts);

         db.get('docs/db_doc_' + id, function(err, data) {

         if (err || !data) {
           return callback(error.createError(error.MISSING_DOC, 'missing'));
         }

         doc_metadata = JSON.parse(data.Body.toString());

         var rev;
         console.log(doc_metadata);

         if (!opts.rev) {
           rev = getWinningRev(doc_metadata);
           var deleted = getIsDeleted(doc_metadata, rev);
           if (deleted) {
             return callback(error.createError(error.MISSING_DOC, "deleted"));
           }
         } else {
           rev = opts.latest ? error.latest(opts.rev, doc_metadata) : opts.rev;
         }

         var seq = doc_metadata.rev_map[rev];

         db.get('seqs/db_seq_' + seq, function(err, data2) {

           if (!data2) {
             return callback(error.createError(error.MISSING_DOC));
           }

           doc = JSON.parse(data2.Body.toString());

           /* istanbul ignore if */
           if ('_id' in doc && doc._id !== doc_metadata.id) {
             // this failing implies something very wrong
             return callback(new Error('wrong doc returned'));
           }
           doc._id = doc_metadata.id;
           if ('_rev' in doc) {
             /* istanbul ignore if */
             if (doc._rev !== rev) {
               // this failing implies something very wrong
               return callback(new Error('wrong doc returned'));
             }
           } else {
             // we didn't always store this
             doc._rev = rev;
           }
           return callback(null, {
             doc: doc,
             metadata: doc_metadata
           });
         });
       });
     }


    api._bulkDocs = function(req, opts, FxCallback) {
      var newEdits = opts.new_edits;
      var results = new Array(req.docs.length);
      var fetchedDocs = new Map();
      var stemmedRevs = new Map();

      var txn = null;
      var docCountDelta = 0;
      var returnDocs;
      if ('return_docs' in opts) {
        returnDocs = opts.return_docs;
      } else if ('returnDocs' in opts) {
        // TODO: Remove 'returnDocs' in favor of 'return_docs' in a future release
        returnDocs = opts.returnDocs;
      } else {
        returnDocs = true;
      }

      // parse the docs and give each a sequence number
      var userDocs = req.docs;
      var docInfos = userDocs.map(function(doc) {
        if (doc._id && utils.isLocalId(doc._id)) {
          return doc;
        }
        var newDoc = utils.parseDoc(doc, newEdits);

        if (newDoc.metadata && !newDoc.metadata.rev_map) {
          newDoc.metadata.rev_map = {};
        }

        return newDoc;
      });
      var infoErrors = docInfos.filter(function(doc) {
        return doc.error;
      });

      if (infoErrors.length) {
        return callback(infoErrors[0]);
      }

      //console.log(docInfos);
      //console.log(docInfos[0].metadata.rev_tree[0]);

      function complete() {
        //console.log('we done');

        opts.done = true;
        FxCallback(null, results);

      }

      function writeDoc(docInfo, winningRev, winningRevIsDeleted, newRevIsDeleted, isUpdate, delta, resultsIdx, callback2) {

        function getNewSeq(callback, callback2) {

          db.get('db_seq', function(err, data) {
            if (err) {
              callback2('seq not found');
            } else {
              seq = Number(data.Body.toString()) + 1;
              fx2(seq);
            }
          });

          fx2 = function(seq) {
            //put to db
            db.put('db_seq', seq.toString(), function(err, data) {
              if (err) console.log(err, 'seq err'); // an error occurred
              else {}//console.log(data); // successful response
            });
            //console.log(seq);
            callback(seq, callback2);
          }

        }

        function popDocNum(callback) {
          db.get('db_doc_count', function(err, data) {
            if (err) {
              callback2('seq not found');
            } else {
              num = Number(data.Body.toString()) + 1;
              fx2(num);
            }
          });

          fx2 = function(num) {
            //put to db
            db.put('db_doc_count', num.toString(), function(err, data) {
              if (err) console.log(err, err.stack); // an error occurred
              else {}//console.log(data); // successful response
            });
            //console.log(num, ' popDoc');
            callback();
          }
        }

        docInfo.metadata.winningRev = winningRev;
        docInfo.metadata.deleted = winningRevIsDeleted;

        docInfo.data._id = docInfo.metadata.id;
        docInfo.data._rev = docInfo.metadata.rev;


        if (newRevIsDeleted) {
          docInfo.data._deleted = true;
        }

        if (docInfo.stemmedRevs.length) {
          stemmedRevs.set(docInfo.metadata.id, docInfo.stemmedRevs);
        }

        var attachments = docInfo.data._attachments ? Object.keys(docInfo.data._attachments) : [];

        var seq = docInfo.metadata.rev_map[docInfo.metadata.rev];
        /* istanbul ignore if */
        if (seq) {
          // check that there aren't any existing revisions with the same
          // revision id, else we shouldn't do anything
          return callback2();
        }


        fxFin = function(seq, callback) {
          docInfo.metadata.rev_map[docInfo.metadata.rev] = docInfo.metadata.seq = seq;

          db.put('seqs/db_seq_' + seq, JSON.stringify(docInfo.data), function(err, data) {
            if (err) console.log(err, 'data'); // an error occurred
            else {}//console.log(data); // successful response
          });

          db.put('docs/db_doc_' + docInfo.metadata.id, JSON.stringify(docInfo.metadata), function(err, data) {
            if (err) console.log(err, 'meta'); // an error occurred
            else {}//console.log(data); // successful response
          });

          //console.log(seq);
          popDocNum(callback);


          console.log(docInfo);
          //console.log(winningRev);
          //console.log(isUpdate);
          //console.log(resultsIdx);
        }

        fxDone = function() {
          //console.log('fxdone');
          results[resultsIdx] = {
            ok: true,
            id: docInfo.metadata.id,
            rev: docInfo.metadata.rev
          };
          fetchedDocs.set(docInfo.metadata.id, docInfo.metadata);
          callback2();
        }

        getNewSeq(fxFin, fxDone);

        }

//end write doc

      processDocs = function (err){
        if(err){
          FxCallback(err);
          console.log(err);
          return;
        }else{
        utils.processDocs(revLimit, docInfos, api, fetchedDocs, tx, results,writeDoc, opts, complete);
        }
      }


      docDoneCount = 0;
      revLimit = 1000;
      tx = null;
      i = 0;
      var sendErr = null;

      function docDone() {
        if(++docDoneCount === userDocs.length){
          processDocs(sendErr);
          console.log(sendErr);
        }
      }

      //!!!!!!!!!! Fetch Docs?!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
      userDocs.forEach(function(doc) {
        //!!!!!!!!!!!!put real get in!!!!!!!!!!!!!!!!!!!!!
        db.get('docs/db_doc_'+doc._id, function(err, data){
          if (err) {
          //  throw(new Error(err.code));
          if(err.code !== 'NoSuchKey' ){
            if(!sendErr){
              sendErr = [];
            }
            sendErr = err.code;
            console.log(err.code);
          }
          } else {
            fetchedDocs.set(doc._id, JSON.parse(data.Body.toString()));
            //console.log(fetchedDocs.get(doc._id));
          }
          docDone();
        });

      });

    };

    api._allDocs = function(idb, opts, cb) {

    };

    api._getAttachment = function(idb, docId, attachId, attachment, opts, cb) {

    };

    api._changes = function(idb, opts) {

    };

    api._getRevisionTree = function(db, id, callback) {}

    api._doCompaction = function(idb, id, revs, callback) {}


    api._destroy = function(opts, callback) {

    };

    api._close = function(db, cb) {
      //  delete openDatabases[dbOpts.name];
      cb();
    };

    // TODO: this setTimeout seems nasty, if its needed lets
    // figure out / explain why
    setTimeout(function() {
      callback(null, api);
    });

    process.nextTick(function() {
      callback(null, this)
    }.bind(this));
  }
}

// TODO: this isnt really valid permanently, just being lazy to start
s3DBPouch.valid = function() {
  return true;
};
module.exports = function(PouchDB) {
  PouchDB.adapter('s3', s3DBPouch, false);
};

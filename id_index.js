String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

meta_index = null;

IdIndex = function(db, id_index, callback) {

  meta_index = id_index;

  if (meta_index===null){
    meta_index={};
    loadIndex(db,function(err,ret){
      if (err){
        callback(err);
      }else{
        meta_index = ret;
        callback(null,ret);
      }
    })
  }
}

  var set_meta_index = function (set_indx){
    meta_index = set_indx
  }

  loadIndex = function(db, callback2) {

    db.get('db_index', function(err, data) {
      if(err) {
        return callback(err);
      }else {
        console.log(data);
        meta_index.ETag = data.ETag.replaceAll('\"','');
        meta_index.pages = JSON.parse(data.Body.toString());
        if (!meta_index.pages.length){
          meta_index.pages = [];
          createPage([],'1000000000',function (err){
            if(err){
              callback2(err);
            }else{
              callback2(null,meta_index);
            }
          });
        }
    //  callback(null,'end');
      }
    });


  }



  function asending(start, end, callback) {
    var start_indx = 0;

    if (start) {

    }

    function processList() {

    }

  }

  function decending(start, end, callback){

  }

  addDoc = function(id, callback) {
    console.log('adddoc', meta_index.pages);
    if(meta_index===null){
      this.loadIndex(function(err){
        if(err) {
          callack(err);
        }else {
          callback(null,'good');
        }
      });
    }
    console.log(meta_index.pages);
    for(i=0; i<meta_index.pages.length; i++){
      console.log('page',i);
      if(meta_index.pages[i].start === null){
        meta_index.pages[i].start = id,
        meta_index.pages[i].end = id
        break;
      }


    }
    callback(null,meta_index);
  }

  function loadPage(callback){

  }

  function checkValid(callback) {

  }



  function createPage(keys, pageName, callback){
      if(keys.length===0){
        start_key=null;
        end_key=null
      }else{
        start_key=keys[0];
        end_key=keys[keys.length-1];
      }
      meta_index.pages.push({'page': 'db_page_'+pageName,
                            'start': start_key,
                            'end': end_key
                          });
      callback(null,'cp');
  };

  function saveIndex() {

  }

  function removeDoc() {

  }

module.exports = {
  IdIndex,
  addDoc

}

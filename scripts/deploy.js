var fs = require('fs');
var mime = require('mime');
var glob = require('glob-expand');
var async = require('async');
var aws = require('aws-sdk');
var s3 = new aws.S3();


var START = (new Date()).getTime();

// the name of the nuteup.com s3 bucket
var BUCKET = 'chroma-cast-test'

// list of files in the s3 bucket
var FILELIST = [];

// get a list of all files in the bucket (caveat: see warning below)
var populateFileList = function(done) {
  var list = [];

  // Warning: This will only return upto 1000 objects! We'll need to paginate
  //          later by checking data.IsTruncated.
  s3.listObjects({ Bucket: BUCKET }, function(err, data) {
    if (err) {
      console.log(err);
      done(err);
    }

    FILELIST = data.Contents;
    done();
  });
};

// delete all files in the s3 bucket
var deleteOldFiles = function(done) {
  var callback = function(err, res) {
    if (err) {
      console.log(err);
      done(err);
    }

    done();
  };

  if (!FILELIST.length) {
    done();
  }

  var files = FILELIST.map(function(file) {
    return { Key: file.Key };
  });

  s3.deleteObjects({ Bucket: BUCKET,
                     Delete: { Objects: files,
                               Quiet: false }}, callback);
};

// upload a single file to an s3 bucket
var fileUpload = function(filename, cwd, done) {
  var buffer = fs.readFileSync(cwd + '/' + filename);
  var contentType = mime.lookup(filename);

  var callback = function(err, res) {
    if (err) {
      console.log(err);
      done(err);
    }

    console.log('Finished.\n');
    done();
  };

  s3.putObject({ ACL: 'public-read',
                 Bucket: BUCKET,
                 Key: filename,
                 Body: buffer,
                 ContentType: contentType }, callback);
};

// upload an entire directory to an s3 bucket
var dirUpload = function(dir) {

  return function(done) {
    var files = glob({ filter: 'isFile', cwd: dir },
                     ['*', '**/**', '!package.json', '!README.md',
                      '!node_modules/**', '!test/**', '!scripts/**',
                      '!npm-debug.log', '!deploy.sh']);

    var callback = function(err) {
      if (err) {
        console.log(err);
        throw err;
      }

      console.log('Upload completed successfully.',
                  (((new Date()).getTime() - START) * 0.0000166667).toFixed(2),
                  'min.');
      done();
    };

    console.log('Preparing to upload ' + files.length + ' files...\n');

    async.eachSeries(files, function(file, cb) {
      console.log('Uploading: ' + file);

      fileUpload(file, dir, cb);

    }, callback);
  };
};

// kickoff!
async.series([
  populateFileList,
  deleteOldFiles,
  dirUpload(process.cwd())
], function(err) { if (err) throw err; });

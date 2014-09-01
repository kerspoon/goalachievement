'use strict';
/*jshint node:true*/

var gutil     = require('gulp-util');
var through   = require('through2');
var Liquid    = require('liquid-node');
var fs        = require('fs');
var _         = require('underscore');

var engine = new Liquid.Engine();

// a little in-memory cache of the template layout files.
var layouts = {
};

// this goes and grabs a template, splits it into the bit before {{content}} and
// the bit after it and saves it to the cache.
function getLayout(name, callback) {
  if (layouts[name]) {
    return callback(null, layouts[name][0], layouts[name][1]);
  } else {
    fs.readFile(name, function (err, data) {
      if (err) {
        return callback(err);
      }
      var parts = data.toString().split(/\{\{\s*content\s*\}\}/);
      layouts[name] = parts;
      return callback(null, layouts[name][0], layouts[name][1]);
    });
  }
}

/*
 * gulp-liquid
 * @param opts.locals {Object} - Locals that should be passed to files
 * @param opts.tags {Object} - Locals that should be passed to files
**/
module.exports = function (opts) {
  opts = opts || {};

  function liquid (file, enc, callback) {
    /*jshint validthis:true*/

    if (file.isNull()) {
      return callback();
    }

    if (file.isStream()) {
      this.emit('error',
        new gutil.PluginError('gulp-liquid', 'Stream content is not supported'));
      return callback();
    }


    // split the layout file on {{content}}
    // prepend the file stream with layout[0]
    // append the file stream with layout[1]

    if (file.isBuffer()) {
      var layoutFileName = 'app/template/default.html';
      if (file.page && file.page.layout) {
        layoutFileName = file.page.layout + '.html';
      }
      var self = this;

      getLayout(layoutFileName, function (err, start, end) {
        if (err) {
          self.emit('error',
            new gutil.PluginError('gulp-liquid', 'Cannot find template file: ' + layoutFileName));
          return callback();
        }

        // the data that get's put into the template is made from the file's frontmatter and the options passed in.
        var data =_.extend({}, file.page, opts.locals);

        // we create the template on the fly, it is made from the start of the
        // layout file, followed by the full contents of the file we are working
        // on followed by the end of the layout file.
        engine
          .parse(start + '\n' + file.contents.toString() + '\n' + end)
          .then(function(template) {
            return template.render(data);
          })
          .then(function (output) {
            file.contents = new Buffer(output);
            self.push(file);
            callback();
          });

      });
    }
  }

  return through.obj(liquid);
};



/* EXAMPLE USAGE
var liquid = require('./tasks/liquid');
gulp.task('liquidify', function () {
  return gulp.src('app/*.html')
    .pipe($.frontMatter({property: 'page', remove: true}))
    .pipe(liquid())
    .pipe(gulp.dest('./dist'));
});
*/

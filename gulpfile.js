var gulp   = require('gulp')
  , path   = require('path')
  , merge  = require('event-stream').merge
  , series = require('stream-series')
  , runSequence = require('run-sequence')
  , map    = require('map-stream')
  , Crx    = require('crx')
  , del    = require('del')
  , $      = require('gulp-load-plugins')()
  , react  = require('gulp-react')

/**
 * Public tasks
 */
gulp.task('clean', function(cb) {
  del([
    './tmp'
  ], cb);
})

gulp.task('build', function(cb) {
  runSequence('clean', 'jsx', 'assets', 'css', 'html', 'chrome', cb)
  //runSequence('clean', 'css', 'chrome', 'opera', 'safari', 'firefox', cb)
})

gulp.task('default', ['build'], function() {
  gulp.watch(['./src/**/*'], ['default'])
})

gulp.task('dist', ['build'], function(cb) {
  runSequence('chrome:zip', 'chrome:crx', cb)
  //runSequence('firefox:xpi', 'chrome:zip', 'chrome:crx', 'opera:nex', cb)
})

/**
 * Private tasks
 */

gulp.task('jsx', function() {
  return gulp.src('src/ropeburn.jsx')
        .pipe(react())
        .pipe(gulp.dest('tmp'));
});

gulp.task('assets', function() {
  return pipe('./src/assets/**/*', './tmp')
});

gulp.task('css', function() {
  return pipe('./src/less/ropeburn.less', [$.less(), $.autoprefixer({ cascade: true })], './tmp')
});

gulp.task('html', function() {
  return pipe('./src/ropeburn.html', './tmp')
})

// Chrome
gulp.task('chrome:js', function() {
  return buildJs(['./src/chrome/storage.js'], { CHROME: true })
})

gulp.task('chrome', ['chrome:js'], function() {
  return merge(
    pipe('./icons/**/*', './tmp/chrome/icons'),
    pipe(['src/assets/**/*', './lib/**/*', './tmp/ropeburn.*', './src/chrome/**/*', '!./src/chrome/storage.js'], './tmp/chrome/')
  )
})

gulp.task('chrome:zip', function() {
  return pipe('./tmp/chrome/**/*', [$.zip('chrome.zip')], './dist')
})

gulp.task('chrome:_crx', function(cb) {
  $.run('"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"' +
        ' --pack-extension=' + path.join(__dirname, './tmp/chrome') +
        ' --pack-extension-key=' + path.join(process.env.HOME, '.ssh/chrome.pem')
  ).exec(cb)
})

gulp.task('chrome:crx', ['chrome:_crx'], function() {
  return pipe('./tmp/chrome.crx', './dist')
})

// Opera
gulp.task('opera', ['chrome'], function() {
  return pipe('./tmp/chrome/**/*', './tmp/opera')
})

gulp.task('opera:nex', function() {
  return pipe('./dist/chrome.crx', [$.rename('opera.nex')], './dist')
})

// Safari
gulp.task('safari:js', function() {
  return buildJs(['./src/safari/storage.js'], { SAFARI: true })
})

gulp.task('safari', ['safari:js'], function() {
  return merge(
    pipe('./icons/**/*', './tmp/safari/ropeburn.safariextension/icons'),
    pipe(['./lib/**/*', './tmp/ropeburn.js', './tmp/ropeburn.css',
          './src/safari/**/*', '!./src/safari/storage.js'], './tmp/safari/ropeburn.safariextension/')
  )
})

// Firefox
gulp.task('firefox:js', function() {
  return buildJs(['./src/firefox/storage.js'], { FIREFOX: true })
})

gulp.task('firefox', ['firefox:js'], function() {
  return merge(
    pipe('./icons/**/*', './tmp/firefox/data/icons'),
    pipe(['./lib/**/*', './tmp/ropeburn.js', './tmp/ropeburn.css'], './tmp/firefox/data'),
    pipe(['./src/firefox/firefox.js'], './tmp/firefox/lib'),
    pipe('./src/firefox/package.json', './tmp/firefox')
  )
})

gulp.task('firefox:xpi', function(cb) {
  $.run('cd ./tmp/firefox && cfx xpi --output-file=../../dist/firefox.xpi').exec(cb)
})

/**
 * Helpers
 */
function pipe(src, transforms, dest) {
  if (typeof transforms === 'string') {
    dest = transforms
    transforms = null
  }
  var stream = gulp.src(src)
  transforms && transforms.forEach(function(transform) {
    stream = stream.pipe(transform)
  })
  if (dest) stream = stream.pipe(gulp.dest(dest))
  return stream
}

function html2js(template) {
  return map(escape)

  function escape(file, cb) {
    var path = $.util.replaceExtension(file.path, '.js')
      , content = file.contents.toString()
      , escaped = content.replace(/\\/g, "\\\\")
                         .replace(/'/g, "\\'")
                         .replace(/\r?\n/g, "\\n' +\n    '")
      , body = template.replace('$$', escaped)
    file.path = path
    file.contents = new Buffer(body)
    cb(null, file)
  }
}

function buildJs(additions, ctx) {
  var src = additions.concat([
    './tmp/template.js',
    './src/constants.js',
    './src/adapter.github.js',
    './src/view.help.js',
    './src/view.error.js',
    './src/view.tree.js',
    './src/view.options.js',
    './src/util.location.js',
    './src/util.module.js',
    './src/util.async.js',
    './src/ropeburn.js',
  ])
  return pipe(src, [
    $.concat('ropeburn.js'),
    $.preprocess({ context: ctx })
  ], './tmp')
}

function buildTemplate(ctx) {
  return pipe('./src/template.html', [
    $.preprocess({ context: ctx }),
    html2js('const TEMPLATE = \'$$\'')
  ], './tmp')
}


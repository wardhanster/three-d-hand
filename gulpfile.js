'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');
var uglify = require('gulp-uglify');
var gulpif = require('gulp-if');
var notify = require('gulp-notify');
var argv = require('yargs').argv;

// sass
var sass = require('gulp-sass');
var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer-core');
var sourcemaps = require('gulp-sourcemaps');
// BrowserSync
var browserSync = require('browser-sync');
// js
var watchify = require('watchify');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var concat = require('gulp-concat-sourcemap');
// image optimization
var imagemin = require('gulp-imagemin');
// linting
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
//test
var karma = require('gulp-karma');

// gulp build --production
var production = !!argv.production;
// determine if we're doing a build
// and if so, bypass the livereload
var build = argv._.length ? argv._[0] === 'build' : false;
var watch = argv._.length ? argv._[0] === 'watch' : true;
 
// ----------------------------
// Error notification methods
// ----------------------------

var handleError = function(task) {
  //console.log('error called',task)//not sure why error handler is called?
  return function(err) {
    notify.onError({
      message: task + ' failed, check the logs..',
      sound: false
    })(err);
    
    gutil.log(gutil.colors.bgRed(task + ' error:'), gutil.colors.red(err));

  };
};
// --------------------------
// CUSTOM TASK METHODS
// --------------------------
var tasks = {
  // --------------------------
  // Delete build folder
  // --------------------------
  clean: function(cb) {
    del(['build/'], cb);
  },
  // --------------------------
  // Copy static assets
  // --------------------------
  assets: function() {
    return gulp.src('./src/assets/**/*')
      .pipe(gulp.dest('build/assets/'));
  },
  // --------------------------
  // HTML
  // --------------------------
  // html templates (when using the connect server)
  templates: function() {
    gulp.src('templates/*.html')
      .pipe(gulp.dest('build/'));
  },
  // --------------------------
  // SASS (libsass)
  // --------------------------
  sass: function() {
    return gulp.src('./src/sass/*.scss')
      // sourcemaps + sass + error handling
      .pipe(gulpif(!production, sourcemaps.init()))
      .pipe(sass({
        sourceComments: !production,
        outputStyle: production ? 'compressed' : 'nested'
      }))
      .on('error', handleError('SASS'))
      // generate .maps
      .pipe(gulpif(!production, sourcemaps.write({
        'includeContent': false,
        'sourceRoot': '.'
      })))
      // autoprefixer
      .pipe(gulpif(!production, sourcemaps.init({
        'loadMaps': true
      })))
      .pipe(postcss([autoprefixer({browsers: ['last 2 versions']})]))
      // we don't serve the source files
      // so include scss content inside the sourcemaps
      .pipe(sourcemaps.write({
        'includeContent': true
      }))
      // write sourcemaps to a specific directory
      // give it a file and save
      .pipe(gulp.dest('build/css'));
  },
  // --------------------------
  // Libs
  // --------------------------
  libs: function() {
    gulp.src('./src/js/vendor/*.js')
      .pipe(concat('libs.js'))
      .pipe(gulp.dest('build/js/'));
  },
  // --------------------------
  // Browserify
  // --------------------------
  browserify: function() {
    var bundler = browserify('./src/js/app.js', {
      debug: !production,
      cache: {}
    });
    // determine if we're doing a build
    // and if so, bypass the livereload
    var build = argv._.length ? argv._[0] === 'build' : false;
    if (watch) {
      bundler = watchify(bundler);
    }
    var rebundle = function() {
      tasks.lintjs();
      return bundler.bundle()
        .on('error', handleError('browserify'))
        .pipe(source('build.js'))
        .pipe(gulpif(production, buffer()))
        .pipe(gulpif(production, uglify()))
        .pipe(gulp.dest('build/js/'))
        .pipe(browserSync.reload({stream:true}));
    };
    bundler.on('update', rebundle);
    return rebundle();
  },
  // --------------------------
  // linting
  // --------------------------
  lintjs: function() {
    return gulp.src([
        // 'gulpfile.js', //the unused vars in the build flags throw lint errors
        './src/js/app.js',
        './src/js/*.js',
        './src/js/**/*.js',
        './tests/**/*.js',
        '!./src/js/vendor/*.js'
      ]).pipe(jshint())
      .pipe(jshint.reporter(stylish))
      .on('error', handleError('lint'));
  },
  // --------------------------
  // Optimize asset images
  // --------------------------
  optimize: function() {
    return gulp.src('./src/assets/**/*.{gif,jpg,png,svg}')
      .pipe(imagemin({
        progressive: true,
        svgoPlugins: [{removeViewBox: false}],
        // png optimization
        optimizationLevel: production ? 3 : 1
      }))
      .pipe(gulp.dest('./src/assets/'));
  },
  test: function(){
    var files = [
        // './src/js/**/*.js',
        './tests/**/*.js'
    ];
    return gulp.src(files)
    .pipe(karma({
      configFile: 'tests/karma.conf.js',
      action: 'run'
    }))
  }
 
 
};
 
gulp.task('browser-sync', function() {
    browserSync({
        server: {
            baseDir: "./build"
        },
        port: process.env.PORT || 3000
    });
});
 
gulp.task('reload-sass', ['sass'], function(){
  browserSync.reload();
});
// gulp.task('reload-js', ['browserify'], function(){
//   console.log('reloading javascript')
//   // browserSync.reload();
// });
gulp.task('reload-templates', ['templates'], function(){
  browserSync.reload();
});
 
// --------------------------
// CUSTOMS TASKS
// --------------------------
gulp.task('clean', tasks.clean);
// for production we require the clean method on every individual task
var req = build ? ['clean'] : [];
// individual tasks
gulp.task('templates', req, tasks.templates);
gulp.task('assets', req, tasks.assets);
gulp.task('sass', req, tasks.sass);
gulp.task('libs', tasks.libs);
gulp.task('browserify', req, tasks.browserify);
gulp.task('lint:js', tasks.lintjs);
gulp.task('optimize', tasks.optimize);
gulp.task('test', tasks.test);
 
// --------------------------
// DEV/WATCH TASK
// --------------------------
gulp.task('watch', ['assets', 'templates', 'sass', 'libs', 'browserify', 'browser-sync'], function() {
  // --------------------------
  // watch:sass
  // --------------------------
  gulp.watch('./src/sass/**/*.scss', ['reload-sass']);
 
  // --------------------------
  // watch:js
  // --------------------------
  // gulp.watch('./src/js/**/*.js', ['lint:js', 'reload-js']);
  // gulp.watch('./src/js/*.js', ['lint:js',  'reload-js']);
  // --------------------------
  // watch:html
  // --------------------------
  gulp.watch('./templates/**/*.html', ['reload-templates']);

  // --------------------------
  // watch:tests
  // --------------------------
  // gulp.watch('./tests/**/*.js', ['lint:js', 'test', 'reload-js']);

  //this isn't coming back on
 
  gutil.log(gutil.colors.bgGreen('Watching for changes...'));
});
 
// build task
gulp.task('build', [
  'clean',
  'templates',
  'assets',
  'sass',
  'libs',
  'browserify'
]);
 
gulp.task('default', ['watch']);
 
// gulp (watch) : for development and livereload
// gulp build : for a one off development build
// gulp build --production : for a minified production build
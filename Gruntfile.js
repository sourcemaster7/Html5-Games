function atob(str) {
    if (str) {
        return new Buffer(str, 'base64').toString('binary');
    }
    return null;
}

module.exports = function(grunt) {
    const startTS = Date.now();

    grunt.initConfig({

        /**
         * This will load in our package.json file so we can have access
         * to the project name and appVersion number.
         */
        pkg: grunt.file.readJSON('package.json'),

        /**
         * Use cmd to eslint.
         */
        exec: {
            eslint: {
                cmd: './node_modules/.bin/eslint --fix --ext .js, src',
            },
        },

        /**
         * Copies certain files over from the src folder to the build folder.
         */
        copy: {
            development: {
                expand: true,
                flatten: true,
                cwd: './',
                src: ['index.html'],
                dest: './lib/',
            },
            legacy: {
                src: ['./lib/main.min.js'],
                dest: './lib/libs/gd/api.js',
            },
        },

        /**
         * Cleans our build folder.
         */
        clean: {
            lib: {
                src: ['./lib'],
            },
        },

        /**
         * A code block that will be added to our minified code files.
         * Gets the name and appVersion and other info from the above loaded 'package.json' file.
         * @example <%= banner.join("\\n") %>
         */
        banner: [
            '/*',
            '* Project: <%= pkg.name %>',
            '* Description: <%= pkg.description %>',
            '* Development By: <%= pkg.author %>',
            '* Copyright(c): <%= grunt.template.today("yyyy") %>',
            '* Version: <%= pkg.version %> (<%= grunt.template.today("dd-mm-yyyy HH:MM") %>)',
            '*/',
        ],

        /**
         * Prepends the banner above to the minified files.
         */
        usebanner: {
            options: {
                position: 'top',
                banner: '<%= banner.join("\\n") %>',
                linebreak: true,
            },
            files: {
                src: [
                    'lib/main.min.js',
                ],
            },
        },

        /**
         * Browserify is used to support the latest version of javascript.
         * We also concat it while we're at it.
         * We only use Browserify for the mobile sites.
         */
        browserify: {
            options: {
                transform: [['babelify', {presets: ['env']}]],
            },
            lib: {
                src: 'src/**/*.js',
                dest: 'lib/main.js',
            },
            promo: {
                src: 'promo/promo.js',
                dest: 'lib/promo.js',
            },
        },

        /**
         * Do some javascript post processing, like minifying and removing comments.
         */
        uglify: {
            options: {
                position: 'top',
                linebreak: true,
                sourceMap: false,
                sourceMapIncludeSources: false,
                compress: {
                    sequences: true,
                    dead_code: true,
                    conditionals: true,
                    booleans: true,
                    unused: true,
                    if_return: true,
                    join_vars: true,
                },
                mangle: true,
                beautify: false,
                warnings: false,
            },
            lib: {
                src: 'lib/main.js',
                dest: 'lib/main.min.js',
            },
            promo: {
                src: 'lib/promo.js',
                dest: 'lib/promo.min.js',
            },
        },

        /**
         * Setup a simple watcher.
         */
        watch: {
            options: {
                spawn: false,
                debounceDelay: 250,
            },
            scripts: {
                files: ['src/**/*.js'],
                tasks: ['exec:eslint', 'browserify', 'uglify', 'duration'],
            },
            html: {
                files: ['index.html'],
            },
            grunt: {
                files: ['gruntfile.js'],
            },
        },

        /**
         * Start browser sync, which setups a local node server based on the server root location.
         * This task helps with cross browser testing and general workflow.
         */
        browserSync: {
            bsFiles: {
                src: [
                    'lib/',
                    'index.html',
                ],
            },
            options: {
                server: './',
                watchTask: true,
                port: 3000,
            },
        },
    });

    // General tasks.
    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-google-cloud');
    grunt.loadNpmTasks('grunt-browser-sync');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-banner');

    // Register all tasks.
    grunt.registerTask('duration',
        'Displays the duration of the grunt task up until this point.',
        function() {
            const date = new Date(Date.now() - startTS);
            let hh = date.getUTCHours();
            let mm = date.getUTCMinutes();
            let ss = date.getSeconds();
            if (hh < 10) {
                hh = '0' + hh;
            }
            if (mm < 10) {
                mm = '0' + mm;
            }
            if (ss < 10) {
                ss = '0' + ss;
            }
            console.log('Duration: ' + hh + ':' + mm + ':' + ss);
        });
    grunt.registerTask('sourcemaps',
        'Build with sourcemaps',
        function() {
            grunt.config.set('uglify.options.sourceMap', true);
            grunt.config.set('uglify.options.sourceMapIncludeSources', true);
        });
    grunt.registerTask('default',
        'Start BrowserSync and watch for any changes so we can do live updates while developing.',
        function() {
            const tasksArray = [
                'copy:development',
                'exec:eslint',
                'browserify',
                'sourcemaps',
                'uglify',
                'usebanner',
                'duration',
                'browserSync',
                'watch'];
            grunt.task.run(tasksArray);
        });
    grunt.registerTask('build',
        'Build and optimize the js.',
        function() {
            const tasksArray = [
                'clean',
                'exec:eslint',
                'browserify',
                'uglify',
                'usebanner',
                'copy:legacy',
                'duration'];
            grunt.task.run(tasksArray);
        });
    grunt.registerTask('promo',
        'Build and optimize the promo js.',
        function() {
            const tasksArray = [
                'exec:eslint',
                'browserify:promo',
                'uglify:promo',
                'duration'];
            grunt.task.run(tasksArray);
        });
    grunt.registerTask('deploy',
        'Upload the build files.',
        function() {
            const project = grunt.option('project'), // vooxe-gamedistribution
                bucket = grunt.option('bucket'), // gd-sdk-html5
                folderIn = grunt.option('in'), //
                folderOut = grunt.option('out'); //

            // The key is saved as a system parameter within Team City.
            // The service account key of our google cloud account for uploading to
            // storage is stringified and then encoded as base64 using btoa()
            // console.log(grunt.option('key'));
            let keyObj = grunt.option('key');
            let key = JSON.parse(atob(keyObj));
            // console.log(key);

            if (project === undefined) {
                grunt.fail.warn('Cannot upload without a project name');
            }

            if (bucket === undefined) {
                grunt.fail.warn('OW DEAR GOD THEY ARE STEALING MAH BUCKET!');
            }

            if (key === undefined || key === null) {
                grunt.fail.warn('Cannot upload without an auth key');
            } else {
                console.log('Key loaded...');
            }

            grunt.config.merge({
                gcs: {
                    options: {
                        credentials: key,
                        project: project,
                        bucket: bucket,
                        gzip: true,
                        metadata: {
                            'surrogate-key': 'gcs',
                        },
                    },
                    dist: {
                        cwd: './lib/',
                        src: ['**/*'],
                        dest: '',
                    },
                },
            });

            console.log('Project: ' + project);
            console.log('Bucket: ' + bucket);

            if (folderIn === undefined && folderOut === undefined) {
                console.log('Deploying: ./lib/ to gs://' + bucket + '/');
            } else {
                if (folderIn !== undefined) {
                    if (folderOut === undefined) {
                        grunt.fail.warn(
                            'No use in specifying "in" without "out"');
                    }
                    console.log('Deploying: ../' + folderIn + ' to gs://' +
                        bucket + '/' + folderOut);
                    grunt.config.set('gcs.dist', {
                        cwd: '../' + folderIn, src: ['**/*'], dest: folderOut,
                    });
                } else if (folderOut !== undefined) {
                    grunt.fail.warn('No use in specifying "out" without "in"');
                }
            }

            grunt.task.run('gcs');
        });
};

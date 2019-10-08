const chokidar = require('chokidar');
const {exec, execSync, spawnSync } = require('child_process');
const webpack = require('webpack');
const wpPot = require('wp-pot');
const path = require('path');
const fs = require('fs');
const getTextParser = require('gettext-parser');
const lodash = require('lodash');
const colors = require('colors');
const commandExists = require('command-exists').sync

module.exports = class WpPotPlugin {
    constructor (options) {
        this.options = options;
        this.potWatcher = {};
        this.poWatcher = {};
        this.phpWatcher = {};
        this.initialized = false;
        this.logPrefix = "[wp-webpack-translation-plugin]"

        if(!commandExists("msgmerge")) {
            throw `${this.logPrefix} 'msgmerge' command doesn't exist. Ensure, that you have gettext installed.`
        }
    }

    recursiveEmptyTranslationFill (object, currentTranslatableString) {
        for(let e in object) {
            if(e == "msgstr") {
                let has_translations = false;

                for(let a in object[e]) {
                    if(object[e][a].length > 0) {
                        has_translations = true;
                        break;
                    }
                }

                if(!has_translations) {
                    object[e] = [
                        currentTranslatableString
                    ];
                }

            } else if(typeof(object[e]) == "object") {
                object[e] = this.recursiveEmptyTranslationFill(object[e], e);
            }
        }

        return object;
    }

    generatePotFiles () {
        process.stdout.write(`${this.logPrefix} Generating pot files: `.white);

        let potFile = this.options.languagesDirectory + '/' + this.options.domain + '.pot';

        try {
            wpPot({
                destFile: potFile,
                domain  : this.options.domain,
                src     : this.options.phpDirectories
            });

            process.stdout.write("[Done]\n".green);
        } catch (error) {
            process.stdout.write("[ERROR]\n".red);
            console.log(("" + error).red);
        }
    }

    mergePotToPoFiles () {
        process.stdout.write(`${this.logPrefix} Merging pot files to po files: `.white);

        var files = fs.readdirSync(this.options.languagesDirectory);

        for(var f in files) {
            let file = files[f];
            let ext = path.extname(file);
            let filename = path.basename(file, ext);
            let poFile = this.options.languagesDirectory + '/' + file;
            let potFile = this.options.languagesDirectory + '/' + this.options.domain + '.pot';

            if (ext != ".po") {
                continue;
            }

            exec('msgmerge --force-po ' + poFile + ' ' + potFile + " -o " + poFile);
        }

        process.stdout.write("[Done]\n".green);
    }

    generatePoMoFiles () {
        process.stdout.write(`${this.logPrefix} Compiling po to mo files: `.white);

        var files = fs.readdirSync(this.options.languagesDirectory);

        for(var f in files) {
            let file = files[f];
            let ext = path.extname(file);
            let filename = path.basename(file, ext);
            let poFile = this.options.languagesDirectory + '/' + file;
            let moFile = this.options.languagesDirectory + '/' + filename + '.mo';

            if(ext != ".po") {
                continue;
            }

            let poFileContent = getTextParser.po.parse(fs.readFileSync(poFile));

            poFileContent = this.recursiveEmptyTranslationFill(poFileContent);

            let moFileContent = getTextParser.mo.compile(poFileContent);

            fs.writeFileSync(moFile, moFileContent);
        }

        process.stdout.write("[Done]\n".green);
    }

    runTranslationsGenerations () {
        this.generatePotFiles();
        this.mergePotToPoFiles();
        this.generatePoMoFiles();
    }

    apply (compiler) {
        if(lodash.isEmpty(this.options.phpDirectories)) {
            throw new Error("Options need a parameter 'phpDirectories', which contains the locations to watch php files.");
            return;
        }

        if(lodash.isEmpty(this.options.languagesDirectory)) {
            throw new Error("Options need a parameter 'languagesDirectory', which contains the location of the pot, po and mo files.");
            return;
        }

        if(lodash.isEmpty(this.options.domain)) {
            throw new Error("Options need a parameter 'domain', which is the domain name of the translations (and also .pot file name etc).");
            return;
        }

        if(compiler.options.watch) {
            this.runTranslationsGenerations();

            this.phpWatcher = chokidar.watch(this.options.phpDirectories);

            this.phpWatcher.on('change', (p) => {
                console.log(`\n${this.logPrefix} PHP file: ${path.basename(p)} changed.`.white);

                compiler.run(() => {
                    this.generatePotFiles();
                });
            });

            this.potWatcher = chokidar.watch(this.options.languagesDirectory + '/*.pot');

            this.potWatcher.on('change', (p) => {
                console.log(`\n${this.logPrefix} POT file: ${path.basename(p)} changed.`.white);

                compiler.run(() => {
                    this.mergePotToPoFiles();
                });
            });

            this.poWatcher = chokidar.watch(this.options.languagesDirectory + '/*.po');

            this.poWatcher.on('change', (p) => {
                console.log(`\n${this.logPrefix} POT file: ${path.basename(p)} changed.`.white);

                compiler.run(() => {
                    this.generatePoMoFiles();
                });
            });

            this.initialized = true;
        } else {
            this.runTranslationsGenerations();
        }
    }
};
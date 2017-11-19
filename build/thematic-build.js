var glob = require('glob');
var fs = require('fs');
var fsDir = require('fs-extra');
var prependFile = require('prepend-file');
var sass = require('node-sass');
var defer = require('promise-defer');
var themeConfig = require('../theme.config');

var config = {
    'outputDir': 'src/build/',
    'entryFiles': ['./src/app/*.scss'],

};

var ThemifyCss  = function(config, themeConfig){
    this.outputDir = config.outputDir;
    this.entryFiles = config.entryFiles ? config.entryFiles : [];
    this.themes = themeConfig.themes ? themeConfig.themes : [];
};

ThemifyCss.prototype.init = function(){
    var _this = this;
    this.clearOutputDir().then(function(){
        _this.buildCssForThemes(this.themes);
    });

};

ThemifyCss.prototype.clearOutputDir = function(){
    console.log('removing existing files...');
    return fsDir.remove(this.outputDir);
};

ThemifyCss.prototype.buildCssForThemes = function(){
    var _this = this;
    for(var i in _this.themes){
        _this.themes[i].outputDir = _this.outputDir + _this.themes[i].name + '/';
        fsDir.ensureDir(_this.themes[i].outputDir).then((function(idx){
            _this.processEntryFiles(_this.themes[idx]);
        })(i));
    }
};

ThemifyCss.prototype.processEntryFiles= function(theme) {
    var _this = this;
    for(var idx in _this.entryFiles){
        var entry = _this.entryFiles[idx];
        _this.getFilesToCompile(entry).then(function(fileList){
            for(var idx in fileList) {
                _this.compileScss(fileList[idx], theme);
            }
        });
    }
};

ThemifyCss.prototype.getFilesToCompile = function(entry) {
    var _this = this;
    var deferred = defer();
    glob(entry, {}, function(err,files){
        deferred.resolve(files);
    });
    return deferred.promise;
};

ThemifyCss.prototype.compileScss = function(file, theme){
    var _this = this;
    concatVars(theme.vars, file).then(function(fileToCompile){
        sass.render({
            file: fileToCompile,
            outputStyle: 'compressed',
            includePaths: ['./node_modules']
        }, function(error, result) { // node-style callback from v3.0.0 onwards
            if (error){ throw error;return;}
            var cssFileUrl = theme.outputDir + extractFileDetails(file).name + '.css';
            writeFile(cssFileUrl, result.css.toString());
            fsDir.remove(fileToCompile);
        });
    });
};

var writeFile = function(fileUrl, content){
    fs.writeFile(fileUrl, content, function (err) {
        if (err) throw err;
        console.log('generated....'+fileUrl);
    });
};

var concatVars = function(vars, file){
    var deferred = defer();
    var fileInfo = extractFileDetails(file);
    var dest = fileInfo.directory + fileInfo.name + '_temp.scss';
    fsDir.copy(file, dest, function(err) {
        if (err) throw err;
        prependFile(dest, prepareImportString([vars]), function(){
            deferred.resolve(dest);
        });
    });

    return deferred.promise;
};

var prepareImportString = function(importFiles){
    var importString = '';
    for(var idx in importFiles) {
        importString += '@import "' + importFiles[idx] + '";\n';
    }
    console.log(importString);
    return importString;
}



var extractFileDetails= function(filePath){
    var filePathParts =  filePath.split('/'),
        fileName = filePathParts[filePathParts.length-1].split('.')[0],
        fileDir = filePath.substring(0,filePath.lastIndexOf('/')+1);
    return {
        'name': fileName,
        'directory': fileDir
    }
};

try{
    var thmify = new ThemifyCss(config, themeConfig);
    thmify.init();

}catch(err) {
    console.log(err);
}


"use strict";

/* Helpful DEM constants. */
const SIZE_INT = 6;
const SIZE_REAL4 = 12;
const SIZE_REAL8 = 24;
const BLOCK_SIZE = 1024;

/** Global object holds all the necessary DEM data. */
var DEMObj = {profiles: [], heights: []};

/** Top-level event listener. */
function readDemFile(filename, callback) {
    var reader = new FileReader();

    readRecA(reader, filename, [
        new Datum("cellname", String, 1, 40),
        new Datum("gunit", Number, 529, 6),
        new Datum("zunit", Number, 535, 6),
        new Datum("xsw", Number, 547, 24),
        new Datum("ysw", Number, 571, 24),
        new Datum("xnw", Number, 595, 24),
        new Datum("ynw", Number, 619, 24),
        new Datum("xne", Number, 643, 24),
        new Datum("yne", Number, 667, 24),
        new Datum("xse", Number, 691, 24),
        new Datum("yse", Number, 715, 24),
        new Datum("hmin", Number, 739, 24),
        new Datum("hmax", Number, 763, 24),
        new Datum("xres", Number, 817, 12),
        new Datum("yres", Number, 829, 12),
        new Datum("zres", Number, 841, 12),
        new Datum("nrows", Number, 853, 6),
        new Datum("ncols", Number, 859, 6),
    ], callback);
}
/** Represents a datum field from the DEM file. */
function Datum(name, type, start, size) {
    this.name = name;
    this.Type = type;
    this.startByte = start - 1;
    this.endByte = this.startByte + size;
}
Datum.prototype.parse = function (str) {
    return this.Type(str.replace("D+", "E+").trim());
};

/** Represents a datum field from the DEM file. */
function Profile(dem, id, rows, xgp, ygp, ebase, hmin, hmax) {
    this.dem = dem;
    this.id = id;
    this.ebase = ebase;
    this.coords = [xgp, ygp];
    this.bounds = [hmin, hmax];
    this.points = [];
}
Profile.prototype.push = function (elev) {
    var xp = this.id * this.dem.xres;
    var yp = this.points.length * this.dem.yres;
    this.points.push(vec3(
        //((this.coords[0] - Math.floor(this.dem.xnw)) - (this.dem.xres * (this.dem.ncols - 1) / 2)),
        //((this.coords[1] + yp - Math.floor(this.dem.ysw)) - (this.dem.yres * (this.dem.nrows - 1) / 2)),
        xp - (this.dem.xres * (this.dem.ncols - 1) / 2),
        yp - Math.floor(this.dem.ynw - this.dem.ysw) / 2,
        //yp - (this.dem.yres * (this.dem.nrows - 1) / 2),
        elev * this.dem.zres
    ));
};

/** Find and parse one field from Logical Record Type A. */
function readRecA(reader, file, data, callback) {
    var datum = data.shift();
    reader.onload = function (evt) {
        DEMObj[datum.name] = datum.parse(evt.target.result);
        if (data.length) {
            readRecA(reader, file, data, callback);
        }
        else {
            readRecB(reader, file, datum.endByte, callback);
        }
    };

    reader.readAsText(file.slice(datum.startByte, datum.endByte));
}

/** Find and parse one Logical Record Type B. */
function readRecB(reader, file, prevEnd, callback) {
    var startPos = nextBlockStart(prevEnd);
    var endPos = startPos + 4 * SIZE_INT + 3 * SIZE_REAL8;

    reader.onload = function (evt) {
        var tokens = evt.target.result.split(' ').filter(function (x) {
            return x.length > 0;
        });
        var values = tokens.map(function (x) {
            return parseFloat(x.replace("D+", "E+"));
        });
        var colnum = values[1] - 1;
        var colsize = Math.min(values[2], 1387);
        if (colnum < DEMObj.ncols - 1) {
            DEMObj.profiles.push(new Profile(
                DEMObj, colnum, colsize, values[4], values[5], values[6]
            ));
            //DEMObj.heights.push([]);
            readElevs(reader, file, colnum, endPos, colsize, callback);
        } else {
            doneReading(callback);
        }
    };

    reader.readAsText(file.slice(startPos, endPos));
}

/** Read all elevations for a given column. */
function readElevs(reader, file, i, curPos, numLeft, callback) {
    var startPos = blockStart(curPos) + 144;
    var endPos = startPos + bytesUsed(numLeft);

    reader.onload = function (evt) {
        var j = 0, str = evt.target.result;
        while (j < str.length) {
            DEMObj.profiles[DEMObj.profiles.length - 1].push(Number(str.slice(j, j + 6)));
            //DEMObj.heights[DEMObj.heights.length-1].push(Number(str.slice(j, j+6)));
            j += (j % 1024 === 870 ? 10 : 6);
        }
        if (i + 1 < DEMObj.ncols) {
            readRecB(reader, file, endPos, callback);
        }
        else {
            doneReading(callback);
        }
    };

    reader.readAsText(file.slice(startPos, endPos));
}

/** Normalize some of the raw data before moving on. */
function doneReading(callback) {
    var maxLen = DEMObj.profiles.reduce(function (acc, x) {
        return Math.max(acc, x.points.length);
    }, 0);
    //var maxLen = DEMObj.heights.reduce(function(acc,x){return Math.max(acc,x.length);}, 0);
    while (DEMObj.profiles[0].points.length < maxLen) {
        DEMObj.profiles.shift();
    }
    while (DEMObj.profiles[DEMObj.profiles.length - 1].points.length < maxLen) {
        DEMObj.profiles.pop();
    }
    /*while (DEMObj.heights[0].length < maxLen) {
        DEMObj.heights.shift();
        DEMObj.profiles.shift();
    }
     while (DEMObj.heights[DEMObj.heights.length-1].length < maxLen) {
        DEMObj.heights.pop();
        DEMObj.profiles.pop();
     }*/
    DEMObj.ncols = DEMObj.profiles.length;
    DEMObj.nrows = DEMObj.profiles[0].points.length;
    DEMObj.points = [];
    DEMObj.profiles.forEach(function (prof) {
        DEMObj.points.push(prof.points);
        //Array.prototype.push.apply(DEMObj.points, prof.points);
        //delete prof.points;
    });
    //DEMObj.nrows = DEMObj.heights[0].length;
    //DEMObj.hmax = DEMObj.hmax * DEMObj.zres;
    //DEMObj.hmin = DEMObj.hmin * DEMObj.zres;
    /*DEMObj.xres = DEMObj.xres / DEMObj.zres;
    DEMObj.yres = DEMObj.yres / DEMObj.zres;
     DEMObj.xmax = (DEMObj.ncols-1) * DEMObj.xres / 2;
     DEMObj.ymax = (DEMObj.nrows-1) * DEMObj.yres / 2;
    DEMObj.xmin = -DEMObj.xmax;
     DEMObj.ymin = -DEMObj.ymax;*/
    DEMObj.xmax = DEMObj.xres * (DEMObj.ncols - 1) / 2;
    DEMObj.xmin = -DEMObj.xmax;
    DEMObj.ymax = DEMObj.yres * (DEMObj.nrows - 1) / 2;
    DEMObj.ymin = -DEMObj.ymax;
    console.log("Done reading!");
    callback(DEMObj);
}

// Auxiliary functions

function blockStart(curPos) {
    return BLOCK_SIZE * Math.floor(curPos / BLOCK_SIZE);
}

function nextBlockStart(curPos) {
    return (curPos % BLOCK_SIZE === 0 ? curPos : (curPos + (BLOCK_SIZE - curPos % BLOCK_SIZE)));
}

function bytesUsed(numElevs) {
    return numElevs * 6 + (numElevs > 146 ? 4 : 0) + 4 * Math.max(0, Math.floor((numElevs - 146) / 170));
}


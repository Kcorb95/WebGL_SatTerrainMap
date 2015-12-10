"use strict";

var restart = true;
var orthoProj, perspProj;
var eye, ref, up = vec3(0, 0, 1);
var sunDir = vec3(1, 0, 1);
var sunColor = vec4(1, 1, 0.9, 1);

/* Initialize global WebGL stuff - not object specific */
function initGL(dem) {
    // local variable to hold a reference to an HTML5 canvas
    var canvas = document.getElementById("gl-canvas");

    // obtain a WebGL context bound to our canvas
    var gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
    }

    canvas.width = canvas.height = Math.min(
        parseInt(window.getComputedStyle(canvas, null).getPropertyValue("width")),
        parseInt(window.getComputedStyle(canvas, null).getPropertyValue("height"))
    );
    gl.viewport(0, 0, canvas.width, canvas.height); // use the whole canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // background color
    gl.enable(gl.DEPTH_TEST);

    eye = vec3(2 * dem.ymax, 2 * dem.xmax, 2 * dem.hmax);
    ref = vec3(0, 0, dem.hmin);

    // Set up a simple oblique, orthographic projection matrix
    var vmin = 1.2 * Math.min(dem.xmin, dem.ymin),
        vmax = 1.2 * Math.max(dem.xmax, dem.ymax);

    orthoProj = ortho(vmin, vmax, vmin, vmax, -100000, 100000);
    perspProj = perspective(30, (canvas.width / canvas.height), 1, 1000000);

    return gl; // send this back so that other parts of the program can use it
}

/* Load shaders and initialize attribute pointers. */
function loadShaderProgram(gl) {
    // use the existing program if given, otherwise use our own defaults
    var program = initShaders(gl, "vertex-shader", "fragment-shader");

    // get the position attribute and save it to our program object
    //   then enable the vertex attribute array
    program.vposLoc = gl.getAttribLocation(program, "vPosition");
    gl.enableVertexAttribArray(program.vposLoc);

    // get address of the vertex normal attribute
    program.nposLoc = gl.getAttribLocation(program, "vNormal");
    gl.enableVertexAttribArray(program.nposLoc);

    // get the address of the uniform variable and save it to our program object
    program.projLoc = gl.getUniformLocation(program, "proj");
    program.camLoc = gl.getUniformLocation(program, "cam");

    // get the address of the uniform variable and save it to our program object
    program.loColorLoc = gl.getUniformLocation(program, "loColor");
    program.hiColorLoc = gl.getUniformLocation(program, "hiColor");

    program.sunDirLoc = gl.getUniformLocation(program, "sunDir");
    program.sunColLoc = gl.getUniformLocation(program, "sunColor");

    // get the address of the uniform variable and save it to our program object
    program.objRotLoc = gl.getUniformLocation(program, "objRot");

    program.hminLoc = gl.getUniformLocation(program, "hmin");
    program.hmaxLoc = gl.getUniformLocation(program, "hmax");

    return program; // send this back so that other parts of the program can use it
}

/* Global render callback to draw all objects */
function render(drawables, gl) {
    restart = false;

    // inner-scoped function for closure trickery
    function renderScene() {
        if (restart) {
            return;
        }

        // queue up this same callback for the next frame
        requestAnimFrame(renderScene);

        // start from a clean frame buffer for this frame
        gl.clear(gl.COLOR_BUFFER_BIT);

        drawables.forEach(function (obj) { // loop over all objects and draw each
            obj.draw(gl);
        });
    }

    renderScene();
}

/* Constructor for a grid object (initializes the data). */
function Grid(gl, program, dem, img) {
    this.gl = gl;
    this.program = program; // save my shader program
    this.dem = dem;
    this.data = mkstrip(dem); // this array will hold raw vertex positions

    this.vBufferId = gl.createBuffer(); // reserve a buffer object and store a reference to it
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vBufferId); // set active array buffer
    gl.bufferData(gl.ARRAY_BUFFER, flatten(this.data.vertices), gl.STATIC_DRAW);

    this.nBufferId = gl.createBuffer(); // reserve a buffer object and store a reference to it
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBufferId); // set active buffer
    gl.bufferData(gl.ARRAY_BUFFER, flatten(this.data.normals), gl.STATIC_DRAW);

    this.eBufferId = gl.createBuffer(); // reserve a buffer object and store a reference to it
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eBufferId); // set active array buffer
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.data.indices), gl.STATIC_DRAW);
}

/* Method allows an object to render itself */
Grid.prototype.draw = function (gl) {
    gl.useProgram(this.program); // set the current shader programs

    eye[2] = this.dem.hmax * Math.pow(document.querySelector("#camHgt").value, 2);
    var modelview = lookAt(eye, ref, up);
    gl.uniformMatrix4fv(this.program.camLoc, gl.FALSE, flatten(modelview));

    gl.uniform1f(this.program.hminLoc, this.dem.hmin);
    gl.uniform1f(this.program.hmaxLoc, this.dem.hmax);

    // send this object's color down to the GPU as a uniform variable
    gl.uniform3fv(this.program.sunDirLoc, flatten(normalize(sunDir)));
    gl.uniform4fv(this.program.sunColLoc, flatten(sunColor));

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vBufferId); // set pos buffer active
    gl.vertexAttribPointer(this.program.vposLoc, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBufferId); // set pos buffer active
    gl.vertexAttribPointer(this.program.nposLoc, 3, gl.FLOAT, false, 0, 0);

    // render the primitives!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eBufferId); // set pos buffer active
    gl.drawElements(gl.TRIANGLE_STRIP, this.data.indices.length, gl.UNSIGNED_SHORT, 0);
};

/* Build a grid with random heights using triangle strips. */
function mkstrip(dem) {
    var i, j, h;
    var NCOLS = dem.points.length, NROWS = dem.points[0].length;
    var vertices = dem.points; // to hold the individual coordinate triples
    var indices = []; // to specify the order in which to draw vertices for a triangle strip
    var normals = [];

    for (i = 0; i < (NCOLS - 1) * NROWS; i++) {
        indices.push(i, i + NROWS);
        if (i % NROWS == (NROWS - 1)) {
            indices.push(i + NROWS, i + 1);
        }
    }

    // compute surface normal vectors for each point in the grid
    var a, b, n;
    for (i = 0; i < NCOLS; i++) {
        for (j = 0; j < NROWS; j++) {
            n = vec3(0, 0, 0);
            if (i > 0) {
                a = subtract(vertices[i - 1][j], vertices[i][j]);
                if (j > 0) {
                    b = subtract(vertices[i][j - 1], vertices[i][j]);
                    n = add(n, cross(a, b));
                }
                if (j < NROWS - 1) {
                    //b = subtract(vertices[i][j+1], vertices[i][j]);
                    b = subtract(vertices[i - 1][j + 1], vertices[i][j]);
                    n = add(n, cross(b, a));
                }
            }
            if (i < NCOLS - 1) {
                a = subtract(vertices[i + 1][j], vertices[i][j]);
                if (j > 0) {
                    //b = subtract(vertices[i][j-1], vertices[i][j]);
                    b = subtract(vertices[i + 1][j - 1], vertices[i][j]);
                    n = add(n, cross(b, a));
                }
                if (j < NROWS - 1) {
                    b = subtract(vertices[i][j + 1], vertices[i][j]);
                    n = add(n, cross(a, b));
                }
            }
            normals.push(normalize(n));
        }
    }
    return {vertices: vertices, indices: indices, normals: normals};
}

function initListeners(gl, prog) {
    gl.useProgram(prog); // set the current shader programs

    var projToggle = document.querySelector("#perspOn");
    projToggle.addEventListener("change", function () {
        var projection = this.checked ? perspProj : orthoProj;
        gl.useProgram(prog); // set the current shader programs
        gl.uniformMatrix4fv(prog.projLoc, gl.FALSE, flatten(projection));
    });
    gl.uniformMatrix4fv(prog.projLoc, gl.FALSE, flatten(orthoProj));

    var rotSlider = document.querySelector("#rotateSlider");
    rotSlider.addEventListener("input", function () {
        var angle = this.value;
        gl.useProgram(prog); // set the current shader programs
        gl.uniformMatrix4fv(prog.objRotLoc, gl.FALSE,
            flatten(rotate(angle, vec3(0, 0, 1))));
    });
    gl.uniformMatrix4fv(prog.objRotLoc, gl.FALSE,
        flatten(rotate(rotSlider.value, vec3(0, 0, 1))));

    var loColorChooser = document.querySelector("#loColor");
    loColorChooser.addEventListener("change", function () {
        gl.useProgram(prog); // set the current shader programs
        gl.uniform3fv(prog.loColorLoc, hexToRgb(this.value));
    });
    gl.uniform3fv(prog.loColorLoc, hexToRgb(loColorChooser.value));

    var hiColorChooser = document.querySelector("#hiColor");
    hiColorChooser.addEventListener("change", function () {
        gl.useProgram(prog); // set the current shader programs
        gl.uniform3fv(prog.hiColorLoc, hexToRgb(this.value));
    });
    gl.uniform3fv(prog.hiColorLoc, hexToRgb(hiColorChooser.value));
}

function initScene(dem) {
    var gl = initGL(dem); // basic WebGL setup for the scene
    // local variable to hold reference to our WebGL context
    var prog = loadShaderProgram(gl);

    initListeners(gl, prog);

    document.querySelector("#cellname").innerHTML = dem.cellname;

    var drawables = []; // used to store a list of objects that need to be drawn

    // create a grid object and add it to the list
    drawables.push(new Grid(gl, prog, dem, this));
    console.log("Done building");//debug for when grid is finished building
    render(drawables, gl); // start drawing the scene
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255
    ] : null;
}

/* Set up event callback to start the application */
window.onload = function () {
    document.querySelector("#files").addEventListener("change", function () {
        var files = document.querySelector("#files").files;
        if (files.length) {
            restart = true;
            readDemFile(files[0], initScene);
        } else {
            alert("Please select a file!");
        }
    });
};


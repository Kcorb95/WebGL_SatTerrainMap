var projectionMatrix; // global variable to hold the projection matrix
var modelViewMatrix;
var program;
var nHeights = [];
// Set up a simple oblique, orthographic projection matrix
                     //left,right,bottom,top,near,far
projectionMatrix = ortho(-30000, 30000, -30000, 30000, -500000, 500000);
projectionMatrix = mult(projectionMatrix, rotate(-75, vec3(1, 0, 0)));
projectionMatrix = mult(projectionMatrix, rotate(30, vec3(0, 0, 1)));

var theta =[0, 0, 0];//Can be later changed if needed to rotate on multiple different axis

/* Initialize global WebGL stuff - not object specific */
function initGL() {
    // local variable to hold a reference to an HTML5 canvas
    var canvas = document.getElementById("gl-canvas");

    // obtain a WebGL context bound to our canvas
    var gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height); // use the whole canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // background color
    gl.enable(gl.DEPTH_TEST); // make sure the GPU draw back to front

    return gl; // send this back so that other parts of the program can use it
}

/* Load shaders and initialize attribute pointers. */
function loadShaderProgram(gl) {
    // use the existing program if given, otherwise use our own defaults
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    // get the position attribute and save it to our program object
    //   then enable the vertex attribute array
    program.vposLoc = gl.getAttribLocation(program, "vPosition");
    gl.enableVertexAttribArray(program.vposLoc);
    // get the address of the uniform variable and save it to our program object
    program.colorLoc = gl.getUniformLocation(program, "color");
    program.color2Loc = gl.getUniformLocation(program, "color2");


    // get the address of the uniform variables and save it to our program object
    program.projLoc = gl.getUniformLocation(program, "projectionMatrix");
    program.modVLoc = gl.getUniformLocation(program, "modelViewMatrix");

    program.nHeightsLoc = gl.getUniformLocation(program, "nHeights");


    return program; // send this back so that other parts of the program can use it
}

/* Global render callback to draw all objects */
function renderToContext(drawables, gl) {
    // inner-scoped function for closure trickery
    function renderScene() {
        renderToContext(drawables, gl);
    }

    // start from a clean frame buffer for this frame
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    drawables.forEach(function (obj) { // loop over all objects and draw each
        obj.draw(gl);
    });

    modelViewMatrix = rotate(theta[1], [0, 0, 1] );//rotates the model around the z axis
    
    gl.uniformMatrix4fv( gl.getUniformLocation(program, "modelViewMatrix"), false, flatten(modelViewMatrix) );       
    gl.uniformMatrix4fv(program.projLoc, false, flatten(projectionMatrix));
    
    // queue up this same callback for the next frame
    requestAnimFrame(renderScene);
}

/* Constructor for a triangle strip object (initializes the data). */
function TriStrip(gl, program, color, color2) {
    this.program = program; // save my shader program
    this.color = color; // the color of this triangle strip surface
    this.color2 = color2;
    this.vertices = mkStrip(); // this array will hold raw vertex positions
    this.vBufferId = gl.createBuffer(); // reserve a buffer object and store a reference to it

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vBufferId); // set active array buffer
    // pass data to the graphics hardware (convert JS Array to a typed array)
    gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
}

/* Method allows an object to render itself */
TriStrip.prototype.draw = function (gl) {
    gl.useProgram(this.program); // set the current shader programs

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vBufferId); // set pos buffer active
    // map position buffer data to the corresponding vertex shader attribute
    gl.vertexAttribPointer(this.program.vposLoc, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribPointer(this.program.vpos2Loc, 3, gl.FLOAT, false, 0, 0);

    // send this object's color down to the GPU as a uniform variable
    gl.uniform4fv(this.program.colorLoc, flatten(this.color));
    gl.uniform4fv(this.program.color2Loc, flatten(this.color2));

    gl.uniform1f(this.program.nHeightsLoc, nHeights);

    // render the primitives!
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.vertices.length);
}

/* Build a triangle strip with random heights. */
function mkStrip() {
    var i, j;
    var vertices = []; // to hold the vertices to be drawn as tri-strips

    
    // generate a thin grid using the number of rows and columns from dat file with random heights
    for (i = 0; i < nrows; i++) {
        for (j = 0; j < ncols; j++) {
            var zHeight = heights[j][i];
            vertices.push(vec3(xmin + j * xres, ymin + i * yres, zHeight)); // scale grid so that the x and y coordinates vary between xmin and xmax, ymin and ymax
            vertices.push(vec3(xmin + (j + 1) * xres, ymin + i * yres, zHeight)); // scale grid so that the x and y coordinates vary between xmin and xmax, ymin and ymax
            nHeights.push(zHeight / hmax);
        }            
        // need to repeat the ending points to make degenerate triangle ("stutter"), this will be two extra vertices
    }
    return vertices;
}

/* Set up event callback to start the application */
window.onload = function () {

    // local variable to hold reference to our WebGL context
    var gl = initGL(); // basic WebGL setup for the scene
    var prog = loadShaderProgram(gl);

    // event listener on the button will set the color of each drawable object
    document.getElementById("colorBtn").addEventListener("click", function () {
        var color = vec4(document.getElementById("redIn").value,
                          document.getElementById("greenIn").value,
                          document.getElementById("blueIn").value,
                          1.0);
        drawables.forEach(function (obj) {
            obj.color = color;
        });
    });

    document.getElementById("colorBtn2").addEventListener("click", function () {
        var color2 = vec4(document.getElementById("redIn2").value,
                          document.getElementById("greenIn2").value,
                          document.getElementById("blueIn2").value,
                          1.0);
        drawables.forEach(function (obj) {
            obj.color2 = color2;
        });
    });
    
    document.getElementById("rotateLeft").addEventListener("click", function () { theta[1] -= 5.0; });

    document.getElementById("rotateRight").addEventListener("click", function () { theta[1] += 5.0; });

    var drawables = []; // used to store a list of objects that need to be drawn

    // create a triangle strip object and add it to the list of objects to draw
    drawables.push(new TriStrip(gl, prog, vec4(1, 0, 0, 1), vec4(0, 1, 0, 1)));

    renderToContext(drawables, gl); // start drawing the scene
}
/* Initialize global WebGL stuff - not object specific */
function initGL() {
    // local variable to hold a reference to an HTML5 canvas
    var canvas = document.getElementById("gl-canvas");

    // obtain a WebGL context bound to our canvas
    var gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height); // use the whole canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // background color

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
    // get the address of the uniform variable and save it to our program object
    program.colorLoc = gl.getUniformLocation(program, "color");

    return program; // send this back so that other parts of the program can use it
}

/* Global render callback to draw all objects */
function renderToContext(drawables, gl) {
    // inner-scoped function for closure trickery
    function renderScene() {
        renderToContext(drawables, gl);
    }

    // start from a clean frame buffer for this frame
    gl.clear(gl.COLOR_BUFFER_BIT);

    drawables.forEach(function (obj) { // loop over all objects and draw each
        obj.draw(gl);
    });

    // queue up this same callback for the next frame
    requestAnimFrame(renderScene);
}

/* Constructor for a triangle strip object (initializes the data). */
function TriStrip(gl, program, color) {
    this.program = program; // save my shader program
    this.color = color; // the color of this triangle strip surface
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

    // send this object's color down to the GPU as a uniform variable
    gl.uniform4fv(this.program.colorLoc, flatten(this.color));

    // render the primitives!
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.vertices.length);
}

/* Build a triangle strip with random heights. */
function mkStrip() {
    var height, i; // best practice in JS is to declare our variables up front
    var points = []; // to hold the individual coordinate triples
    var vertices = []; // to hold the vertices to be drawn as tri-strips
    var triangleStrip = [];
    var cols = 4, rows = 3;

    var numVertGrid = 2 * cols * (rows - 1);
    var numVertStrip = 2 * cols * (rows - 1) + 2 * (rows - 2);
    numVertices = numVertStrip;
    var j = 0;
    var y = 1;
    for (var i = 1; i <= numVertGrid; i += 2) {
        height = Math.random();
        triangleStrip.push(vec3(((1 + i) / 2), y, height));
        triangleStrip.push(vec3(((cols * 2 + i + 1) / 2), y-0.4, height));
        if (triangleStrip[j + 1] % cols == 0) {//wont be able to do anything because datatype is vec3 not a number mv.js might have something
            if (triangleStrip[j + 1] != cols && triangleStrip[j + 1] != cols * rows) {
                triangleStrip.push(triangleStrip[j + 1]);
                triangleStrip.push(vec3(((1 + i + 2) / 2), y-0.8, height));
                j += 2;
            }
        }
        y-=0.4
        j += 2;
    }


    // generate a thin 2x10 grid of points with random heights
        for (i = 0; i < 11; i++) {
            height = Math.random();
            points.push(vec3(-1.0 + i * 0.2, .2, height));
        }
        for (i = 0; i < 11; i++) {
            height = Math.random();
            points.push(vec3(-1.0 + i * 0.2, -.2, height));
        }

    // fill up the vertices array with the necessary points
    for (i = 0; i < 11; i++) {
        vertices.push(points[i], points[i + 11]);
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

    var drawables = []; // used to store a list of objects that need to be drawn

    // create a triangle strip object and add it to the list
    drawables.push(new TriStrip(gl, prog, vec4(1, 0, 0, 1)));

    renderToContext(drawables, gl); // start drawing the scene
}
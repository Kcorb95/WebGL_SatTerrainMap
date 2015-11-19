var projectionMatrix; // global variable to hold the projection matrix
var modelViewMatrix; //global variable that holds the model view matrix
var program;

//zoom is a multiplier to be applied to the default zoom level (45 or 55000) that will either increase or decrease the value giving a zoom effect
var zoom = 1;
var cHeight;//the camera z value in eye. The height is determined by the hMax value of the DEM file. It is then multiplied by a value to increase or decrease the height.
//flag for switching camera modes
var cMode = 0;//0 = persp, 1 = ortho
var eye, at, up;

var theta = [0, 0, 0];//Can be later changed if needed to rotate on multiple different axis

var lightPosition = vec4(1.0, 1.0, 1.0, 0.0);


/* Initialize global WebGL stuff - not object specific */
function initGL() {
    // local variable to hold a reference to an HTML5 canvas
    var canvas = document.getElementById("gl-canvas");

    // obtain a WebGL context bound to our canvas
    var gl = WebGLUtils.setupWebGL(canvas);
    if (!gl)
        alert("WebGL isn't available");

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

    program.hminLoc = gl.getUniformLocation(program, "hmin");
    program.hmaxLoc = gl.getUniformLocation(program, "hmax");

    return program; // send this back so that other parts of the program can use it
}

/* Global render callback to draw all objects */
function render(drawables, gl) {
    // inner-scoped function for closure trickery
    function renderScene() {
        render(drawables, gl);
    }

    // start from a clean frame buffer for this frame
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    eye = vec3(60000, 90000, cHeight);//camera's location just outside grid boundries.
    //eye = vec3(-25500, -25500, cHeight);//camera's location just outside grid boundries.
    at = vec3(0.0, 0.0, 0.0);//where camera focuses on (center of grid)
    //at = vec3(-40000, -40000, 0.0);//where camera focuses on (center of grid)
    up = vec3(0.0, 0.0, 1.0);//which direction is up (in this case Z)

    /* if cMode is 0 we want perspective view. If not we have a 1, and want orthographic view.*/
    if (cMode == 0)
        projectionMatrix = perspective(45.0 * zoom, (gl.canvas.width / gl.canvas.height), 1, 500000);
    else
        projectionMatrix = ortho(-55000 * zoom, 55000 * zoom, -55000 * zoom, 55000 * zoom, 1, 500000);

    modelViewMatrix = mult(lookAt(eye, at, up), rotate(theta[2], [0, 0, 1]));//rotates the model around the z axis


    drawables.forEach(function (obj) { // loop over all objects and draw each
        obj.draw(gl);
    });

    gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelViewMatrix"), false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(program.projLoc, false, flatten(projectionMatrix));

    // queue up this same callback for the next frame
    requestAnimFrame(renderScene);
}

/* Constructor for a triangle strip object (initializes the data). */
function Grid(gl, program, color, color2) {
    this.program = program;//Saves shader program for use in method
    this.color = color; //The primary color of the grid surface
    this.color2 = color2;//The secondary color of the grid surface
    this.vertices = makeStrip();//Array to hold vertex positions

    this.nBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices.normals), gl.STATIC_DRAW);

    this.vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(this.vNormal, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.vNormal);

    this.vBufferId = gl.createBuffer(); // reserve a buffer object and store a reference to it
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vBufferId); // set active array buffer
    // pass data to the graphics hardware (convert JS Array to a typed array)
    gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices.vertices), gl.STATIC_DRAW);

    this.eBufferId = gl.createBuffer(); // reserve a buffer object and store a reference to it
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eBufferId); // set active array buffer
    // pass data to the graphics hardware (convert JS Array to a typed array)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.vertices.indices), gl.STATIC_DRAW);

}

/* Method allows an object to render itself */
Grid.prototype.draw = function (gl) {
    gl.useProgram(this.program); // set the current shader programs

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vBufferId); // set pos buffer active
    // map position buffer data to the corresponding vertex shader attribute
    gl.vertexAttribPointer(this.program.vposLoc, 3, gl.FLOAT, false, 0, 0);

    gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"),
        flatten(lightPosition));

    // send this object's color down to the GPU as a uniform variable
    gl.uniform4fv(this.program.colorLoc, flatten(this.color));
    gl.uniform4fv(this.program.color2Loc, flatten(this.color2));
    //sends the hmin and hmax values to the vertex shader as a float for normalizing heights and setting blending.
    gl.uniform1f(program.hminLoc, DEMObj.hmin);
    gl.uniform1f(program.hmaxLoc, DEMObj.hmax);

    // render the primitives!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eBufferId); // set pos buffer active
    gl.drawElements(gl.TRIANGLE_STRIP, this.vertices.indices.length, gl.UNSIGNED_SHORT, 0);
};

/* Build a triangle strip with random heights. */
function makeStrip() {
    //Setting variables for x/y min/res so we dont have to call it over and over in every loop
    var xmin = DEMObj.xmin;
    var ymin = DEMObj.ymin;
    var xres = DEMObj.xres;
    var yres = DEMObj.yres;
    var nrows = 1387;
    var ncols = 47;
    var vertices = []; // to hold the vertices to be drawn as tri-strips
    var indices = []; // to specify the order in which to draw vertices for a triangle strip
    var normals = [];

    // generate a thin grid using the number of rows and columns from dat file with random heights
    for (var i = 0; i < DEMObj.ncols - 1; i++) {
        for (var j = 0; j < DEMObj.nrows; j++) {
            //for (i = 566; i < (566+ncols) - 1; i++) {
            //    for (j = 364; j < (364+nrows); j++) {
            vertices.push(vec3(xmin + i * xres, ymin + j * yres, DEMObj.heights[i][j])); // scale grid so that the x and y coordinates vary between xmin and xmax, ymin and ymax
            vertices.push(vec3(xmin + (i + 1) * xres, ymin + j * yres, DEMObj.heights[i + 1][j])); // scale grid so that the x and y coordinates vary between xmin and xmax, ymin and ymax
        }
        // need to repeat the ending points to make degenerate triangle ("stutter"), this will be two extra vertices
        vertices.push(vec3(xmin + i * xres, ymin + j * yres, DEMObj.heights[i][j - 1])); // scale grid so that the x and y coordinates vary between xmin and xmax, ymin and ymax
        vertices.push(vec3(xmin, ymin + j * yres, DEMObj.heights[i][j])); // scale grid so that the x and y coordinates vary between xmin and xmax, ymin and ymax
    }
    var normal, normal1, normal2, normal3, normal4;
    for (var i = 0; i < DEMObj.ncols; i++) {
        for (var j = 0; j < DEMObj.nrows; j++) {

            /**Corners**/
            if ((i == 0 && j == 0) || (i == (DEMObj.ncols - 1) && j == 0) || (i == 0 && j == (DEMObj.nrows - 1)) || (i == (DEMObj.ncols - 1) && j == (DEMObj.nrows - 1))) {
                if ((i == 0 && j == 0)) {
                    //bottom left corner 0,0
                    // subtract point at (0,0) from point at (0,1) to get vector
                    // subtract point at (0,0) from point at (1,0) to get vector
                    // cross them and normalize and that's your normal
                    var t1 = subtract(vec3(i, j + 1, 0), vec3(i, j, 0));//top of corner
                    var t2 = subtract(vec3(i + 1, j, 0), vec3(i, j, 0));//right of corner
                } else if ((i == (DEMObj.ncols - 1) && j == 0)) {
                    //bottom right corner ncol,0
                    var t1 = subtract(vec3(i, j - 1, 0), vec3(i, j, 0));//left of corner
                    var t2 = subtract(vec3(i + 1, j, 0), vec3(i, j, 0));//top of corner
                } else if ((i == 0 && j == (DEMObj.nrows - 1))) {
                    //top left corner 0,nrow
                    var t1 = subtract(vec3(i - 1, j, 0), vec3(i, j, 0));//bottom of corner
                    var t2 = subtract(vec3(i, j + 1, 0), vec3(i, j, 0));//right of corner
                } else if ((i == (DEMObj.ncols - 1) && j == (DEMObj.nrows - 1))) {
                    //ncols,nrow corner top right
                    var t1 = subtract(vec3(i, j - 1, 0), vec3(i, j, 0));//left of corner
                    var t2 = subtract(vec3(i - 1, j, 0), vec3(i, j, 0));//bottom of corner
                }
                normal = normalize(cross(t1, t2));
                normals.push(normal);

                /**Interior**/
            } else if ((i > 0 && i < DEMObj.ncols - 1) && (j > 0 && j < DEMObj.nrows - 1)) {
                //interior vertex
                var t1 = subtract(vec3(i + 1, j, 0), vec3(i, j, 0));//top of middle
                var t2 = subtract(vec3(i, j - 1, 0), vec3(i, j, 0));//left of middle
                var t3 = subtract(vec3(i - 1, j, 0), vec3(i, j, 0));//bottom of middle
                var t4 = subtract(vec3(i, j + 1, 0), vec3(i, j, 0));//right of middle
                normal1 = cross(t1, t2);//top to left
                normal2 = cross(t2, t3);//left to bottom
                normal3 = cross(t3, t4);//bottom to right
                normal4 = cross(t4, t1);//right to top
                normal = normalize(add(add(normal1, normal2), add(normal3, normal4)));
                normals.push(normal);

                /**L/R Edge**/
            } else if (i == 0 || i == DEMObj.ncols - 1) {
                if (i == 0) {
                    //Left Edge
                    var t1 = subtract(vec3(i - 1, j, 0), vec3(i, j, 0));//bottom of middle
                    var t2 = subtract(vec3(i, j + 1, 0), vec3(i, j, 0));//right of middle
                    var t3 = subtract(vec3(i + 1, j, 0), vec3(i, j, 0));//top of middle
                } else if (i == DEMObj.ncols - 1) {
                    //Right Edge
                    var t1 = subtract(vec3(i + 1, j, 0), vec3(i, j, 0));//top of middle
                    var t2 = subtract(vec3(i, j - 1, 0), vec3(i, j, 0));//left of middle
                    var t3 = subtract(vec3(i - 1, j, 0), vec3(i, j, 0));//bottom of middle
                }
                normal1 = cross(t1, t2);
                normal2 = cross(t2, t3);
                normal = normalize(add(normal1, normal2));
                normals.push(normal);

                /**T/B Edge**/
            } else if (j == DEMObj.nrows - 1 || j == 0) {
                if (j == DEMObj.nrows - 1) {
                    //Top Edge
                    var t1 = subtract(vec3(i, j - 1, 0), vec3(i, j, 0));//left of middle
                    var t2 = subtract(vec3(i - 1, j, 0), vec3(i, j, 0));//bottom of middle
                    var t3 = subtract(vec3(i, j + 1, 0), vec3(i, j, 0));//right of middle
                } else if (j == 0) {
                    //Bottom Edge
                    var t1 = subtract(vec3(i, j + 1, 0), vec3(i, j, 0));//right of middle
                    var t2 = subtract(vec3(i, j + 1, 0), vec3(i, j, 0));//top of middle
                    var t3 = subtract(vec3(i, j - 1, 0), vec3(i, j, 0));//left of middle
                }
                normal1 = cross(t1, t2);
                normal2 = cross(t2, t3);
                normal = normalize(add(normal1, normal2));
                normals.push(normal);
            }
        }
    }

    for (var i = 0; i < (ncols - 1) * nrows; i++) {
        indices.push(i, i + nrows);
        if (i % nrows == (nrows - 1)) {
            indices.push(i + nrows, i + 1);
        }
    }

    return {vertices: vertices, indices: indices, normals: normals};
}

/* Set up event callback to start the application */
window.onload = function () {

    document.getElementById("zoomSlider").oninput = function () {
        zoom = event.srcElement.value / 1;
    };//listens for the modifier to change the zoom
    document.getElementById("heightSlider").oninput = function () {
        cHeight = (DEMObj.hmax * event.srcElement.value) / 1;
    };//Listens for the value we will multiply maximum height by.

    //make this a radio button?
    document.getElementById("perspectiveView").onclick = function () {
        cMode = 0;
    };//Listens for the value we will multiply maximum height by.
    document.getElementById("parallelView").onclick = function () {
        cMode = 1;
    };//Listens for the value we will multiply maximum height by.

    //May make this a slider eventually
    document.getElementById("rotateLeft").addEventListener("click", function () {
        theta[2] -= 5.0;
    });//rotate left 5 degrees
    document.getElementById("rotateRight").addEventListener("click", function () {
        theta[2] += 5.0
    }); //rotate right 5 degrees
};
/* This is a callback function that sets up the render and then triggers the render function after DEM file is read.*/
function buildTerrain() {
    // local variable to hold reference to our WebGL context
    var gl = initGL(); // basic WebGL setup for the scene
    var prog = loadShaderProgram(gl);

    var drawables = []; // used to store a list of objects that need to be drawn

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

    //sets the current camera height based off of the maximum height value for the current DEM file.
    cHeight = DEMObj.hmax * 2;//this makes it proportional to the grid

    document.getElementById("cellName").innerHTML = "<b><font color=" + "white" + ">" + DEMObj.cellname + "</font></b>";//updates the cellname after dem file is read


    // create a triangle strip object and add it to the list of objects to draw
    drawables.push(new Grid(gl, prog, vec4(0, 0, 0, 1), vec4(1, 1, 0, 1)));
    console.log("Done building");//debug for when grid is finished building
    render(drawables, gl); // start drawing the scene
}
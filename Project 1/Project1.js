var cols = 4, rows = 3;

/* Initialize global WebGL stuff - not object specific */
function initGL(){
    // local variable to hold a reference to an HTML5 canvas
    var canvas = document.getElementById( "gl-canvas" );
    // obtain a WebGL context bound to our canvas
    var gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }
    gl.viewport( 0, 0, canvas.width, canvas.height ); // use the whole canvas
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 ); // background color
    return gl; // send this back so that other parts of the program can use it
}

/* Load shaders and initialize attribute pointers. */
function loadShaderProgram(gl){
    // use the existing program if given, otherwise use our own defaults
    var program = initShaders( gl, "vertex-shader", "fragment-shader" );
    // get the position attribute and save it to our program object
    // then enable the vertex attribute array
    program.vPosLoc = gl.getAttribLocation( program, "vPosition" );
    gl.enableVertexAttribArray( program.vPosLoc );
    return program; // send this back so that other parts of the program can use it
}

/* Constructor for a triangle strip object (initializes the data). */
function TriStrip(gl, program){
    this.gl = gl; // save the graphics context
    this.program = program; // save the shader program
    this.vertices = mkStrip(); // this array will hold raw vertex positions
    this.vBufferId = this.gl.createBuffer(); // store a reference to a new buffer object
    this.gl.bindBuffer( this.gl.ARRAY_BUFFER, this.vBufferId ); // set active array buffer
    // pass data to the graphics hardware (convert JS Array to a typed array)
    this.gl.bufferData( this.gl.ARRAY_BUFFER, flatten(this.vertices), this.gl.STATIC_DRAW );
}

/* Method allows an object to render itself */
TriStrip.prototype.draw = function(gl){
    gl.useProgram( this.program ); // set the current shader programs
    gl.bindBuffer( gl.ARRAY_BUFFER, this.vBufferId ); // set buffer active
    // map position buffer data to the corresponding vertex shader attribute
    gl.vertexAttribPointer( this.program.vPosLoc, 3, gl.FLOAT, false, 0, 0 );
    // render the primitives!
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.vertices.length);
}

/* Global render callback to draw all objects */
function renderToContext(drawables, gl){
    // inner-scoped function for closure trickery
    function renderScene(){
    renderToContext(drawables, gl);
    }
    // start from a clean frame buffer for this frame
    gl.clear( gl.COLOR_BUFFER_BIT);
    drawables.forEach(function(obj){
    obj.draw(gl);
    });
    // queue up this same callback for the next frame
    requestAnimFrame(renderScene);
}

/*Build a triangle strip with random heights. */
function mkStrip() {
    var height, i, t=0; //best practice in JS is to declare variables up front
    var points = []; //points array to hold the individual coordinate triples
    var vertices = []; //vertices array to hold the vertices to be drawn as triangle strips
    var triangleStrip = [];
    
    var vertexesForGrid = 2 * cols * (rows - 1);
    var vertexesForStrip = 2 * cols * (rows - 1) + 2 * (rows - 2);

    var numVertices = vertexesForStrip;

    var y = 0.2;
    for (i = 1; i <= vertexesForGrid; i += 2)
    {
        height = Math.random();
        triangleStrip.push(vec3( ((1 + i) / 2), .2, height ));
        triangleStrip.push(vec3( ((cols * 2 + i + 1)/2), -.2, height ));

        if(triangleStrip[t+1]!= cols && triangleStrip[t+1] != cols*rows)
        {
            triangleStrip[t + 2] = triangleStrip[t + 1];
            triangleStrip[t + 3] = vec3( ((1 + i + 2) / 2), y, height );
            t += 2;
        }
        t += 2;
        y -= 0.4;
    }

    for (i = 0; i < numVertices; i++) {
        vertices.push(triangleStrip[i], triangleStrip[i + 11]);
    }

    return vertices;
}

/*Setup event callback to start the app */
window.onload = function() {
    //local variable to hold reference to our WebGL context
    var gl = initGL(); //basic WebGL setup for the scene
    var prog = loadShaderProgram(gl);
    
    var drawables = []; //used to store a list of objects that need to be drawn
    
    drawables.push(new TriStrip(gl, prog));//create an object and add it to the list
    
    renderToContext(drawables, gl); //draw scene
}
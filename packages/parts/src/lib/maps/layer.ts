import mapboxgl from 'mapbox-gl';

export function createLayer(
  markers: mapboxgl.Marker[],
  markersIntuitive = true
): mapboxgl.CustomLayerInterface {
  let layerCoordinates = [];
  return {
    id: 'highlight',
    type: 'custom',

    // method called when the layer is added to the map
    // https://docs.mapbox.com/mapbox-gl-js/api/#styleimageinterface#onadd
    // I don't understand 100% this part
    onAdd: function (_map, gl) {
      // create GLSL source for vertex shader
      const vertexSource = `
                uniform mat4 u_matrix;
                attribute vec2 a_pos;
                void main() {
                    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
                }`;

      // create GLSL source for fragment shader
      const fragmentSource = `
                void main() {
                    gl_FragColor = vec4(0.1, 0.86, 0.4, 0.9);
                }`;

      // create a vertex shader
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vertexSource);
      gl.compileShader(vertexShader);

      // create a fragment shader
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fragmentSource);
      gl.compileShader(fragmentShader);

      // link the two shaders into a WebGL program
      this.program = gl.createProgram();
      gl.attachShader(this.program, vertexShader);
      gl.attachShader(this.program, fragmentShader);
      gl.linkProgram(this.program);

      this.aPos = gl.getAttribLocation(this.program, 'a_pos');
      // End

      // define vertices of the triangle to be rendered in the custom style layer
      markers.forEach((marker) => {
        layerCoordinates.push(mapboxgl.MercatorCoordinate.fromLngLat(marker.getLngLat()));
      });
      // create and initialize a WebGLBuffer to store vertex and color data
      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(layerCoordinates.flatMap((el) => [el.x, el.y])),
        gl.STATIC_DRAW
      );
    },

    // method fired on each animation frame
    // https://docs.mapbox.com/mapbox-gl-js/api/#map.event:render
    render: function (gl, matrix) {
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_matrix'), false, matrix);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.enableVertexAttribArray(this.aPos);
      gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (markersIntuitive) {
        gl.drawArrays(gl.TRIANGLE_FAN, 0, markers.length);
      } else {
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, markers.length);
      }
    },
  };
}

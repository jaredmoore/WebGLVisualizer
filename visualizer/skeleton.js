////////////////////////////////////////////////////////////////////////////////
// Provide the functions necessary to output logged body data to a browser. 
////////////////////////////////////////////////////////////////////////////////

// var gui;

// Test for performance improvement.
var tmpQuat = new THREE.Quaternion();

var camera, scene, renderer;
var cameraControls, effectController, playbackController, colorController;
var clock = new THREE.Clock();
var gridX = true;
var gridY = false;
var gridZ = false;
var axes = false;
var rotate_world = false;
var pause = true;
var play_speed = 1.0;
var play_direction = 1.0; // Whether viewing playback in forward or reverse.
var first_round = true; // Keep track of the camera position, only initialize it on the first run through.
var not_switched = true; // Rendering loop triggers more than once for camera position when clearing objects.

// Implement a color cue for different color objects.
var color_queue = [];

var current_timestep = 0; // What step in the animation to display.
var sim_time = 0; // Time that the simulation has been run for (separate from system time)
var last_speed = 0; // Keep track of the last playback speed used during a render.

var scale_factor = 100; //Scaling factor to use with the world. (ODE objects are small!)

var object_container;
var animated_objects = []; //Array to hold the objects that will be animated.

// Camera information needed to have a follow camera.
var prev_pos = [0,0,0];
var LOOK_AT = 1; // Index of object in animated_objects to focus the camera on.
var camera_position = 0; // Keep track of where the camera is looking for maintaing viewpoint between playbacks.

var fps = 60;
var oldTime = 0;
var newTime = 0;
var timestep;
var eval_time;

var positions = [];
var quaternions = [];

var create_object_ptr = create_object;

// If passed multiple files.
var files_list;
var cur_file;

// Draw the scene to the screen.
//
//Args:
//user_data: user provided data containing the information about different bodies
function fillScene(user_data) {
	scene = new THREE.Scene();
	scene.fog = new THREE.Fog( 0x808080, 4000, 8000 );

	// LIGHTS
	var ambientLight = new THREE.AmbientLight( 0x222222 );

	var light = new THREE.DirectionalLight( 0xFFFFFF, 1.0 );
	light.position.set( 0, 4000, 0 );
	light.castShadow = true;
	light.shadowDarkness = 0.6;
	// light.shadowCameraVisible = true;
	light.shadowCameraNear = 3500;
	light.shadowCameraFar = 4500;
	light.shadowCameraLeft = -2000;
	light.shadowCameraRight = 2000;
	light.shadowCameraTop = 2000;
	light.shadowCameraBottom = -2000;

	// var light2 = new THREE.DirectionalLight( 0xFFFFFF, 1.0 );
	// light2.position.set( -500, 250, -200 );

	// var light3 = new THREE.SpotLight( 0xffffff );
	// light3.position.set( 0, 4000, 0 );
	// light3.castShadow = true;
	// light3.shadowCameraFov = 100;
	// light3.shadowMapWidth = 2048;
	// light3.shadowMapHeight = 2048;
	// light3.intensity = 0.5;
	// light3.shadowCameraVisible = true; //Debug by looking at the shadow frustrum

	scene.add(ambientLight);
	scene.add(light);
	// scene.add(light2);
	// scene.add(light3);

	// Ground
	ground = new THREE.Mesh(
		new THREE.PlaneGeometry( 5000, 5000 ),
		new THREE.MeshLambertMaterial({ color: 0xDDDDDD })
	);
	ground.receiveShadow = true;
	ground.rotation.x = -Math.PI / 2;
	scene.add( ground );

	// Light
	// light = new THREE.DirectionalLight( 0xFFFFFF );
	// light.position.set( 0, 40, 0 );
	// // light.target.set(0,0,0);
	// light.castShadow = true;
	// light.shadowCameraLeft = -25;
	// light.shadowCameraTop = -25;
	// light.shadowCameraRight = 25;
	// light.shadowCameraBottom = 25;
	// light.shadowBias = -.0001
	// scene.add( light );

	update_environment();

	object_container = new THREE.Object3D();

	//Parse the user data.
	for ( var i = 0; i < user_data.length; ++i ) {
		obj = create_object_ptr( user_data[i] );
		if (rotate_world) {
			object_container.add(obj);
		} else {
			scene.add(obj);
		}
	}

	//Add the robot objects to the color selector drop_down.
	var sel = document.getElementById("color_object_selector");
	for (var i = 0; i < animated_objects.length; ++i) {
		var option = document.createElement("option");
		option.value = i.toString();
		option.text = i.toString();
		option.innerHTML = i.toString();
		//sel.add(option,sel[i]);
		sel.appendChild(option);
	}

	if (rotate_world) {
		// object_container.setPosition(animated_objects[0].position);
		object_container.quaternion.copy(tmpQuat.set(-Math.sqrt(0.5),0.,0.,Math.sqrt(0.5)));
		scene.add(object_container);
	}
}

//Update the environment information based on response from the check boxes.
function update_environment () {
	// if (ground) {
	// 	Coordinates.drawGround({size:10000});		
	// }
	if (gridX) {
		Coordinates.drawGrid({size:10000,scale:0.01});
	}
	if (gridY) {
		Coordinates.drawGrid({size:10000,scale:0.01, orientation:"y"});
	}
	if (gridZ) {
		Coordinates.drawGrid({size:10000,scale:0.01, orientation:"z"});	
	}
	if (axes) {
		Coordinates.drawAllAxes({axisLength:200,axisRadius:.01*scale_factor,axisTess:50});
	}
}

//Read a given string and create the object defined by it.
//
//Args:
//scene: 		WebGL scene to add object to 
//object_str: 	string containing information defining an object
function create_object( object_str ) {
	parsed = object_str.split(",");
	obj = new THREE.Object3D();
	len = parsed.length; //Capsules and boxes have different length specs
	// var a = [1,4,2,3];
	var a = [3,2,1,4];
	if (parsed[0] == "box") {
		cube_geom( obj, parsed[4]*scale_factor, parsed[5]*scale_factor, parsed[6]*scale_factor );
	} else if(parsed[0] == "capsule") {
		capped_cylinder_geom( obj, parsed[5]*scale_factor, parsed[4]*scale_factor);
	} else if(parsed[0] == "cylinder") {
		cylinder_geom( obj, parsed[5]*scale_factor, parsed[4]*scale_factor )
	} else if(parsed[0] == "sphere") {
		sphere_geom( obj, parsed[4]*scale_factor )
	}

	obj.quaternion.copy(
		tmpQuat.set( parseFloat(parsed[len-a[0]]), 
			parseFloat(parsed[len-a[1]]), 
			parseFloat(parsed[len-a[2]]), 
			parseFloat(parsed[len-a[3]]) )
		);
	obj.position.set( parsed[1]*scale_factor, parsed[2]*scale_factor, parsed[3]*scale_factor );
	
	animated_objects.push(obj);

	return obj;
}

//Create a capped cylinder and display it to the screen.
//
//Args:
//base_object: 	THREE.Object3D object
//rad: 			radius of the capped cylinder
//height: 		height of the cylinder of the capsule (verified in ODE documentation) 
function capped_cylinder_geom( base_object, rad, height ) {

	var color = 0xF4C154;
	if (color_queue.length > 0) {
		color = color_queue.shift();
	}
	
	var mat = new THREE.MeshPhongMaterial( { 	color: color, 
												specular: color, 
												shininess: 60}
												// ,
												// opacity: 0,
												// transparent: 1 }
			);

	//Create an open ended cylinder since we are placing caps on each end.
	var cylinder = new THREE.Mesh( new THREE.CylinderGeometry( rad,rad,height,32,1,true ), mat );
	cylinder.castShadow = true;
	cylinder.receiveShadow = true;
	base_object.add( cylinder );	

	var sphere_geom = new THREE.SphereGeometry( rad,32,32 );

	//Create the bottom sphere.
	var bottom_sphere = new THREE.Mesh( sphere_geom, mat );
	bottom_sphere.castShadow = true;
	bottom_sphere.receiveShadow = true;
	bottom_sphere.position.set( 0, -height/2., 0);
	base_object.add( bottom_sphere );
	
	//Create the top sphere.
	var top_sphere = new THREE.Mesh( sphere_geom, mat );
	top_sphere.castShadow = true;
	top_sphere.receiveShadow = true;
	top_sphere.position.set( 0, height/2., 0);
	base_object.add( top_sphere );
}

//Create a cylinder and display it to the screen.
//
//Args:
//base_object: 	THREE.Object3D object
//rad: 			radius of the cylinder
//height: 		height of the cylinder 
function cylinder_geom( base_object, rad, height ) {
	
	var color = 0xF4C154;
	if (color_queue.length > 0) {
		color = color_queue.shift();
	}

	var mat = new THREE.MeshPhongMaterial( { 	color: color, 
												specular: color, 
												shininess: 60}
												// ,
												// opacity: 0,
												// transparent: 1 }
			);

	//Create a cylinder.
	var cylinder = new THREE.Mesh( new THREE.CylinderGeometry( rad,rad,height,32,1,false ), mat );
	cylinder.castShadow = true;
	cylinder.receiveShadow = true;
	base_object.add( cylinder );	
}

//Create a sphere and display it to the screen.
//
//Args:
//base_object: 	THREE.Object3D object
//rad: 			radius of the capped cylinder
function sphere_geom( base_object, rad ) {
	
	var mat = new THREE.MeshPhongMaterial( 	{ 	color: color, 
												specular: color, 
												shininess: 60,
												vertexColors: THREE.FaceColors
											}
												// ,
												// opacity: 0,
												// transparent: 1 }
			);

	//Create sphere.
	var sphere_geometry = new THREE.SphereGeometry( rad,32,32 );

	// Color the faces individually.
	for ( var i = 0; i < sphere_geometry.faces.length; ++i ) {
		face = sphere_geometry.faces[i];
		if (i % 2 == 0) {
			face.color.setRGB(0.2,0.2,0.2);
		} else {
			face.color.setRGB(0.5,0.5,0.5);
		}
	}

	var sphere = new THREE.Mesh( sphere_geometry, mat );
	sphere.castShadow = true;
	sphere.receiveShadow = true;
	base_object.add( sphere );
}

//Create a cube for display to the screen.
//
//Args:
//base_object: 	THREE.Object3D object
//x: 			x dimension of the cube 
//y: 			y dimension of the cube 
//z: 			z dimension of the cube 
function cube_geom( base_object, x, y, z ) {

	var color = 0xF4C154;
	if (color_queue.length > 0) {
		color = color_queue.shift();
	}

	var mat = new THREE.MeshPhongMaterial( { 	color: color, 
												specular: color, 
												shininess: 60 }
	);

	//Create a cube.
	var cube = new THREE.Mesh(
		new THREE.CubeGeometry( x, y, z ),
		mat
	);

	cube.castShadow = true;
	cube.receiveShadow = true;

	base_object.add( cube );
}

//Create a sphere for display to the screen.
//
//Args:
//base_object: 	THREE.Object3D object
//rad: 			radius of the sphere
//alpha: 		alpha parameter of the color of the sphere
function sphere_geom( base_object, rad, alpha, color ) {
	var mat1 = new THREE.MeshPhongMaterial( { 	color: 0xFFFFFF,
												ambient: 0xFFFFFF, 
												specular: 0xFFFFFF, 
												shininess: 60,
												transparent: (alpha < 1. ? true : false) }
	);

	var mat2 = new THREE.MeshPhongMaterial( { 	color: 0x000000,
												ambient: 0x000000, 
												specular: 0x000000, 
												shininess: 60,
												transparent: (alpha < 1. ? true : false) }
	);

	//Create sphere.
	var sphere_geometry = new THREE.SphereGeometry( rad,32,32 );
	sphere_geometry.materials = [mat1,mat2];

	// Color the faces individually.
	for ( var i = 0; i < sphere_geometry.faces.length; i += 2 ) {
		for ( var j = 0; j < 2; ++j ) {
			face = sphere_geometry.faces[i+j];
			if ((i/2) % 2 == 0) {
				face.materialIndex = 0;
			} else {
				face.materialIndex = 1;
			}
		}
	}

	var sphere = new THREE.Mesh( sphere_geometry, new THREE.MeshFaceMaterial(sphere_geometry.materials) );

	sphere.castShadow = (alpha < 1. ? false : true);
	sphere.receiveShadow = true;
	mat1.opacity = alpha;
	mat2.opacity = alpha;

	base_object.add( sphere );
}

//Initialize the canvas window with the WebGL scene.
//
//Args:
//user_data: user provided data file containing information about the different objects to render
function init(user_data) {
	var canvasWidth = 1280; //window.innerWidth;
	var canvasHeight = 720; //window.innerHeight;
	var canvasRatio = canvasWidth / canvasHeight;

	// Set the background of the interface pane to be black.
	document.getElementById('interaction_pane').style.background = 'black';

	// Set the timer element to visible.
	document.getElementById('sim_time_div').style.visibility = 'visible';
	document.getElementById("sim_time").textContent = "0.000";
	current_timestep = 0;

	// Set the playback speed to visible and it's value.
	document.getElementById('playback_speed_div').style.visibility = 'visible';
	document.getElementById('playback_speed_text').textContent = "x"+play_speed.toFixed(1);

	// Set the playback controls to visible.
	document.getElementById('playback_controller').style.visibility = 'visible';

	// Set the color picker controls to visible.
	document.getElementById('color_picker_div').style.visibility = 'visible';

	// Ensure that the play button is displayed on loading a new file.
	var play = document.getElementById("play_button");
	play.style.display = 'inline';
	var pause = document.getElementById("pause_button");
	pause.style.display = 'none';



	var container = document.getElementById('container');

	// Clear any previously created elements.
	if(container.firstChild) {
		// Remove the previous WebGL visualization.
		for (var i = 0; i < animated_objects.length; ++i) {
			scene.remove(animated_objects[i]);
			// renderer.deallocateObject(animated_objects[i]);
		}

		while (container.firstChild) {
	 	   container.removeChild(container.firstChild);
		}

		// Remove the old WebGL canvas controller
		elements = document.getElementsByClassName("dg ac");
		if (elements.length > 0) {
			while (elements[0].firstChild) {
				elements[0].removeChild(elements[0].firstChild);
			}
		}
	}

	// RENDERER
	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.gammaInput = true;
	renderer.gammaOutput = true;
	renderer.setSize(canvasWidth, canvasHeight);
	renderer.setClearColorHex( 0xAAAAAA, 1.0 );
	renderer.shadowMapEnabled = true;
	renderer.shadowMapSoft = true;
	renderer.shadowMapType = THREE.PCFSoftShadowMap;

	// renderer.shadowCameraNear = 3;
	// renderer.shadowCameraFov = 50;

	// renderer.shadowMapBias = 0.0039;
	// renderer.shadowMapDarkness = 1.0;
	renderer.shadowMapWidth = 4096;
	renderer.shadowMapHeight = 4096;
	container.appendChild( renderer.domElement );

	// CAMERA
	camera = new THREE.PerspectiveCamera( 30, canvasRatio, 1, 10000 );
	if (rotate_world) {
		camera.position.set( 0, 4.8*scale_factor, 12*scale_factor );
	} else {
		camera.position.set( 12*scale_factor, 12*scale_factor, 2*scale_factor );
	}
	// CONTROLS
	cameraControls = new THREE.OrbitAndPanControls(camera, renderer.domElement);
	if (rotate_world) {
		cameraControls.target.set(0,0,1*scale_factor);
	} else {
		cameraControls.target.set(0,1*scale_factor,0);
	}

	if (camera_position != 0) {
		cameraControls.object.position = camera_position;
	}

	renderer.shadowCameraFar = camera.far;
	
	// fillScene(user_data);

}

function animate() {
	window.requestAnimationFrame(animate);
	render();
}

function render() {
	var delta = clock.getDelta();
	cameraControls.update(delta);

	// if (last_speed != playbackController.speed) {
	// 	last_speed = playbackController.speed;
	// }
	if (last_speed != play_speed) {
		last_speed = play_speed;
	}

	// Check to see if the paused radio button is checked.
	if ( !playbackController.paused ) {

		newTime += delta;
		if ( newTime > oldTime + 1/fps ) {

			// Update the simulation time elapsed element. (I log every 4th physics simulation position.)
			document.getElementById("sim_time").textContent = (current_timestep*timestep*4.).toFixed(3);

			// Get the time difference between renders and adjust for playback speed.
			// sim_time += play_direction*((newTime-oldTime)*playbackController.speed);
			sim_time += play_direction*((newTime-oldTime)*play_speed);

			// Render the frame necessary to maintain the playback speed.
			current_timestep = Math.floor(sim_time/(timestep*4));
			
			//Correct for end of simulation.
			if ( current_timestep >= positions.length ) {
				current_timestep = 0;
				sim_time = 0;
				newTime = 0;
				if (files_list.length > 1) {
					// Clear any of the variables to start with a fresh slate.
					positions.length = 0;
					quaternions.length = 0;
					animated_objects.length = 0;
					static_objects.length = 0;
					// prev_pos.length = 0;
					read_file();
				}
			} else if ( sim_time < 0 ) {
				current_timestep = positions.length - 1;
				sim_time = parseFloat(eval_time);
				// newTime = 0;
			}

			var j = current_timestep;
			//Update the positions of the model bodies.
			for (var i = 0; i < animated_objects.length; ++i) {
				if (rotate_world) {
					// animated_objects[i].position.set( 0,0,0 );

					// Setup an object's quaternion.
					var a = [1,2,3,0]; // ODE -> WebGL Quaternion Ordering (ODE:w,x,y,z -> 3JS:x,y,z,w)
					// var quat = new THREE.Quaternion( 	quaternions[j][i*4+a[0]],
					// 									quaternions[j][i*4+a[1]],
					// 									quaternions[j][i*4+a[2]],
					// 									quaternions[j][i*4+a[3]] );

					// animated_objects[i].quaternion = quat;

					animated_objects[i].quaternion.copy(tmpQuat.set( 	quaternions[j][i*4+a[0]],
														quaternions[j][i*4+a[1]],
														quaternions[j][i*4+a[2]],
														quaternions[j][i*4+a[3]] ));

					// Set an object's position.
					animated_objects[i].position.set( 	positions[j][i*3]*scale_factor, 
														positions[j][i*3+1]*scale_factor, 
														positions[j][i*3+2]*scale_factor );
				} else {
					animated_objects[i].position.set( 0,0,0 );

					// Setup an object's quaternion.
					var a = [1,2,3,0]; // ODE -> WebGL Quaternion Ordering (ODE:w,x,y,z -> 3JS:x,y,z,w)
					// var quat = new THREE.Quaternion( 	quaternions[j][i*4+a[0]],
					// 									quaternions[j][i*4+a[1]],
					// 									quaternions[j][i*4+a[2]],
					// 									quaternions[j][i*4+a[3]] );
					// animated_objects[i].quaternion = quat;

					animated_objects[i].quaternion.copy(tmpQuat.set( 	quaternions[j][i*4+a[0]],
														quaternions[j][i*4+a[1]],
														quaternions[j][i*4+a[2]],
														quaternions[j][i*4+a[3]] ));
					
					// Set an object's position.
					animated_objects[i].position.set( 	positions[j][i*3]*scale_factor, 
														positions[j][i*3+1]*scale_factor, 
														positions[j][i*3+2]*scale_factor );
				}

			}

			oldTime = newTime;

			if (animated_objects.length > 0) {
				// Update the camera position to follow the object from whatever it's current position is.
				// Moves by the delta between the object's current position and it's previous position
				cameraControls.object.position = new THREE.Vector3(
					cameraControls.object.position.x - (prev_pos[0] - animated_objects[LOOK_AT].position.x),
					cameraControls.object.position.y,
					cameraControls.object.position.z - (prev_pos[2] - animated_objects[LOOK_AT].position.z)
				);

				// Update the target of the camera (Where it is looking at.)
				cameraControls.target = new THREE.Vector3( 	animated_objects[LOOK_AT].position.x,
															cameraControls.target.y,
															animated_objects[LOOK_AT].position.z );

				// Update the previous position of the robot so that camera following works.
				prev_pos[0] = animated_objects[LOOK_AT].position.x;
				prev_pos[1] = animated_objects[LOOK_AT].position.y;
				prev_pos[2] = animated_objects[LOOK_AT].position.z;

				camera_position = new THREE.Vector3(
					cameraControls.object.position.x - animated_objects[LOOK_AT].position.x,
					cameraControls.object.position.y,
					cameraControls.object.position.z - animated_objects[LOOK_AT].position.z
				);

			} else if (animated_objects.length == 0 && not_switched) {
				// Update the camera position to follow the object from whatever it's current position is.
				// Moves by the delta between the object's current position and it's previous position
				cameraControls.object.position = new THREE.Vector3(
					cameraControls.object.position.x - prev_pos[0],
					cameraControls.object.position.y,
					cameraControls.object.position.z - prev_pos[2]
				);

				camera_position = new THREE.Vector3(
					cameraControls.object.position.x,
					cameraControls.object.position.y,
					cameraControls.object.position.z
				);
				not_switched = false;
			}
		}
	}

	renderer.render(scene, camera);
}



function setupGui() {

	// Adjust the playback of the simulation.
	playbackController = {
		paused: pause,
		speed: play_speed,
	};

	// Change color of objects in the simulation.
	colorController = {
		colors: [],
		objects: [],
		object_id: 0,
		color: "#F4C154",
		opacity: 1.0
	};
}

function launch(files) {

	document.getElementById("demo").style.visibility = "hidden";

	files_list = files;
	if (files_list.length > 1) document.getElementById('file_number_div').style.visibility = 'visible';
	cur_file = 0;

	// Initialize the window elements.
	init();
	setupGui();

	// Call the first read_file to start the playback.
	read_file();
}

function read_file() {

	if (cur_file >= files_list.length) {
		cur_file = 0;
	}

	var reader = new FileReader();

	reader.onload = (function(theFile) {
		return function(e) {
			cur_file = cur_file + 1;
			launch_file(e.target.result);
			// Update the file number id.
			document.getElementById("file_number").textContent = cur_file;
		};

	})(files_list[cur_file]);

	reader.readAsText(files_list[cur_file]);

}

function launch_file(data) {

	positions = [];
	quaternions = [];
	animated_objects = [];
	static_objects = [];
	prev_pos = [0,0,0];
	oldTime = 0;
	newTime = 0;
	current_timestep = 0;
	sim_time = 0;
	not_switched = true;

	//Split data into setup data and animation data.
	//Parse the user data.

	var setup_data = [];
	lines = data.split("\n")
	if (lines[0] == "Version 0.1") {
		create_object_ptr = v_0_1_create_object;
		setup_data = parse_input_file(lines);
	} else if (lines[0] == "Version 0.2") {
		// Set flag to rotate incoming data by 90 degrees on the x-axis (swap y and z)
		rotate_world = true;

		create_object_ptr = v_0_2_create_object;
		
		setup_data = parse_input_file(lines);
	} else if (lines[0] == "Version 0.3") {
		// Set flag to rotate incoming data by 90 degrees on the x-axis (swap y and z)
		rotate_world = true;
		
		setup_data = parse_input_file(lines);
	} else {
		alert("Unknown Version Number!")
		return;
	}

	// Reset the camera position.
	if (first_round) {
		if (rotate_world) {
			camera.position.set( 0, 4.8*scale_factor, 12*scale_factor );
		} else {
			camera.position.set( 12*scale_factor, 12*scale_factor, 2*scale_factor );
		}
		first_round = false;
	}

	// Call this per each read-in.
	fillScene(setup_data);

	// Add the objects associated with the robot itself to the color changer.
	for(i=0; i < animated_objects.length; ++i) {
		colorController.objects.length = 0;
		colorController.objects.push(i);
		colorController.colors.push(color_queue[i]);
	}

	// Set the color of the color picker.
	if (animated_objects[document.getElementById('color_object_selector').value].children[0].material.materials == undefined) {
			document.getElementById('object_color').color.fromString(animated_objects[document.getElementById('color_object_selector').value].children[0].material.color.getHex().toString(16));
	} else {
    	document.getElementById('object_color').color.fromString(animated_objects[document.getElementById('color_object_selector').value].children[0].material.materials[0].color.getHex().toString(16));
    }

	// Reset time variables to avoid jumping in the simulation.
	oldTime = clock.getDelta();

	animate();
}

function parse_input_file(lines) {
	timestep = lines[2];
	eval_time = lines[3];
	var i = 4;
	var setup_data = [];
	while(lines[i] != "<\\setup information>") {
		setup_data.push( lines[i] );
		i += 1;
	}

	//Skip the setup information closing tag.
	i += 1

	//Parse color information, if there.
	if (lines[i] == "<color information>") {
		i += 1;
		parsed = lines[i].split(",");
		for(var j=0;j<parsed.length;++j) {
			color_queue.push(color_lookup(parsed[j]));
		}
		//Skip the terminating tag of the color information
		i += 2;
	}

	for (i; i < lines.length-1; i += 2) {
		positions.push( floatify(lines[i].split(",")) );
		quaternions.push( floatify(lines[i+1].split(",")) );
	}

	return setup_data;
}

////////////////////////////////////////////////////////////////////////////////
// Utility Functions
////////////////////////////////////////////////////////////////////////////////

//Convert the given text line to an array of floats.
function floatify( parsed ) {
	var floats = [];
	for (var i = 0; i < parsed.length; ++i) {
		floats.push( parseFloat(parsed[i]) );
	}
	return floats;
}

//Convert a given color string into hex.
function color_lookup( color_str ) {
	if (color_str == "Green") {
		return 0x004000;
	} else if (color_str == "Gray") {
		return 0x383838;
	} else {
		return 0xF4C154;
	}
}

////////////////////////////////////////////////////////////////////////////////
// File format parsing.
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// Version 0.1 file format parsing
// Read a given string and create the object defined by it.
//
// Args:
// scene: 		WebGL scene to add object to 
// object_str: 	string containing information defining an object
function v_0_1_create_object( object_str ) {
	parsed = object_str.split(",");
	obj = new THREE.Object3D();
	len = parsed.length; //Capsules and boxes have different length specs
	// var a = [1,4,2,3];
	var a = [3,2,1,4];
	
	if (parsed[0] == "scene_sphere") {
		sphere_geom(obj,parsed[4]*scale_factor,0.2, false);

		// Set the position of the object.
		obj.position.set( parsed[1]*scale_factor, parsed[2]*scale_factor, parsed[3]*scale_factor );

		static_objects.push(obj);
	} else if(parsed[0] == "scene_box" || parsed[0] == "terrain_box") {
		cube_geom( obj, parsed[4]*scale_factor, parsed[5]*scale_factor, parsed[6]*scale_factor );

		obj.quaternion.copy(
				tmpQuat.set( 
					parseFloat(parsed[len-a[0]]), 
					parseFloat(parsed[len-a[1]]), 
					parseFloat(parsed[len-a[2]]), 
					parseFloat(parsed[len-a[3]]) )
				);

		// Set the position of the object.
		obj.position.set( parsed[1]*scale_factor, parsed[2]*scale_factor, parsed[3]*scale_factor );

		static_objects.push(obj);
	} else {
		if (parsed[0] == "box") {
			cube_geom( obj, parsed[4]*scale_factor, parsed[5]*scale_factor, parsed[6]*scale_factor );
		} else if(parsed[0] == "capsule") {
			capped_cylinder_geom( obj, parsed[5]*scale_factor, parsed[4]*scale_factor);
		}  else if(parsed[0] == "cylinder") {
			cylinder_geom( obj, parsed[5]*scale_factor, parsed[4]*scale_factor )
		} else if(parsed[0] == "sphere") {
			sphere_geom( obj, parsed[4]*scale_factor )
		}
		
		obj.quaternion.copy(
			tmpQuat.set( 
				parseFloat(parsed[len-a[0]]), 
				parseFloat(parsed[len-a[1]]), 
				parseFloat(parsed[len-a[2]]), 
				parseFloat(parsed[len-a[3]]) )
			);

		// Set the position of the object.
		obj.position.set( parsed[1]*scale_factor, parsed[2]*scale_factor, parsed[3]*scale_factor );

		// Add the object to the list of objects.
		animated_objects.push(obj);
	}

	return obj;
} 

////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// Version 0.2 file format parsing
// No change in create_object between Version 0.1 and 0.2
var v_0_2_create_object = v_0_1_create_object;


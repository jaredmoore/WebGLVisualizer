////////////////////////////////////////////////////////////////////////////////
// Provide the functions necessary to output logged body data to a browser. 
////////////////////////////////////////////////////////////////////////////////

// Test for performance improvement.
var tmpQuat = new THREE.Quaternion();

var camera, scene, renderer;
var cameraControls, effectController, playbackController, colorController;
var clock = new THREE.Clock();
var gridX = false;
var gridY = false;
var gridZ = false;
var axes = false;
var cameraFollow = true;
var rotate_world = false;
var pause = true;
var play_speed = 1.0;
var play_direction = 1.0; // Whether viewing playback in forward or reverse.

// Implement a color cue for different color objects.
var color_queue = [];

var current_timestep = 0; // What step in the animation to display.
var sim_time = 0; // Time that the simulation has been run for (separate from system time)
var last_speed = 0; // Keep track of the last playback speed used during a render.
var substeps = 4; // Number of physics steps between logging.  Eval_Time/Timestep/Positions.length

var scale_factor = 100; //Scaling factor to use with the world. (ODE objects are small!)

var object_container;
var animated_objects = []; //Array to hold the objects that will be animated.

// Camera information needed to have a follow camera.
var prev_pos = [0,0,0];
var LOOK_AT = 0; // Index of object in animated_objects to focus the camera on.
var camera_position = 0; // Keep track of where the camera is looking for maintaing viewpoint between playbacks.

var fps = 60;
var oldTime = 0;
var newTime = 0;
var timestep;
var eval_time;
var transitionTime = 0.0; // Number of seconds to wait in between two different files. (Set in the callback method.)

var positions = [];
var quaternions = [];
var colors = [];
var alphas = [];
var variable_colors = false;

var light, light2;

var create_object_ptr = ObjectCreator.create_object;

// If passed multiple files.
var files_list;
var cur_file;

// Toggle Camera Following
function toggleFollow(value) {
	if (value == "yes") {
		cameraFollow = true;
	} else {
		cameraFollow = false;
	}
}

// Draw the scene to the screen.
//
//Args:
//user_data: user provided data containing the information about different bodies
function fillScene(user_data) {
	scene = new THREE.Scene();
	//scene.fog = new THREE.Fog( 0x808080, 4000, 8000 );

	// LIGHTS
	var ambientLight = new THREE.AmbientLight( 0x222222 );

	light = new THREE.DirectionalLight( 0xFFFFFF, 1.0 );
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

	light2 = new THREE.DirectionalLight( 0xFFFFFF);//, 1.0 );
	light2.position.set( -500, 250, -200 );
	light2.target.position.copy( scene.position );
	light2.castShadow = true;
	light2.shadowCameraLeft = -60;
	light2.shadowCameraTop = -60;
	light2.shadowCameraRight = 60;
	light2.shadowCameraBottom = 60;
	light2.shadowCameraNear = 20;
	light2.shadowCameraFar = 200;
	light2.shadowBias = -.0001
	light2.shadowMapWidth = light2.shadowMapHeight = 4096*2;
	light2.shadowDarkness = .7;

	scene.add(ambientLight);
	scene.add(light);
	scene.add(light2);

	// Ground
	var ground_lr = 11;
	ground = new THREE.Mesh(
		new THREE.PlaneGeometry( 100*scale_factor, ground_lr*scale_factor ),
		new THREE.MeshLambertMaterial({ color: 0xDDDDDD }),
	);
	ground.position.set(50*scale_factor, 0, ground_lr/2.0*scale_factor);
	ground.material.opacity = 0.15;
	ground.material.transparent = true;
	ground.receiveShadow = true;
	ground.rotation.x = -Math.PI / 2;
	scene.add( ground );

	// Ceiling
	var ceiling_lr = ground_lr;
	ceiling = new THREE.Mesh(
		new THREE.PlaneGeometry( 100*scale_factor, ceiling_lr*scale_factor ),
		new THREE.MeshLambertMaterial({ color: 0xDDDDDD }),
	);
	ceiling.position.set(50*scale_factor, ceiling_lr*scale_factor, ground_lr/2.0*scale_factor);
	ceiling.material.opacity = 0.15;
	ceiling.material.transparent = true;
	ceiling.receiveShadow = true;
	ceiling.rotation.x = Math.PI / 2;
	scene.add( ceiling );

	// Back Wall
	var backwall_lr = 0;
	var backwall = new THREE.Mesh(
		new THREE.PlaneGeometry( 100*scale_factor, ground_lr*scale_factor ),
		new THREE.MeshLambertMaterial({ color: 0xDDDDDD }),
	);
	backwall.position.set(50*scale_factor, ground_lr/2.0*scale_factor, 0);
	backwall.material.opacity = 0.15;
	backwall.material.transparent = true;
	backwall.receiveShadow = true;
	//ground.rotation.x = -Math.PI / 2;
	scene.add( backwall );	

	// Front Wall
	var frontwall_lr = ground_lr;
	var frontwall = new THREE.Mesh(
		new THREE.PlaneGeometry( 100*scale_factor, ground_lr*scale_factor ),
		new THREE.MeshLambertMaterial({ color: 0xDDDDDD }),
	);
	frontwall.position.set(50*scale_factor, ground_lr/2.0*scale_factor, ground_lr*scale_factor);
	frontwall.material.opacity = 0.15;
	frontwall.material.transparent = true;
	frontwall.receiveShadow = true;
	frontwall.rotation.x = -Math.PI;
	scene.add( frontwall );	

	update_environment();

	object_container = new THREE.Object3D();

	//Parse the user data.
	for ( var i = 0; i < user_data.length; ++i ) {
		obj = create_object_ptr(user_data[i],color_queue,scale_factor);

		if (color_queue.length > 0 && obj[1].type != "sphere" && obj[1].type != "scene_sphere") {
			console.log("#"+parseInt(color_queue[i].replace(/^0x/, ''), 16).toString(16));
			obj[1].children[0].material.color.setHex(parseInt(color_queue[i].replace(/^0x/, ''), 16));
		}

		if (obj[1].type == "cube" && obj[0] == "static") {
			obj[1].children[0].material.color.set(0x000FFF);
		}

		if (obj[0] == "animated") {
			animated_objects.push(obj[1]);
		} else {
			static_objects.push(obj[1])
		}

		if (rotate_world) {
			object_container.add(obj[1]);
		} else {
			scene.add(obj[1]);
		}
	}

	if (rotate_world) {
		object_container.quaternion.copy(tmpQuat.set(-Math.sqrt(0.5),0.,0.,Math.sqrt(0.5)));
		scene.add(object_container);
	}
}

//Update the environment information based on response from the check boxes.
function update_environment () {
	if (gridX) {
		Coordinates.drawGrid({size:15000,scale:0.01});
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

	// Set the camera follow controls to visible.
	document.getElementById('cam_controls_div').style.visibility = 'visible';

	// Set the time slider div to visible.
	document.getElementById('playback_slider_div').style.visibility = 'visible';

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
	renderer.shadowMapWidth = 4096;
	renderer.shadowMapHeight = 4096;
	container.appendChild( renderer.domElement );

	// CAMERA
	camera = new THREE.PerspectiveCamera( 30, canvasRatio, 1, 40000 );
	// CONTROLS
	cameraControls = new THREE.OrbitAndPanControls(camera, renderer.domElement);

	reset_camera_position();

	renderer.shadowCameraFar = camera.far;

}

// Reset the camera position.
function reset_camera_position() {

	if (camera_position == 0) {
		if (rotate_world) {
			cameraControls.object.position.set( 0, 48*scale_factor, 12*scale_factor );
		} else {
			cameraControls.object.position.set( 100*scale_factor, 24*scale_factor, 50*scale_factor );
		}
	} else {
		cameraControls.object.position.set(camera_position.x,camera_position.y,camera_position.z);
	}

	if (rotate_world) {
		cameraControls.target.set(0,0,1*scale_factor);
	} else {
		cameraControls.target.set(0,5*scale_factor,0);
	}
}

function animate() {
	window.requestAnimationFrame(animate);
	render();
}

function render() {
	var delta = clock.getDelta();
	cameraControls.update(delta);

	if (last_speed != play_speed) {
		last_speed = play_speed;
	}

	// Update the transitionTime variable.
	transitionTime -= delta;

	// Update the position and rotation of objects in the simulation.
	// Check to see if the paused radio button is checked.
	
	// Render the frame necessary to maintain the playback speed.
	current_timestep = Math.floor(sim_time/(timestep*substeps));

	// Update the sim time display.
	document.getElementById("sim_time").textContent = (current_timestep*timestep*substeps).toFixed(3);
	
	if ( !playbackController.paused && transitionTime < 0.0) {

		newTime += delta;
		if ( newTime > oldTime + 1/fps ) {

			// Update the simulation time elapsed element. (I log every 4th physics simulation position.)
			document.getElementById("time_slider_control").value = (current_timestep*timestep*substeps)/eval_time;

			// Get the time difference between renders and adjust for playback speed.
			sim_time += play_direction*((newTime-oldTime)*play_speed);

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
					read_file();

					// Reset the camera position.
					reset_camera_position();

					// Reset time variables to avoid jumping in the simulation.
					oldTime = clock.getDelta();

					transitionTime = 0.5;

					// Reset the simulation counter to 0.0
					document.getElementById("sim_time").textContent = (0.00000).toFixed(3);
				}
			} else if ( sim_time < 0 ) {
				current_timestep = positions.length - 1;
				sim_time = parseFloat(eval_time);
			}

			var j = current_timestep;
			//Update the positions of the model bodies.
			for (var i = 0; i < animated_objects.length; ++i) {
				if (rotate_world) {
					// animated_objects[i].position.set( 0,0,0 );

					// Setup an object's quaternion.
					var a = [1,2,3,0]; // ODE -> WebGL Quaternion Ordering (ODE:w,x,y,z -> 3JS:x,y,z,w)
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
					animated_objects[i].quaternion.copy(tmpQuat.set( 	quaternions[j][i*4+a[0]],
														quaternions[j][i*4+a[1]],
														quaternions[j][i*4+a[2]],
														quaternions[j][i*4+a[3]] ));
					
					// Set an object's position.
					animated_objects[i].position.set( 	positions[j][i*3]*scale_factor, 
														positions[j][i*3+1]*scale_factor, 
														positions[j][i*3+2]*scale_factor );
				}

				// Change the colors of the components.
				if (variable_colors == true) {
					if (animated_objects[i].type == "cube" || animated_objects[i].type == "capped_cylinder") {
						animated_objects[i].children[0].material.color.set("#"+parseInt(colors[j][i]).toString(16));
					}
				}

			}

			if (alphas.length > 0) {
				var j = current_timestep;
				// Update the alpha shading of the bodies.
				for (var i = 0; i < animated_objects.length; ++i) {
					if (animated_objects[i].type == "cube" || animated_objects[i].type == "capped_cylinder") {
						animated_objects[i].children[0].material.opacity = alphas[j][i];
					}
				}

				var anim_length = animated_objects.length;

				// Update the alpha shading of the terrain objects.
				for (var i = 0; i < static_objects.length; ++i) {
					if (static_objects[i].type == "sphere") {
						console.log(j);
						static_objects[i].children[0].material.materials[0].opacity = alphas[j][i+anim_length];
						static_objects[i].children[0].material.materials[1].opacity = alphas[j][i+anim_length];
					}
				}
			}

			// Update the camera position.
			if (animated_objects.length > 0 && cameraFollow) {
				// Update the camera position to follow the object from whatever it's current position is.
				// Moves by the delta between the object's current position and it's previous position
				cameraControls.object.position = new THREE.Vector3(
					cameraControls.object.position.x - (prev_pos[0] - animated_objects[LOOK_AT].position.x),
					cameraControls.object.position.y,
					cameraControls.object.position.z)// - (prev_pos[2] - animated_objects[LOOK_AT].position.z)
				);

				// Update the target of the camera (Where it is looking at.)
				cameraControls.target = new THREE.Vector3( 	animated_objects[LOOK_AT].position.x,
															cameraControls.target.y,
															animated_objects[LOOK_AT].position.z );

				// Update the previous position of the robot so that camera following works.
				prev_pos[0] = animated_objects[LOOK_AT].position.x;
				prev_pos[1] = animated_objects[LOOK_AT].position.y;
				prev_pos[2] = animated_objects[LOOK_AT].position.z;

				light.position.set(animated_objects[LOOK_AT].position.x,light.position.y,animated_objects[LOOK_AT].position.z);
				light.target.position.set(animated_objects[LOOK_AT].position.x,0,animated_objects[LOOK_AT].position.z);

			} 

			// Keep track of the camera position whether or not we are following.
			camera_position = new THREE.Vector3(
				cameraControls.object.position.x - animated_objects[LOOK_AT].position.x,
				cameraControls.object.position.y,
				cameraControls.object.position.z - animated_objects[LOOK_AT].position.z
			);
			oldTime = newTime;
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
		color: "#FF0000",
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
	colors = [];
	variable_colors = false;
	animated_objects = [];
	static_objects = [];
	prev_pos = [0,0,0];
	oldTime = 0;
	newTime = 0;
	current_timestep = 0;
	sim_time = 0;

	//Split data into setup data and animation data.
	//Parse the user data.

	var setup_data = [];
	lines = data.split(/\r?\n/);
	if (lines[0] == "Version 0.1") {
		create_object_ptr = ObjectCreator.v_0_1_create_object;
		setup_data = parse_input_file(lines);
	} else if (lines[0] == "Version 0.2") {
		// Set flag to rotate incoming data by 90 degrees on the x-axis (swap y and z)
		rotate_world = true;

		create_object_ptr = ObjectCreator.v_0_2_create_object;
		
		setup_data = parse_input_file(lines);
	} else if (lines[0] == "Version 0.3") {
		// Set flag to rotate incoming data by 90 degrees on the x-axis (swap y and z)
		rotate_world = false;
		
		create_object_ptr = ObjectCreator.v_0_2_create_object;

		// Set the flag for variable colors.
		variable_colors = true;

		setup_data = v_0_3_parse_file(lines);
	} else if (lines[0] == "Version 0.4") {
		// Set flag to rotate incoming data by 90 degrees on the x-axis (swap y and z)
		rotate_world = false;
		
		create_object_ptr = ObjectCreator.v_0_2_create_object;

		// Set the flag for variable colors.
		variable_colors = true;

		setup_data = v_0_4_parse_file(lines);
	} else {
		alert("Unknown Version Number!")
		return;
	}

	// Call this per each read-in.
	fillScene(setup_data);

	// Add the objects associated with the robot itself to the color changer.
	colorController.objects.length = 0;

	// Add the default "All" option
	colorController.objects.push("All");
	colorController.colors.push(0xFF0000);

	// Add each component individually.
	for(i=0; i < animated_objects.length; ++i) {
		colorController.objects.push(i);
		colorController.colors.push(color_queue[i]);
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

	substeps = eval_time/timestep/(positions.length-1);

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
	// if (color_str == "Green") {
	// 	return 0x004000;
	// } else if (color_str == "Gray") {
	// 	return 0x383838;
	// } else if (color_str == "Red") {
	// 	return 0x9E0000;
	// } else {
	// 	return 0xF4C154;
	// }
	return color_str
}


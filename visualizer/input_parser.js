////////////////////////////////////////////////////////////////////////////////
// Handle the input file information by version.
////////////////////////////////////////////////////////////////////////////////

//Convert the given text line to an array of floats.
function floatify( parsed ) {
	var floats = [];
	for (var i = 0; i < parsed.length; ++i) {
		floats.push( parseFloat(parsed[i]) );
	}
	return floats;
}

////////////////////////////////////////////////////////////////////////////////
// Version 0.1

// Parse a given input file assuming specification Version 0.1
function v_0_1_parse_file(lines) {
	
	if(lines[0] != "Version 0.1") {
		alert("Version Number Mismatch!");
	}

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

	for (i; i < lines.length-1; i += 2) {
		positions.push( floatify(lines[i].split(",")) );
		quaternions.push( floatify(lines[i+1].split(",")) );
	}
}

////////////////////////////////////////////////////////////////////////////////
// Version 0.3

// Parse a given input file assuming specification Version 0.3
function v_0_3_parse_file(lines) {
	
	if(lines[0] != "Version 0.3") {
		alert("Version Number Mismatch!");
	}

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

		console.log(color_queue);
		//Skip the terminating tag of the color information
		i += 2;
	}

	for (i; i < lines.length-1; i += 3) {
		positions.push( floatify(lines[i].split(",")) );
		quaternions.push( floatify(lines[i+1].split(",")) );
		colors.push( lines[i+2].split(",") );
	}

	return setup_data
}

// Parse a given input file assuming specification Version 0.4
// Added the ability to define static objects, position doesn't need to be updated each timestep.
function v_0_4_parse_file(lines) {
	
	if(lines[0] != "Version 0.4") {
		alert("Version Number Mismatch!");
	}

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

		console.log(color_queue);
		//Skip the terminating tag of the color information
		i += 2;
	}

	for (i; i < lines.length-1; i += 4) {
		positions.push( floatify(lines[i].split(",")) );
		quaternions.push( floatify(lines[i+1].split(",")) );
		colors.push( lines[i+2].split(",") );
		alphas.push( lines[i+3].split(",") );
	}

	return setup_data
}

// Read a given string and create the object defined by it.
//
// Args:
// scene: 		WebGL scene to add object to 
// object_str: 	string containing information defining an object
function v_0_1_create_object( object_str ) {
	console.log("Trying to create object.")
	parsed = object_str.split(",");
	obj = new THREE.Object3D();
	len = parsed.length; //Capsules and boxes have different length specs
	// var a = [1,4,2,3];
	var a = [3,2,1,4];
	if (parsed[0] == "box") {
		cube_geom( obj, parsed[4]*scale_factor, parsed[5]*scale_factor, parsed[6]*scale_factor );
		obj['geom_type']="Cube";
	} else if(parsed[0] == "capsule") {
		capped_cylinder_geom( obj, parsed[5]*scale_factor, parsed[4]*scale_factor);
		obj['geom_type']="Sphere";
	}
	var quat = new THREE.Quaternion( parseFloat(parsed[len-a[0]]), parseFloat(parsed[len-a[1]]), parseFloat(parsed[len-a[2]]), parseFloat(parsed[len-a[3]]) );
	obj.quaternion = quat;
	obj.position.set( parsed[1]*scale_factor, parsed[2]*scale_factor, parsed[3]*scale_factor );
	
	animated_objects.push(obj);

	return obj;
}

////////////////////////////////////////////////////////////////////////////////
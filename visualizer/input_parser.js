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
	} else if(parsed[0] == "capsule") {
		capped_cylinder_geom( obj, parsed[5]*scale_factor, parsed[4]*scale_factor);
	}
	var quat = new THREE.Quaternion( parseFloat(parsed[len-a[0]]), parseFloat(parsed[len-a[1]]), parseFloat(parsed[len-a[2]]), parseFloat(parsed[len-a[3]]) );
	obj.quaternion = quat;
	obj.position.set( parsed[1]*scale_factor, parsed[2]*scale_factor, parsed[3]*scale_factor );
	
	animated_objects.push(obj);

	return obj;
}

////////////////////////////////////////////////////////////////////////////////
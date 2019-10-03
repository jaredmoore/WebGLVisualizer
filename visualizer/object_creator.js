// 

'use strict';

function object_creator() {

	// Variables needed to setup the objects
	var scale_factor = ""; 
	var color_queue = "";

	////////////////////////////////////////////////////////////////////////////////
	// File format parsing.
	////////////////////////////////////////////////////////////////////////////////

	////////////////////////////////////////////////////////////////////////////////
	// Default create_object method.
	//Read a given string and create the object defined by it.
	//
	//Args:
	//scene: 		WebGL scene to add object to 
	//object_str: 	string containing information defining an object
	//cq: 			color queue passed in from the skeleton
	//sf: 			scale factor to apply to the boxes
	this.create_object = function( object_str,cq,sf ) {
		scale_factor = sf;
		color_queue = cq;

		var parsed = object_str.split(",");
		var obj = new THREE.Object3D();
		var len = parsed.length; //Capsules and boxes have different length specs
		// var a = [1,4,2,3];
		var a = [3,2,1,4];
		if (parsed[0] == "box") {
			cube_geom( obj, parsed[4]*scale_factor, parsed[5]*scale_factor, parsed[6]*scale_factor );
			obj.type = "cube";
		} else if(parsed[0] == "capsule") {
			capped_cylinder_geom( obj, parsed[5]*scale_factor, parsed[4]*scale_factor);
			obj.type = "capped_cylinder";
		} else if(parsed[0] == "cylinder") {
			cylinder_geom( obj, parsed[5]*scale_factor, parsed[4]*scale_factor )
			obj.type = "cylinder";
		} else if(parsed[0] == "sphere") {
			sphere_geom( obj, parsed[4]*scale_factor )
			obj.type = "sphere";
		}

		obj.quaternion.copy(
			tmpQuat.set( parseFloat(parsed[len-a[0]]), 
				parseFloat(parsed[len-a[1]]), 
				parseFloat(parsed[len-a[2]]), 
				parseFloat(parsed[len-a[3]]) )
			);
		obj.position.set( parsed[1]*scale_factor, parsed[2]*scale_factor, parsed[3]*scale_factor );

		return ["animated",obj];
	}

	////////////////////////////////////////////////////////////////////////////////
	// Version 0.1 file format parsing
	// Read a given string and create the object defined by it.
	//
	// Args:
	// scene: 		WebGL scene to add object to 
	// object_str: 	string containing information defining an object
	this.v_0_1_create_object = function( object_str,cq,sf ) {
		scale_factor = sf;
		color_queue = cq;

		var object_type = "animated";
		var parsed = object_str.split(",");
		var obj = new THREE.Object3D();
		var len = parsed.length; //Capsules and boxes have different length specs
		// var a = [1,4,2,3];
		var a = [3,2,1,4];
		
		if (parsed[0] == "scene_sphere") {
			sphere_geom(obj,parsed[4]*scale_factor,0.6, false);

			// Set the position of the object.
			obj.position.set( parsed[1]*scale_factor, parsed[2]*scale_factor, parsed[3]*scale_factor );

			object_type = "static";
			obj.type = "sphere";
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

			object_type = "static";
			obj.type = "cube";
		} else {
			if (parsed[0] == "box") {
				cube_geom( obj, parsed[4]*scale_factor, parsed[5]*scale_factor, parsed[6]*scale_factor );
				obj.type = "cube";
			} else if(parsed[0] == "capsule") {
				capped_cylinder_geom( obj, parsed[5]*scale_factor, parsed[4]*scale_factor);
				obj.type = "capped_cylinder";
			}  else if(parsed[0] == "cylinder") {
				cylinder_geom( obj, parsed[5]*scale_factor, parsed[4]*scale_factor )
				obj.type = "cylinder";
			} else if(parsed[0] == "sphere") {
				sphere_geom( obj, parsed[4]*scale_factor )
				obj.type = "sphere";
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
		}

		return [object_type,obj];
	} 

	////////////////////////////////////////////////////////////////////////////////

	////////////////////////////////////////////////////////////////////////////////
	// Version 0.2 file format parsing
	// No change in create_object between Version 0.1 and 0.2
	this.v_0_2_create_object = this.v_0_1_create_object;

	//Create a capped cylinder and display it to the screen.
	//
	//Args:
	//base_object: 	THREE.Object3D object
	//rad: 			radius of the capped cylinder
	//height: 		height of the cylinder of the capsule (verified in ODE documentation) 
	var capped_cylinder_geom = function( base_object, rad, height ) {

		var color = 0xF40000;
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
	var cylinder_geom = function( base_object, rad, height ) {
		
		var color = 0xF40000;
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
	var sphere_geom = function( base_object, rad ) {
		
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
			var face = sphere_geometry.faces[i];
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
	var cube_geom = function( base_object, x, y, z ) {

		var color = 0xF40000;
		// if (color_queue.length > 0) {
		// 	color = color_queue.shift();
		// }

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
	var sphere_geom = function( base_object, rad, alpha, color ) {
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
				var face = sphere_geometry.faces[i+j];
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
}

var ObjectCreator = ObjectCreator || new object_creator();
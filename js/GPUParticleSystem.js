/*
 * GPU Particle System
 */

THREE.GPUParticleSystem = function( options ) {

	THREE.Object3D.apply( this, arguments );

	options = options || {};

	// parse options and use defaults

	this.PARTICLE_COUNT = options.maxParticles || 1000000;
	
	this.word = options.word.toUpperCase() || "";
	
	this.PARTICLE_CONTAINERS = this.word.length || 1;

	this.PARTICLE_NOISE_TEXTURE = options.particleNoiseTex || null;
	this.PARTICLE_SPRITE_TEXTURE = options.particleSpriteTex || null;

	this.PARTICLES_PER_CONTAINER = Math.ceil( this.PARTICLE_COUNT / this.PARTICLE_CONTAINERS );
	this.PARTICLE_CURSOR = 0;
	this.time = 0;
	this.particleContainers = [];
	this.rand = [];
	this.transparent = options.transparent;

	// custom vertex and fragement shader

	var GPUParticleShader = {

		vertexShader: [

			'uniform float uTime;',
			'uniform float uScale;',
			'uniform sampler2D tNoise;',
			'uniform float fallDown;',
			'uniform float crumble;',
			'uniform float startTimeToFall;',

			'attribute vec3 positionStart;',
			'attribute float startTime;',
			'attribute vec3 velocity;',
			'attribute float turbulence;',
			'attribute vec3 color;',
			'attribute float size;',
			'attribute float lifeTime;',
			//'attribute float fallDown;',
			
			
			'varying vec4 vColor;',
			'varying float lifeLeft;',

			'void main() {',

			// unpack things from our attributes'

			'	vColor = vec4( color, 1.0 );',

			// convert our velocity back into a value we can use'

			'	vec3 newPosition;',
			'	vec3 v;',
			'	vec3 a;',

			'	float timeElapsed = uTime - startTime;',

			'	lifeLeft = 1.0 - ( timeElapsed / lifeTime );',

			'	gl_PointSize = ( uScale * size );',

			'	v.x = velocity.x;',
			'	v.y = velocity.y;',
			'	v.z = velocity.z;',

			'	a.x = 0.0;',
			'	a.y = -9.8;',
			'	a.z = 0.0;',
			
			'	newPosition = positionStart;',
			'	if( fallDown == 1.0 ) {',
			'		newPosition = positionStart + v * ( uTime - startTimeToFall ) + a * ( uTime - startTimeToFall ) * ( uTime - startTimeToFall ) * 0.5;',			
			'	}	',
			

			'	if( crumble == 1.0) {',
			' 		if( positionStart.y < uTime - startTimeToFall - 6.1) {',
			'			newPosition = positionStart + a * ( uTime - startTimeToFall - positionStart.y - 6.1 ) * ( uTime - startTimeToFall - positionStart.y - 6.1 ) * 0.5;',
			'		}	',
			'	}	',
			
			'	if( startTime > startTimeToFall && fallDown == 1.0) {',

			'		newPosition = positionStart;',

			'	}',
			
			
			'	vec3 noise = texture2D( tNoise, vec2( newPosition.x * 0.015 + ( uTime * 0.05 ), newPosition.y * 0.02 + ( uTime * 0.015 ) ) ).rgb;',
			'	vec3 noiseVel = ( noise.rgb - 0.5 ) * 30.0;',

			'	newPosition = mix( newPosition, newPosition + vec3( noiseVel * ( turbulence * 5.0 ) ), ( timeElapsed / lifeTime ) );',

			
			'	if( v.x < - 1.45 ) {',

			'		lifeLeft = 0.0;',

			'	}',

			'	if( timeElapsed > 0.0 ) {',

			'		gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );',

			'	} else {',

			'		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
			'		lifeLeft = 0.0;',
			'		gl_PointSize = 0.;',

			'	}',

			'}'

		].join( '\n' ),

		fragmentShader: [

			'float scaleLinear( float value, vec2 valueDomain ) {',

			'	return ( value - valueDomain.x ) / ( valueDomain.y - valueDomain.x );',

			'}',

			'float scaleLinear( float value, vec2 valueDomain, vec2 valueRange ) {',

			'	return mix( valueRange.x, valueRange.y, scaleLinear( value, valueDomain ) );',

			'}',

			'varying vec4 vColor;',
			'varying float lifeLeft;',

			'uniform sampler2D tSprite;',

			'void main() {',

			'	float alpha = 0.;',

			'	if( lifeLeft > 0.995 ) {',

			'		alpha = scaleLinear( lifeLeft, vec2( 1.0, 0.995 ), vec2( 0.0, 1.0 ) );',

			'	} else {',

			'		alpha = lifeLeft * 0.75;',

			'	}',

			'	vec4 tex = texture2D( tSprite, gl_PointCoord );',
			'	gl_FragColor = vec4( vColor.rgb * tex.a, alpha * tex.a );',

			'}'

		].join( '\n' )

	};

	// preload a million random numbers

	var i;

	for ( i = 1e5; i > 0; i-- ) {

		this.rand.push( Math.random() - 0.5 );

	}

	this.random = function() {

		return ++ i >= this.rand.length ? this.rand[ i = 1 ] : this.rand[ i ];

	};

	var textureLoader = new THREE.TextureLoader();

	this.particleNoiseTex = this.PARTICLE_NOISE_TEXTURE || textureLoader.load( 'textures/perlin-512.png' );
	this.particleNoiseTex.wrapS = this.particleNoiseTex.wrapT = THREE.RepeatWrapping;

	this.particleSpriteTex = this.PARTICLE_SPRITE_TEXTURE || textureLoader.load( 'textures/particle2.png' );
	this.particleSpriteTex.wrapS = this.particleSpriteTex.wrapT = THREE.RepeatWrapping;
	
	this.particleShaderMat = new THREE.ShaderMaterial( {
		//MODIFICATO
		transparent: this.transparent,
		depthWrite: false,
		uniforms: {
			'uTime': {
				value: 0.0
			},
			'uScale': {
				value: 1.0
			},
			'tNoise': {
				value: this.particleNoiseTex
			},
			'tSprite': {
				value: this.particleSpriteTex
			},
			'fallDown': {
				value: 0.0
			},
			'crumble': {
				value: 0.0
			},
			'startTimeToFall': {
				value: 0.0
			}
		},
		blending: THREE.AdditiveBlending,
		vertexShader: GPUParticleShader.vertexShader,
		fragmentShader: GPUParticleShader.fragmentShader
	} );

	// define defaults for all values

	this.particleShaderMat.defaultAttributeValues.particlePositionsStartTime = [ 0, 0, 0, 0 ];
	this.particleShaderMat.defaultAttributeValues.particleVelColSizeLife = [ 0, 0, 0, 0 ];

	this.init = function() {

		for ( var i = 0; i < this.PARTICLE_CONTAINERS; i ++ ) {

			var c = new THREE.GPUParticleContainer( this.PARTICLES_PER_CONTAINER, this, i);
			this.particleContainers.push( c );
			this.add( c );

		}
	};

	this.spawnParticle = function( options ) {

		this.PARTICLE_CURSOR ++;

		if ( this.PARTICLE_CURSOR >= this.PARTICLE_COUNT ) {

			this.PARTICLE_CURSOR = 1;
		}

		var currentContainer = this.particleContainers[ Math.floor( this.PARTICLE_CURSOR / this.PARTICLES_PER_CONTAINER ) ];

		currentContainer.spawnParticle( options );

	};
	
	this.changeTransparent = function( transparent){
		this.particleShaderMat.transparent = transparent;
	}
	
	//explode: 1 -> start exlosion, 0: stop
	this.explodeParticle = function( explode ){
		
		this.particleShaderMat.uniforms.fallDown.value = explode;
		this.particleShaderMat.uniforms.startTimeToFall.value = this.particleShaderMat.uniforms.uTime.value;
		this.particleShaderMat.uniforms.crumble.value = 0.0;
		
		var container = this.particleContainers[ 0 ];
		var startTimeAttribute = container.particleShaderGeo.getAttribute( 'startTime' );
		//var startTimeAttribute = this.particleShaderGeo.getAttribute( 'startTime' );
		startTimeAttribute.array[ this.PARTICLE_CURSOR ] = this.particleShaderMat.uniforms.uTime.value;
		container.particleUpdate = true;
		container.geometryUpdate();
		
	};
	
	//cremble: 1 -> start crumble, 0: stop
	this.crumbleParticle = function( crumble ){

		this.particleShaderMat.uniforms.crumble.value = crumble;
		this.particleShaderMat.uniforms.startTimeToFall.value = this.particleShaderMat.uniforms.uTime.value;
		this.particleShaderMat.uniforms.fallDown.value = 0.0;
		
		var container = this.particleContainers[ 0 ];
		var startTimeAttribute = container.particleShaderGeo.getAttribute( 'startTime' );
		startTimeAttribute.array[ this.PARTICLE_CURSOR ] = this.particleShaderMat.uniforms.uTime.value;
		container.particleUpdate = true;
		container.geometryUpdate();
		
	};
	

	this.update = function( time ) {

		for ( var i = 0; i < this.PARTICLE_CONTAINERS; i ++ ) {

			this.particleContainers[ i ].update( time );

		}

	};

	this.dispose = function() {

		this.particleShaderMat.dispose();
		this.particleNoiseTex.dispose();
		this.particleSpriteTex.dispose();

		for ( var i = 0; i < this.PARTICLE_CONTAINERS; i ++ ) {

			this.particleContainers[ i ].dispose();

		}

	};

	this.init();

};

THREE.GPUParticleSystem.prototype = Object.create( THREE.Object3D.prototype );
THREE.GPUParticleSystem.prototype.constructor = THREE.GPUParticleSystem;


// Subclass for particle containers, allows for very large arrays to be spread out

THREE.GPUParticleContainer = function( maxParticles, particleSystem, number ) {

	THREE.Object3D.apply( this, arguments );

	this.PARTICLE_COUNT = maxParticles || 100000;
	this.PARTICLE_CURSOR = 0;
	this.time = 0;
	this.offset = 0;
	this.count = 0;
	this.DPR = window.devicePixelRatio;
	this.GPUParticleSystem = particleSystem;
	this.particleUpdate = false;
	this.letter = this.GPUParticleSystem.word.charAt(number);
	this.NUMBER = number;

	// geometry

	this.particleShaderGeo = new THREE.BufferGeometry();

	this.particleShaderGeo.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array( this.PARTICLE_COUNT * 3 ), 3 ).setDynamic( true ) );
	this.particleShaderGeo.addAttribute( 'positionStart', new THREE.BufferAttribute( new Float32Array( this.PARTICLE_COUNT * 3 ), 3 ).setDynamic( true ) );
	this.particleShaderGeo.addAttribute( 'startTime', new THREE.BufferAttribute( new Float32Array( this.PARTICLE_COUNT ), 1 ).setDynamic( true ) );
	this.particleShaderGeo.addAttribute( 'velocity', new THREE.BufferAttribute( new Float32Array( this.PARTICLE_COUNT * 3 ), 3 ).setDynamic( true ) );
	this.particleShaderGeo.addAttribute( 'turbulence', new THREE.BufferAttribute( new Float32Array( this.PARTICLE_COUNT ), 1 ).setDynamic( true ) );
	this.particleShaderGeo.addAttribute( 'color', new THREE.BufferAttribute( new Float32Array( this.PARTICLE_COUNT * 3 ), 3 ).setDynamic( true ) );
	this.particleShaderGeo.addAttribute( 'size', new THREE.BufferAttribute( new Float32Array( this.PARTICLE_COUNT ), 1 ).setDynamic( true ) );
	this.particleShaderGeo.addAttribute( 'lifeTime', new THREE.BufferAttribute( new Float32Array( this.PARTICLE_COUNT ), 1 ).setDynamic( true ) );
	
	// material

	this.particleShaderMat = this.GPUParticleSystem.particleShaderMat;

	var position = new THREE.Vector3();
	var velocity = new THREE.Vector3();
	var color = new THREE.Color();
	
	
	this.spawnParticle = function( options ) {

		var positionStartAttribute = this.particleShaderGeo.getAttribute( 'positionStart' );
		var startTimeAttribute = this.particleShaderGeo.getAttribute( 'startTime' );
		var velocityAttribute = this.particleShaderGeo.getAttribute( 'velocity' );
		var turbulenceAttribute = this.particleShaderGeo.getAttribute( 'turbulence' );
		var colorAttribute = this.particleShaderGeo.getAttribute( 'color' );
		var sizeAttribute = this.particleShaderGeo.getAttribute( 'size' );
		var lifeTimeAttribute = this.particleShaderGeo.getAttribute( 'lifeTime' );
	
		options = options || {};

		// setup reasonable default values for all arguments

		position = options.position !== undefined ? position.copy( options.position ) : position.set( 0, 0, 0 );
		velocity = options.velocity !== undefined ? velocity.copy( options.velocity ) : velocity.set( 0, 0, 0 );
		color = options.color !== undefined ? color.set( options.color ) : color.set( 0xffffff );

		var positionRandomness = options.positionRandomness !== undefined ? options.positionRandomness : 0;
		var velocityRandomness = options.velocityRandomness !== undefined ? options.velocityRandomness : 0;
		var colorRandomness = options.colorRandomness !== undefined ? options.colorRandomness : 1;
		var turbulence = options.turbulence !== undefined ? options.turbulence : 1;
		var lifetime = options.lifetime !== undefined ? options.lifetime : 5;
		var size = options.size !== undefined ? options.size : 10;
		var sizeRandomness = options.sizeRandomness !== undefined ? options.sizeRandomness : 0;
		var smoothPosition = options.smoothPosition !== undefined ? options.smoothPosition : false;
	
		if ( this.DPR !== undefined ) size *= this.DPR;

		i = this.PARTICLE_CURSOR;
		
		
		// position
		
		positionStartAttribute.array[ i * 3 + 0 ] = position.x + ( particleSystem.random() * positionRandomness );
		positionStartAttribute.array[ i * 3 + 1 ] = position.y + ( particleSystem.random() * positionRandomness );
		positionStartAttribute.array[ i * 3 + 2 ] = position.z + ( particleSystem.random() * positionRandomness );
		
		var center = this.GPUParticleSystem.word.length / 2 * 10;
		switch(this.letter){
			case "I":
				positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 3 ) + this.NUMBER * 10 - center;
				positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 12);
				positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 3 );
			break;
			case "L":
				if(Math.random() > 0.3){
					positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 3 - 3) + this.NUMBER * 10 - center;
					positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 12);
					positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 3 );
				}else{
					positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 5 + 1) + this.NUMBER * 10 - center;
					positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 3 - 4.5);
					positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 3 );
				}
			break;
			case "E":
				if(Math.random() < 0.45){
					positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 3 - 3) + this.NUMBER * 10 - center;
					positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 12);
				}else{
					var val = Math.random();
					if(val < 0.3){
						positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 3 + 2 - 2) + this.NUMBER * 10 - center;
						positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 3);
					}else {
						positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 5 + 2 - 1) + this.NUMBER * 10 - center;
						if(val < 0.65)
							positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 3 - 4.5);
						else 
							positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 3 + 4.5);
					}
				}
				positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 3 );
			break;
			case "F":
				if(Math.random() < 0.6){
					positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 3 - 3) + this.NUMBER * 10 - center;
					positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 12);
				}else{
					var val = Math.random();
					if(val < 0.4){
						positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 3 + 2 - 2) + this.NUMBER * 10 - center;
						positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 3);
					}else {
						positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 5 + 2 - 1) + this.NUMBER * 10 - center;
						positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 3 + 4.5);
					}
				}
				positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 3 );
			break;
			case "T":
				if(Math.random() < 0.6){
					positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 3) + this.NUMBER * 10 - center;
					positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 9 - 1.5);
				}else{
					positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 8) + this.NUMBER * 10 - center;
					positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 3 + 4.5);
				}
				positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 3 );
			break;
			case "O":
				positionStartAttribute.array[ i * 3 + 0 ] = ( Math.cos(i) * 3.5 + particleSystem.random() * 2 - 0.8) + this.NUMBER * 10 - center;
				positionStartAttribute.array[ i * 3 + 1 ] = ( Math.sin(i) * 5 + particleSystem.random() * 2);
				positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
			break;
			case "0":
				positionStartAttribute.array[ i * 3 + 0 ] = ( Math.cos(i) * 3 + particleSystem.random() * 1.5 - 0.8) + this.NUMBER * 10 - center;
				positionStartAttribute.array[ i * 3 + 1 ] = ( Math.sin(i) * 5 + particleSystem.random() * 2);
				positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
			break;
			case "C":
				if(Math.cos(i) < 0 || (Math.cos(i) > 0 && (Math.sin(i) > 0.8 || Math.sin(i) < -0.8))){
					positionStartAttribute.array[ i * 3 + 0 ] = ( Math.cos(i) * 4 + particleSystem.random() * 2) + this.NUMBER * 10 - center;
					positionStartAttribute.array[ i * 3 + 1 ] = ( Math.sin(i) * 5 + particleSystem.random() * 2);
					positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
				}
				else{
					positionStartAttribute.array[ i * 3 + 0 ] = ( - Math.cos(i) * 4 + particleSystem.random() * 2) + this.NUMBER * 10 - center;
					positionStartAttribute.array[ i * 3 + 1 ] = ( - Math.sin(i) * 5 + particleSystem.random() * 2);
					positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
				}
			break;
			case "G":
				var cas = Math.random();
				if(Math.cos(i) < 0.55){
					positionStartAttribute.array[ i * 3 + 0 ] = ( Math.cos(i) * 4 + particleSystem.random() * 2) + this.NUMBER * 10 - center;
					positionStartAttribute.array[ i * 3 + 1 ] = ( Math.sin(i) * 5 + particleSystem.random() * 2);
					positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
				}else{
					if(Math.random() > 0.5){
						positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 1.3 + 2.3 ) + this.NUMBER * 10 - center;
						positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 4 - 4);
						positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
					}else{
						positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 3 + 2 ) + this.NUMBER * 10 - center;
						positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 1.2 - 1.8);
						positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
					}
				}
			break;
			case "-":
				positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 4 ) + this.NUMBER * 10 - center;
				positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 1 );
				positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
			break;
			case "3":
				if(Math.random() > 0.5){
					if(Math.cos(i) < 0 && Math.sin(i) < 0){
						positionStartAttribute.array[ i * 3 + 0 ] = ( - Math.cos(i) * 3 + particleSystem.random() * 2) + this.NUMBER * 10 - center;
						positionStartAttribute.array[ i * 3 + 1 ] = ( - Math.sin(i) * 2.5 + particleSystem.random() * 2 + 2.5);
						positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
					}else{
						positionStartAttribute.array[ i * 3 + 0 ] = ( Math.cos(i) * 3 + particleSystem.random() * 2) + this.NUMBER * 10 - center;
						positionStartAttribute.array[ i * 3 + 1 ] = ( Math.sin(i) * 2.5 + particleSystem.random() * 2 + 2.5);
						positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
					}
				}else{
					if(Math.cos(i) < 0 && Math.sin(i) > 0){
						positionStartAttribute.array[ i * 3 + 0 ] = ( - Math.cos(i) * 3 + particleSystem.random() * 2) + this.NUMBER * 10 - center;
						positionStartAttribute.array[ i * 3 + 1 ] = ( - Math.sin(i) * 2.5 + particleSystem.random() * 2 - 2.5);
						positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
					}else{
						positionStartAttribute.array[ i * 3 + 0 ] = ( Math.cos(i) * 3 + particleSystem.random() * 2) + this.NUMBER * 10 - center;
						positionStartAttribute.array[ i * 3 + 1 ] = ( Math.sin(i) * 2.5 + particleSystem.random() * 2 - 2.5);
						positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
					}
				}
			break;
			case "D":
				if(Math.cos(i) > -0.1){
					positionStartAttribute.array[ i * 3 + 0 ] = ( Math.cos(i) * 4 + particleSystem.random() * 2 - 1) + this.NUMBER * 10 - center;
					positionStartAttribute.array[ i * 3 + 1 ] = ( Math.sin(i) * 5 + particleSystem.random() * 2);
					positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
				}
				else{
					positionStartAttribute.array[ i * 3 + 0 ] = ( particleSystem.random() * 2.5 - 2.5) + this.NUMBER * 10 - center;
					positionStartAttribute.array[ i * 3 + 1 ] = ( particleSystem.random() * 12);
					positionStartAttribute.array[ i * 3 + 2 ] = ( particleSystem.random() * 5 );
				}
			break;
		}
		
		velX = Math.random()*velocityRandomness - velocityRandomness/2.0;
		velY = Math.random()*velocityRandomness - velocityRandomness/2.0;
		velZ = Math.random()*velocityRandomness - velocityRandomness/2.0;

		if ( smoothPosition === true ) {

			positionStartAttribute.array[ i * 3 + 0 ] += - ( velocity.x * particleSystem.random() );
			positionStartAttribute.array[ i * 3 + 1 ] += - ( velocity.y * particleSystem.random() );
			positionStartAttribute.array[ i * 3 + 2 ] += - ( velocity.z * particleSystem.random() );

		}

		// velocity
		velocityAttribute.array[ i * 3 + 0 ] = velX;
		velocityAttribute.array[ i * 3 + 1 ] = velY;
		velocityAttribute.array[ i * 3 + 2 ] = velZ;
		

		// color

		color.r = THREE.Math.clamp( color.r + particleSystem.random() * colorRandomness, 0, 1 );
		color.g = THREE.Math.clamp( color.g + particleSystem.random() * colorRandomness, 0, 1 );
		color.b = THREE.Math.clamp( color.b + particleSystem.random() * colorRandomness, 0, 1 );

		colorAttribute.array[ i * 3 + 0 ] = color.r;
		colorAttribute.array[ i * 3 + 1 ] = color.g;
		colorAttribute.array[ i * 3 + 2 ] = color.b;

		// turbulence, size, lifetime and starttime

		turbulenceAttribute.array[ i ] = turbulence;
		sizeAttribute.array[ i ] = size + particleSystem.random() * sizeRandomness;
		lifeTimeAttribute.array[ i ] = lifetime;
		startTimeAttribute.array[ i ] = this.time + particleSystem.random() * 2e-2;
	
		// offset

		if ( this.offset === 0 ) {

			this.offset = this.PARTICLE_CURSOR;

		}

		// counter and cursor

		this.count ++;
		this.PARTICLE_CURSOR ++;

		//restart from the first particle
		/*
		if ( this.PARTICLE_CURSOR >= this.PARTICLE_COUNT ) {

			this.PARTICLE_CURSOR = 0;

		}
		*/

		this.particleUpdate = true;

	};

	this.init = function() {

		this.particleSystem = new THREE.Points( this.particleShaderGeo, this.particleShaderMat );
		this.particleSystem.frustumCulled = false;
		this.add( this.particleSystem );

	};

	this.update = function( time ) {

		this.time = time;
		this.particleShaderMat.uniforms.uTime.value = time;

		this.geometryUpdate();

	};

	this.geometryUpdate = function() {

		if ( this.particleUpdate === true ) {

			this.particleUpdate = false;

			var positionStartAttribute = this.particleShaderGeo.getAttribute( 'positionStart' );
			var startTimeAttribute = this.particleShaderGeo.getAttribute( 'startTime' );
			var velocityAttribute = this.particleShaderGeo.getAttribute( 'velocity' );
			var turbulenceAttribute = this.particleShaderGeo.getAttribute( 'turbulence' );
			var colorAttribute = this.particleShaderGeo.getAttribute( 'color' );
			var sizeAttribute = this.particleShaderGeo.getAttribute( 'size' );
			var lifeTimeAttribute = this.particleShaderGeo.getAttribute( 'lifeTime' );
			
			if ( this.offset + this.count < this.PARTICLE_COUNT ) {

				positionStartAttribute.updateRange.offset = this.offset * positionStartAttribute.itemSize;
				startTimeAttribute.updateRange.offset = this.offset * startTimeAttribute.itemSize;
				velocityAttribute.updateRange.offset = this.offset * velocityAttribute.itemSize;
				turbulenceAttribute.updateRange.offset = this.offset * turbulenceAttribute.itemSize;
				colorAttribute.updateRange.offset = this.offset * colorAttribute.itemSize;
				sizeAttribute.updateRange.offset = this.offset * sizeAttribute.itemSize;
				lifeTimeAttribute.updateRange.offset = this.offset * lifeTimeAttribute.itemSize;
			
				positionStartAttribute.updateRange.count = this.count * positionStartAttribute.itemSize;
				startTimeAttribute.updateRange.count = this.count * startTimeAttribute.itemSize;
				velocityAttribute.updateRange.count = this.count * velocityAttribute.itemSize;
				turbulenceAttribute.updateRange.count = this.count * turbulenceAttribute.itemSize;
				colorAttribute.updateRange.count = this.count * colorAttribute.itemSize;
				sizeAttribute.updateRange.count = this.count * sizeAttribute.itemSize;
				lifeTimeAttribute.updateRange.count = this.count * lifeTimeAttribute.itemSize;
			
			} else {

				positionStartAttribute.updateRange.offset = 0;
				startTimeAttribute.updateRange.offset = 0;
				velocityAttribute.updateRange.offset = 0;
				turbulenceAttribute.updateRange.offset = 0;
				colorAttribute.updateRange.offset = 0;
				sizeAttribute.updateRange.offset = 0;
				lifeTimeAttribute.updateRange.offset = 0;
			
				positionStartAttribute.updateRange.count = positionStartAttribute.count;
				startTimeAttribute.updateRange.count = startTimeAttribute.count;
				velocityAttribute.updateRange.count = velocityAttribute.count;
				turbulenceAttribute.updateRange.count = turbulenceAttribute.count;
				colorAttribute.updateRange.count = colorAttribute.count;
				sizeAttribute.updateRange.count = sizeAttribute.count;
				lifeTimeAttribute.updateRange.count = lifeTimeAttribute.count;
			
			}

			positionStartAttribute.needsUpdate = true;
			startTimeAttribute.needsUpdate = true;
			velocityAttribute.needsUpdate = true;
			turbulenceAttribute.needsUpdate = true;
			colorAttribute.needsUpdate = true;
			sizeAttribute.needsUpdate = true;
			lifeTimeAttribute.needsUpdate = true;
			
			this.offset = 0;
			this.count = 0;

		}

	};

	this.dispose = function() {

		this.particleShaderGeo.dispose();

	};

	this.init();

};

THREE.GPUParticleContainer.prototype = Object.create( THREE.Object3D.prototype );
THREE.GPUParticleContainer.prototype.constructor = THREE.GPUParticleContainer;

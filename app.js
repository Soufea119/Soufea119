import * as THREE from './libs/three/three.module.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';
import { DRACOLoader } from './libs/three/jsm/DRACOLoader.js';
import { RGBELoader } from './libs/three/jsm/RGBELoader.js';
import { Stats } from './libs/stats.module.js';
import { LoadingBar } from './libs/LoadingBar.js';
import { VRButton } from './libs/VRButton.js';
import { CanvasUI } from './libs/CanvasUI.js';
import { GazeController } from './libs/GazeController.js'
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';

class BloodDrip {
    constructor(texture, startPos, scene) {
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        this.sprite = new THREE.Sprite(material);
        this.sprite.scale.set(0.15, 0.15, 1); // Blood drop size
        this.sprite.position.copy(startPos);
        this.speed = 0.02 + Math.random() * 0.01; // Slightly random fall speed
        this.lifetime = 4; // seconds
        scene.add(this.sprite);
        this.scene = scene;
    }

    update(dt) {
        this.sprite.position.y -= this.speed;
        this.lifetime -= dt;
        if (this.lifetime < 0) {
            this.scene.remove(this.sprite);
            return false; // Remove from array
        }
        return true;
    }
}




class App{
	constructor(){
		const container = document.createElement( 'div' );
		document.body.appendChild( container );

		this.assetsPath = './assets/';
        
		this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.01, 500 );
		this.camera.position.set( 0, 1.6, 0 );
        
        this.dolly = new THREE.Object3D(  );
        this.dolly.position.set(0, 0, 10);
        this.dolly.add( this.camera );
        this.dummyCam = new THREE.Object3D();
        this.camera.add( this.dummyCam );
        
		this.scene = new THREE.Scene();
		this.listener = new THREE.AudioListener();
                this.camera.add(this.listener);

                const audioLoader = new THREE.AudioLoader();
                this.sound = new THREE.Audio(this.listener);

audioLoader.load(
    this.assetsPath + 'Mysterious Place - DarkEerie Music (Creative Commons).mp3',
    (buffer) => {
        this.sound.setBuffer(buffer);
        this.sound.setLoop(true);
        this.sound.setVolume(0.3);
        // ✅ Do not play yet — wait for user gesture
    },

    undefined,
    (err) => {
        console.error('An error occurred loading the audio:', err);
    }
);
		
		
                this.scene.fog = new THREE.Fog(0x000000, 2, 20); // Closer and darker fog

                this.scene.add( this.dolly );

		this.angels = [];
                this.spawnAngels(); // 👼 Spawn Weeping Angels


		this.darkLight = new THREE.HemisphereLight(0x222222, 0x000000, 0.5);
                this.darkLight.visible = false;
                this.scene.add(this.darkLight);


		this.originalEnvMap = null;
                this.originalBG = null;
                this.isDark = false;

		const ambient = new THREE.HemisphereLight(0xFFFFFF, 0xAAAAAA, 0.8);
		this.scene.add(ambient);
		this.darkLight = new THREE.HemisphereLight(0x222222, 0x000000, 0.5);
                this.darkLight.visible = false;
                this.scene.add(this.darkLight);


		this.renderer = new THREE.WebGLRenderer({ antialias: true });


		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
		this.renderer.outputEncoding = THREE.sRGBEncoding;
		container.appendChild( this.renderer.domElement );
		
        this.setEnvironment();
	
        window.addEventListener( 'resize', this.resize.bind(this) );
        
        this.clock = new THREE.Clock();
        this.up = new THREE.Vector3(0,1,0);
        this.origin = new THREE.Vector3();
        this.workingVec3 = new THREE.Vector3();
        this.workingQuaternion = new THREE.Quaternion();
        this.raycaster = new THREE.Raycaster();
        
        this.stats = new Stats();

		this.bloodDrips = [];
this.startDrippingBlood = false;
this.lastDripTime = 0;

// Load blood texture
const textureLoader = new THREE.TextureLoader();
textureLoader.load(this.assetsPath + 'BloodDrip.png', (texture) => {
    this.bloodTexture = texture;
});


		container.appendChild( this.stats.dom );
        
		this.loadingBar = new LoadingBar();
		
		this.loadCollege();
        
        this.immersive = false;
        
        const self = this;
        
        fetch('./college.json')
            .then(response => response.json())
            .then(obj =>{
                self.boardShown = '';
                self.boardData = obj;
            });
	}
	
setEnvironment() {
    const loader = new THREE.TextureLoader();
    const self = this;

    loader.load('./assets/skybox.jpg', function(texture) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        self.scene.background = texture;
        self.scene.environment = null; // No HDR lighting
    }, undefined, function(err) {
        console.error('An error occurred loading the skybox:', err);
    });
}

    
    resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );  
    }
    
loadCollege() {
    const loader = new GLTFLoader().setPath(this.assetsPath);
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./libs/three/js/draco/');
    loader.setDRACOLoader(dracoLoader);

    const self = this;

    loader.load(
        'college.glb',
        function (gltf) {
            const college = gltf.scene.children[0];
            self.scene.add(college);

            college.traverse(function (child) {
                if (child.isMesh) {
                    if (child.name.indexOf("PROXY") != -1) {
                        child.material.visible = false;
                        self.proxy = child;
                    } else if (child.material.name.indexOf('Glass') != -1) {
                        child.material.opacity = 0.1;
                        child.material.transparent = true;
                    } else if (child.material.name.indexOf("SkyBox") != -1) {
                        const mat1 = child.material;
                        const mat2 = new THREE.MeshBasicMaterial({ map: mat1.map });
                        child.material = mat2;
                        mat1.dispose();
                    }
                }
            });

            // Load the cat model
loader.load(
    'oiiaioooooiai_cat.glb',
    function (gltf) {
        const cat = gltf.scene;
        cat.scale.set(2, 2, 2);
        cat.position.set(0, 0, 0); // Don't offset in the wrapper
        cat.visible = true;

        // Create wrapper object for positioning + rotation
        const wrapper = new THREE.Object3D();
        wrapper.position.set(0, 0, -3); // Initial position
        wrapper.add(cat);
        self.scene.add(wrapper);

        // Store both wrapper and cat
        if (!self.cats) self.cats = [];
        self.cats.push({ wrapper, cat });
    },
    undefined,
    function (error) {
        console.error('An error occurred loading the cat model:', error);
    }
);



            // Load the Weeping Angels model
            loader.load(
                'WeepingAngels.glb',
                function (gltf) {
                    const angels = gltf.scene;
                    angels.scale.set(4, 4, 4);
                    angels.position.set(5, 0, -4);
                    self.scene.add(angels);
                    self.angels = angels;
                },
                undefined,
                function (error) {
                    console.error('An error occurred loading the Weeping Angels model:', error);
                }
            );

            // Setup door midpoint object
            const door1 = college.getObjectByName("LobbyShop_Door__1_");
            const door2 = college.getObjectByName("LobbyShop_Door__2_");
            const pos = door1.position.clone().sub(door2.position).multiplyScalar(0.5).add(door2.position);
            const obj = new THREE.Object3D();
            obj.name = "LobbyShop";
            obj.position.copy(pos);
            college.add(obj);

            self.loadingBar.visible = false;
            self.setupXR();
        },
        function (xhr) {
            self.loadingBar.progress = (xhr.loaded / xhr.total);
        },
        function (error) {
            console.log('An error happened');
        }
    );
}

    
    setupXR(){

	    this.renderer.xr.addEventListener('sessionstart', () => {
    if (this.sound && this.sound.buffer && !this.sound.isPlaying) {
        this.sound.play();
    }
		     this.startDrippingBlood = true;
    this.lastDripTime = performance.now();
});

        this.renderer.xr.enabled = true;

        const btn = new VRButton( this.renderer );
        
        const self = this;
        
        const timeoutId = setTimeout( connectionTimeout, 2000 );
        
        function onSelectStart( event ) {
        
            this.userData.selectPressed = true;
        
        }

        function onSelectEnd( event ) {
        
            this.userData.selectPressed = false;
        
        }
        
        function onConnected( event ){
            clearTimeout( timeoutId );
        }
        
        function connectionTimeout(){
            self.useGaze = true;
            self.gazeController = new GazeController( self.scene, self.dummyCam );
        }
        
        this.controllers = this.buildControllers( this.dolly );
        
        this.controllers.forEach( ( controller ) =>{
            controller.addEventListener( 'selectstart', onSelectStart );
            controller.addEventListener( 'selectend', onSelectEnd );
            controller.addEventListener( 'connected', onConnected );
        });
        
        const config = {
            panelSize: { height: 0.5 },
            height: 256,
            name: { fontSize: 50, height: 70 },
            info: { position:{ top: 70, backgroundColor: "#ccc", fontColor:"#000" } }
        }
        const content = {
            name: "name",
            info: "info"
        }
        
        this.ui = new CanvasUI( content, config );
        this.scene.add( this.ui.mesh );
        
        this.renderer.setAnimationLoop( this.render.bind(this) );
    }
    
    buildControllers( parent = this.scene ){
        const controllerModelFactory = new XRControllerModelFactory();

        const geometry = new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3( 0, 0, 0 ), new THREE.Vector3( 0, 0, -1 ) ] );

        const line = new THREE.Line( geometry );
        line.scale.z = 0;
        
        const controllers = [];
        
        for(let i=0; i<=1; i++){
            const controller = this.renderer.xr.getController( i );
            controller.add( line.clone() );
            controller.userData.selectPressed = false;
            parent.add( controller );
            controllers.push( controller );
            
            const grip = this.renderer.xr.getControllerGrip( i );
            grip.add( controllerModelFactory.createControllerModel( grip ) );
            parent.add( grip );
        }
        
        return controllers;
    }
    
    moveDolly(dt){
        if (this.proxy === undefined) return;
        
        const wallLimit = 1.3;
        const speed = 2;
		let pos = this.dolly.position.clone();
        pos.y += 1;
        
		let dir = new THREE.Vector3();
        //Store original dolly rotation
        const quaternion = this.dolly.quaternion.clone();
        //Get rotation for movement from the headset pose
        this.dolly.quaternion.copy( this.dummyCam.getWorldQuaternion(this.workingQuaternion) );
		this.dolly.getWorldDirection(dir);
        dir.negate();
		this.raycaster.set(pos, dir);
		
        let blocked = false;
		
		let intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0){
            if (intersect[0].distance < wallLimit) blocked = true;
        }
		
		if (!blocked){
            this.dolly.translateZ(-dt*speed);
            pos = this.dolly.getWorldPosition( this.origin );
		}
		
        //cast left
        dir.set(-1,0,0);
        dir.applyMatrix4(this.dolly.matrix);
        dir.normalize();
        this.raycaster.set(pos, dir);

        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0){
            if (intersect[0].distance<wallLimit) this.dolly.translateX(wallLimit-intersect[0].distance);
        }

        //cast right
        dir.set(1,0,0);
        dir.applyMatrix4(this.dolly.matrix);
        dir.normalize();
        this.raycaster.set(pos, dir);

        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0){
            if (intersect[0].distance<wallLimit) this.dolly.translateX(intersect[0].distance-wallLimit);
        }

        //cast down
        dir.set(0,-1,0);
        pos.y += 1.5;
        this.raycaster.set(pos, dir);
        
        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length>0){
            this.dolly.position.copy( intersect[0].point );
        } 
    //Restore the original rotation
        this.dolly.quaternion.copy( quaternion );
	}
		
    get selectPressed(){
        return ( this.controllers !== undefined && (this.controllers[0].userData.selectPressed || this.controllers[1].userData.selectPressed) );    
    }
    
    showInfoboard( name, info, pos ){
        if (this.ui === undefined ) return;
        this.ui.position.copy(pos).add( this.workingVec3.set( 0, 1.3, 0 ) );
        const camPos = this.dummyCam.getWorldPosition( this.workingVec3 );
        this.ui.updateElement( 'name', info.name );
        this.ui.updateElement( 'info', info.info );
        this.ui.update();
        this.ui.lookAt( camPos )
        this.ui.visible = true;
        this.boardShown = name;
    }

spawnAngels() {
		const loader = new GLTFLoader();
		loader.load(this.assetsPath + 'angel.glb', (gltf) => {
			for (let i = 0; i < 20; i++) {
				const angel = gltf.scene.clone();
				const range = 30;

				angel.position.set(
					(Math.random() - 0.5) * range,
					0,
					(Math.random() - 0.5) * range
				);

				angel.name = `angel_${i}`;
				this.scene.add(angel);
				this.angels.push(angel);
			}
		});
	}

render(timestamp, frame) {
    const dt = this.clock.getDelta();

 if (this.cats && this.cats.length > 0) {
    const playerPos = this.dolly.position.clone();
    const time = performance.now() * 0.001;

    this.cats.forEach((entry, i) => {
        const { wrapper, cat } = entry;

        const radius = 4 + i * 1.5;
        const angle = time + i * 0.5;

        const x = playerPos.x + radius * Math.cos(angle);
        const z = playerPos.z + radius * Math.sin(angle);

        // 🟡 Bounce height using sine wave
        const bounceY = Math.abs(Math.sin(time * 2 + i)) * 0.5 + 0.5;

        wrapper.position.set(x, bounceY, z);
        wrapper.lookAt(playerPos.x, 0, playerPos.z);

        cat.rotation.y += 0.05;
    });
}

	if (this.angels && this.angels.length > 0) {
    const playerPos = this.dolly.position.clone();

    this.angels.forEach(angel => {
        angel.lookAt(playerPos);
    });
}

// Blood dripping
if (this.startDrippingBlood && this.bloodTexture) {
    const now = performance.now();
    if (now - this.lastDripTime > 300) { // every 300ms
        const pos = this.dolly.position.clone();
        pos.x += (Math.random() - 0.5) * 0.2; // slight offset for realism
        pos.z += (Math.random() - 0.5) * 0.2;

        const blood = new BloodDrip(this.bloodTexture, pos, this.scene);
        this.bloodDrips.push(blood);
        this.lastDripTime = now;
    }
}

// Update existing drips
if (this.bloodDrips && this.bloodDrips.length > 0) {
    this.bloodDrips = this.bloodDrips.filter(drip => drip.update(dt));
}





        
        if (this.renderer.xr.isPresenting){
            let moveGaze = false;
        
            if ( this.useGaze && this.gazeController!==undefined){
                this.gazeController.update();
                moveGaze = (this.gazeController.mode == GazeController.Modes.MOVE);
            }
        
            if (this.selectPressed || moveGaze){
                this.moveDolly(dt);
                if (this.boardData){
                    const scene = this.scene;
                    const dollyPos = this.dolly.getWorldPosition( new THREE.Vector3() );
                    let boardFound = false;
                    Object.entries(this.boardData).forEach(([name, info]) => {
                        const obj = scene.getObjectByName( name );
                        if (obj !== undefined){
                            const pos = obj.getWorldPosition( new THREE.Vector3() );
                            if (dollyPos.distanceTo( pos ) < 3){
                                boardFound = true;
                                if ( this.boardShown !== name) this.showInfoboard( name, info, pos );
                            }
                        }
                    });
                    if (!boardFound){
                        this.boardShown = "";
                        this.ui.visible = false; 
                    }
                }
            }
        }
        
        if ( this.immersive != this.renderer.xr.isPresenting){
            this.resize();
            this.immersive = this.renderer.xr.isPresenting;
        }
        
        this.stats.update();
		this.renderer.render(this.scene, this.camera);



	}
}

export { App };

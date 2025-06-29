import * as THREE from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.159.0/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'https://unpkg.com/three@0.159.0/examples/jsm/loaders/FBXLoader.js';
import { DRACOLoader } from 'https://unpkg.com/three@0.159.0/examples/jsm/loaders/DRACOLoader.js';
import { VRButton } from 'https://unpkg.com/three@0.159.0/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.159.0/examples/jsm/webxr/XRControllerModelFactory.js';
import Stats from 'https://unpkg.com/three@0.159.0/examples/jsm/libs/stats.module.js';

import { CanvasUI } from './libs/CanvasUI.js';
import { GazeController } from './libs/GazeController.js';
import { LoadingBar } from './libs/LoadingBar.js';

class App {
    constructor() {
        const container = document.createElement('div');
        document.body.appendChild(container);

        this.assetsPath = './assets/';
        this.clock = new THREE.Clock();

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 500);
        this.camera.position.set(0, 1.6, 0);

        this.dolly = new THREE.Object3D();
        this.dolly.position.set(0, 0, 10);
        this.dolly.add(this.camera);

        this.dummyCam = new THREE.Object3D();
        this.camera.add(this.dummyCam);

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 2, 20);
        this.scene.add(this.dolly);

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
            },
            undefined,
            (err) => console.error('Audio error:', err)
        );

        const tintColor = new THREE.Color(0xccff99);
        const planeGeometry = new THREE.PlaneGeometry(2, 2);
        const planeMaterial = new THREE.MeshBasicMaterial({
            color: tintColor,
            transparent: true,
            opacity: 0.1,
            depthTest: false
        });
        this.tintOverlay = new THREE.Mesh(planeGeometry, planeMaterial);
        this.tintOverlay.material.side = THREE.DoubleSide;
        this.tintOverlay.position.z = -0.5;
        this.camera.add(this.tintOverlay);

        const ambient = new THREE.HemisphereLight(0xFFFFFF, 0xAAAAAA, 0.8);
        this.scene.add(ambient);

        this.darkLight = new THREE.HemisphereLight(0x222222, 0x000000, 0.5);
        this.darkLight.visible = false;
        this.scene.add(this.darkLight);

        this.originalEnvMap = null;
        this.originalBG = null;
        this.isDark = false;

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        container.appendChild(this.renderer.domElement);

        this.setEnvironment();
        window.addEventListener('resize', this.resize.bind(this));

        this.up = new THREE.Vector3(0, 1, 0);
        this.origin = new THREE.Vector3();
        this.workingVec3 = new THREE.Vector3();
        this.workingQuaternion = new THREE.Quaternion();
        this.raycaster = new THREE.Raycaster();

        this.stats = new Stats();
        container.appendChild(this.stats.dom);

        this.loadingBar = new LoadingBar();

        this.loadWeepingAngels();
        this.loadCollege();

        this.immersive = false;

        fetch('./college.json')
            .then(response => response.json())
            .then(obj => {
                this.boardShown = '';
                this.boardData = obj;
            });
    }

    setEnvironment() {
        const loader = new THREE.TextureLoader();
        loader.load('./assets/skybox.jpg', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.background = texture;
            this.scene.environment = null;
        }, undefined, (err) => {
            console.error('Skybox error:', err);
        });
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    loadWeepingAngels() {
        const loader = new FBXLoader().setPath(this.assetsPath);
        loader.load('weepingangel.fbx', (fbx) => {
            const numClones = 10;
            this.weepingAngels = [];

            for (let i = 0; i < numClones; i++) {
                const clone = fbx.clone();
                clone.scale.set(0.01, 0.01, 0.01);
                const angle = Math.random() * Math.PI * 2;
                const radius = 10 + Math.random() * 10;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                clone.position.set(this.dolly.position.x + x, 0, this.dolly.position.z + z);
                this.scene.add(clone);

                const mixer = new THREE.AnimationMixer(clone);
                if (fbx.animations?.length > 0) {
                    mixer.clipAction(fbx.animations[0]).play();
                }

                this.weepingAngels.push({ object: clone, mixer });
            }
        }, undefined, (error) => {
            console.error('FBX error:', error);
        });
    }

    loadCollege() {
        const loader = new GLTFLoader().setPath(this.assetsPath);
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('./libs/three/js/draco/');
        loader.setDRACOLoader(dracoLoader);

        loader.load('college.glb', (gltf) => {
            const college = gltf.scene.children[0];
            this.scene.add(college);

            college.traverse((child) => {
                if (child.isMesh) {
                    if (child.name.includes("PROXY")) {
                        child.material.visible = false;
                        this.proxy = child;
                    } else if (child.material.name.includes('Glass')) {
                        child.material.opacity = 0.1;
                        child.material.transparent = true;
                    } else if (child.material.name.includes("SkyBox")) {
                        const mat1 = child.material;
                        const mat2 = new THREE.MeshBasicMaterial({ map: mat1.map });
                        child.material = mat2;
                        mat1.dispose();
                    }
                }
            });

            loader.load('oiiaioooooiai_cat.glb', (catGLTF) => {
                this.cats = [];
                for (let i = 0; i < 4; i++) {
                    const cat = catGLTF.scene.clone();
                    cat.scale.set(2, 2, 2);
                    const angle = Math.random() * Math.PI * 2;
                    const radius = 3 + Math.random() * 2;
                    cat.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
                    cat.visible = false;
                    this.scene.add(cat);
                    this.cats.push(cat);
                }

                setInterval(() => {
                    this.cats.forEach(cat => cat.visible = Math.random() < 0.4);
                }, 4000);
            });

            const door1 = college.getObjectByName("LobbyShop_Door__1_");
            const door2 = college.getObjectByName("LobbyShop_Door__2_");
            const pos = door1.position.clone().sub(door2.position).multiplyScalar(0.5).add(door2.position);
            const obj = new THREE.Object3D();
            obj.name = "LobbyShop";
            obj.position.copy(pos);
            college.add(obj);

            this.loadingBar.visible = false;
            this.setupXR();

        }, (xhr) => {
            this.loadingBar.progress = xhr.loaded / xhr.total;
        }, (error) => {
            console.log('An error happened:', error);
        });
    }

    setupXR() {
        this.renderer.xr.enabled = true;

        this.renderer.xr.addEventListener('sessionstart', () => {
            if (this.sound?.buffer && !this.sound.isPlaying) this.sound.play();
        });

        new VRButton(this.renderer);

        const timeoutId = setTimeout(() => {
            this.useGaze = true;
            this.gazeController = new GazeController(this.scene, this.dummyCam);
        }, 2000);

        const onSelectStart = function () {
            this.userData.selectPressed = true;
        };

        const onSelectEnd = function () {
            this.userData.selectPressed = false;
        };

        const onConnected = function () {
            clearTimeout(timeoutId);
        };

        this.controllers = this.buildControllers(this.dolly);
        this.controllers.forEach(controller => {
            controller.addEventListener('selectstart', onSelectStart);
            controller.addEventListener('selectend', onSelectEnd);
            controller.addEventListener('connected', onConnected);
        });

        const config = {
            panelSize: { height: 0.5 },
            height: 256,
            name: { fontSize: 50, height: 70 },
            info: { position: { top: 70, backgroundColor: "#ccc", fontColor: "#000" } }
        };

        this.ui = new CanvasUI({ name: "name", info: "info" }, config);
        this.scene.add(this.ui.mesh);

        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    buildControllers(parent = this.scene) {
        const factory = new XRControllerModelFactory();
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        const line = new THREE.Line(geometry);
        line.scale.z = 0;

        return [0, 1].map(i => {
            const controller = this.renderer.xr.getController(i);
            controller.add(line.clone());
            controller.userData.selectPressed = false;
            parent.add(controller);

            const grip = this.renderer.xr.getControllerGrip(i);
            grip.add(factory.createControllerModel(grip));
            parent.add(grip);

            return controller;
        });
    }

    moveDolly(dt) {
        if (!this.proxy) return;

        const speed = 2;
        const wallLimit = 1.3;

        let pos = this.dolly.position.clone();
        pos.y += 1;

        const quaternion = this.dolly.quaternion.clone();
        this.dolly.quaternion.copy(this.dummyCam.getWorldQuaternion(this.workingQuaternion));

        let dir = new THREE.Vector3();
        this.dolly.getWorldDirection(dir).negate();
        this.raycaster.set(pos, dir);

        let intersect = this.raycaster.intersectObject(this.proxy);
        if (!(intersect.length > 0 && intersect[0].distance < wallLimit)) {
            this.dolly.translateZ(-dt * speed);
            pos = this.dolly.getWorldPosition(this.origin);
        }

        dir.set(-1, 0, 0).applyMatrix4(this.dolly.matrix).normalize();
        this.raycaster.set(pos, dir);
        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length > 0 && intersect[0].distance < wallLimit)
            this.dolly.translateX(wallLimit - intersect[0].distance);

        dir.set(1, 0, 0).applyMatrix4(this.dolly.matrix).normalize();
        this.raycaster.set(pos, dir);
        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length > 0 && intersect[0].distance < wallLimit)
            this.dolly.translateX(intersect[0].distance - wallLimit);

        dir.set(0, -1, 0);
        pos.y += 1.5;
        this.raycaster.set(pos, dir);
        intersect = this.raycaster.intersectObject(this.proxy);
        if (intersect.length > 0) this.dolly.position.copy(intersect[0].point);

        this.dolly.quaternion.copy(quaternion);
    }

    get selectPressed() {
        return this.controllers?.some(c => c.userData.selectPressed);
    }

    showInfoboard(name, info, pos) {
        if (!this.ui) return;
        this.ui.position.copy(pos).add(this.workingVec3.set(0, 1.3, 0));
        const camPos = this.dummyCam.getWorldPosition(this.workingVec3);
        this.ui.updateElement('name', info.name);
        this.ui.updateElement('info', info.info);
        this.ui.update();
        this.ui.lookAt(camPos);
        this.ui.visible = true;
        this.boardShown = name;
    }

    render(timestamp, frame) {
        const dt = this.clock.getDelta();

        if (this.weepingAngels) {
            this.weepingAngels.forEach(({ object, mixer }) => {
                mixer.update(dt);
                object.lookAt(this.dolly.position.x, object.position.y, this.dolly.position.z);
            });
        }

        if (this.cat) {
            const playerPos = this.dolly.position.clone();
            const followOffset = new THREE.Vector3(0, 0, 1.5).applyQuaternion(this.dummyCam.quaternion);
            const targetPos = playerPos.clone().add(followOffset);
            targetPos.y = 0;
            this.cat.position.lerp(targetPos, 0.05);
            this.cat.lookAt(playerPos.x, this.cat.position.y, playerPos.z);
        }

        if (this.renderer.xr.isPresenting) {
            let moveGaze = this.useGaze && this.gazeController?.update() && this.gazeController.mode === GazeController.Modes.MOVE;

            if (this.selectPressed || moveGaze) {
                this.moveDolly(dt);

                if (this.boardData) {
                    const dollyPos = this.dolly.getWorldPosition(new THREE.Vector3());
                    let boardFound = false;

                    for (const [name, info] of Object.entries(this.boardData)) {
                        const obj = this.scene.getObjectByName(name);
                        if (obj && dollyPos.distanceTo(obj.getWorldPosition(new THREE.Vector3())) < 3) {
                            if (this.boardShown !== name) this.showInfoboard(name, info, obj.position);
                            boardFound = true;
                        }
                    }

                    if (!boardFound) {
                        this.boardShown = '';
                        this.ui.visible = false;
                    }
                }
            }
        }

        if (this.immersive !== this.renderer.xr.isPresenting) {
            this.resize();
            this.immersive = this.renderer.xr.isPresenting;
        }

        this.stats.update();
        this.renderer.render(this.scene, this.camera);
    }
}

export { App };

import * as THREE from 'three';
import { AmbientLight, MeshPhongMaterial } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RigidBody, World } from '@dimforge/rapier3d';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { CharacterControls } from './characters/characterControls';

// DEBUG
import Stats from 'three/examples/jsm/libs/stats.module';
import { GUI } from 'dat.gui';

let DEBUG = true;
const gui = new GUI()
const stats = Stats();
document.body.appendChild(stats.dom)

// SCENE
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8def0);

// CAMERA
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.y = 20;
camera.position.z = 60;
camera.position.x = 0;

if (DEBUG) {
    
    const cameraFolder = gui.addFolder('Camera')
    cameraFolder.add(camera.position, 'x', -100, 100)
    cameraFolder.add(camera.position, 'y', -100, 100)
    cameraFolder.add(camera.position, 'z', -100, 100)
    // cameraFolder.open()
}


// RENDERER
const renderer = new THREE.WebGL1Renderer(
    {
        antialias: true
    }
)
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

// ORBIT CAMERA CONTROLS
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true
orbitControls.enablePan = true
orbitControls.minDistance = 5
orbitControls.maxDistance = 200
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05 // prevent camera below ground
orbitControls.minPolarAngle = Math.PI / 4        // prevent top down view
// orbitControls.update();

const dLight = new THREE.DirectionalLight('white', 0.6);
dLight.position.x = 20;
dLight.position.y = 30;
dLight.castShadow = true;
dLight.shadow.mapSize.width = 4096;
dLight.shadow.mapSize.height = 4096;
const d = 35;
dLight.shadow.camera.left = - d;
dLight.shadow.camera.right = d;
dLight.shadow.camera.top = d;
dLight.shadow.camera.bottom = - d;
scene.add(dLight);

const aLight = new THREE.AmbientLight('white', 0.4);
scene.add(aLight);

// RESIZE HANDLER
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);
document.body.appendChild(renderer.domElement);

function loadTexture(path: string): THREE.Texture {
    const texture = new THREE.TextureLoader().load(path);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.x = 10;
    texture.repeat.y = 10;
    return texture
}

// Character Controller Definition
var characterControls: CharacterControls

const text = 'hai';
var test = new CharacterControls(text)
console.log(test);

import('@dimforge/rapier3d').then(RAPIER => {

    function body(scene: THREE.Scene, world: World,
        bodyType: 'dynamic' | 'static' | 'kinematicPositionBased',
        colliderType: 'cube' | 'sphere' | 'cylinder' | 'cone', dimension: any,
        translation: { x: number, y: number, z: number },
        rotation: { x: number, y: number, z: number },
        color: string): { rigid: RigidBody, mesh: THREE.Mesh } {

        let bodyDesc

        if (bodyType === 'dynamic') {
            bodyDesc = RAPIER.RigidBodyDesc.dynamic();
        } else if (bodyType === 'kinematicPositionBased') {
            bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
        } else if (bodyType === 'static') {
            bodyDesc = RAPIER.RigidBodyDesc.fixed();
            bodyDesc.setCanSleep(false);
        }

        if (translation) {
            bodyDesc.setTranslation(translation.x, translation.y, translation.z)
        }
        if(rotation) {
            const q = new THREE.Quaternion().setFromEuler(
                new THREE.Euler( rotation.x, rotation.y, rotation.z, 'XYZ' )
            )
            bodyDesc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        }

        let rigidBody = world.createRigidBody(bodyDesc);

        let collider;
        if (colliderType === 'cube') {
            collider = RAPIER.ColliderDesc.cuboid(dimension.hx, dimension.hy, dimension.hz);
        } else if (colliderType === 'sphere') {
            collider = RAPIER.ColliderDesc.ball(dimension.radius);
        } else if (colliderType === 'cylinder') {
            collider = RAPIER.ColliderDesc.cylinder(dimension.hh, dimension.radius);
        } else if (colliderType === 'cone') {
            collider = RAPIER.ColliderDesc.cone(dimension.hh, dimension.radius);
            // cone center of mass is at bottom
            collider.centerOfMass = {x:0, y:0, z:0}
        }
        world.createCollider(collider, rigidBody);

        let bufferGeometry;
        if (colliderType === 'cube') {
            bufferGeometry = new THREE.BoxGeometry(dimension.hx * 2, dimension.hy * 2, dimension.hz * 2);
        } else if (colliderType === 'sphere') {
            bufferGeometry = new THREE.SphereGeometry(dimension.radius, 32, 32);
        } else if (colliderType === 'cylinder') {
            bufferGeometry = new THREE.CylinderGeometry(dimension.radius, 
                dimension.radius, dimension.hh * 2,  32, 32);
        } else if (colliderType === 'cone') {
            bufferGeometry = new THREE.ConeGeometry(dimension.radius, dimension.hh * 2,  
                32, 32);
        }

        const threeMesh = new THREE.Mesh(bufferGeometry, new MeshPhongMaterial({ color: color }));
        threeMesh.castShadow = true;
        threeMesh.receiveShadow = true;
        scene.add(threeMesh);

        return { rigid: rigidBody, mesh: threeMesh };
    }

    function generateTerrain(nsubdivs: number, scale: { x: number, y: number, z: number }) {
        let heights: number[] = []
    
        // three plane
        const threeFloor = new THREE.Mesh(
            new THREE.PlaneGeometry(scale.x, scale.z, nsubdivs, nsubdivs),
            new THREE.MeshStandardMaterial({
                 map: loadTexture('/textures/grass/Grass_005_BaseColor.jpg'),
                 normalMap: loadTexture('/textures/grass/Grass_005_Normal.jpg'),
                 aoMap: loadTexture('/textures/grass/Grass_005_AmbientOcclusion.jpg'),
                 roughnessMap: loadTexture('/textures/grass/Grass_005_Roughness.jpg'),
                 roughness: 0.6
            }));
        threeFloor.rotateX(- Math.PI / 2);
        threeFloor.receiveShadow = true;
        threeFloor.castShadow = true;
        scene.add(threeFloor);
    
        // add height data to plane
        const vertices = threeFloor.geometry.attributes.position.array;
        const dx = scale.x / nsubdivs;
        const dy = scale.z / nsubdivs;
        // store height data in map column-row map
        const columsRows = new Map();
        for (let i = 0; i < vertices.length; i += 3) {
            // translate into colum / row indices
            let row = Math.floor(Math.abs((vertices as any)[i] + (scale.x / 2)) / dx);
            let column = Math.floor(Math.abs((vertices as any)[i + 1] - (scale.z / 2)) / dy);
            // generate height for this column & row
            const randomHeight = Math.random();
            (vertices as any)[i + 2] = scale.y * randomHeight;
            // store height
            if (!columsRows.get(column)) {
                columsRows.set(column, new Map());
            }
            columsRows.get(column).set(row, randomHeight);
        }
        threeFloor.geometry.computeVertexNormals();

        // store height data into column-major-order matrix array
        for (let i = 0; i <= nsubdivs; ++i) {
            for (let j = 0; j <= nsubdivs; ++j) {
                heights.push(columsRows.get(j).get(i));
            }
        }
    
        let groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
        let groundBody = world.createRigidBody(groundBodyDesc);
        let groundCollider = RAPIER.ColliderDesc.heightfield(
            nsubdivs, nsubdivs, new Float32Array(heights), scale
        );
        world.createCollider(groundCollider, groundBody);
    }

    // Use the RAPIER module here.
    let gravity = { x: 0.0, y: -9.81, z: 0.0 };
    let world = new RAPIER.World(gravity);

    // Bodys
    const bodys: { rigid: RigidBody, mesh: THREE.Mesh }[] = []

    // Create Ground.
    let nsubdivs = 20;
    let scale = new RAPIER.Vector3(70.0, 3.0, 70.0);
    generateTerrain(nsubdivs, scale);

    const cylinderBody = body(scene, world, 'dynamic', 'cylinder',
        { hh: 1.0, radius: 1.2 }, { x: -7, y: 30, z: 8 },
        { x: 0, y: 1, z: 0 }, 'green');
    bodys.push(cylinderBody);

    const sphereBody = body(scene, world, 'dynamic', 'sphere',
        { radius: 0.7 }, { x: 4, y: 30, z: 2 },
        { x: 0, y: 1, z: 0 }, 'blue');
    bodys.push(sphereBody);

    // Character Model
    new GLTFLoader().load('models/Soldier.glb', function (gltf) {
        console.log('gltf', gltf);
        const model = gltf.scene;
        console.log('model',model);
        model.traverse(function (object: any) {
            if (object.isMesh) object.castShadow = true;
        })

        scene.add(model)

        // Prepare Animation Map
        const gltfAnimations: THREE.AnimationClip[] = gltf.animations;
        const mixer = new THREE.AnimationMixer(model);
        const animationMap: Map<string, THREE.AnimationAction> = new Map()
        gltfAnimations.filter(a => a.name != 'TPose').forEach((a: THREE.AnimationClip) => {
            animationMap.set(a.name, mixer.clipAction(a))
        })

        console.log(animationMap);

        // Character bind physics to controls



        if (DEBUG) {
    
            const characterFolder = gui.addFolder('Character')
            characterFolder.add(model.position, 'x', 0, 100)
            characterFolder.add(model.position, 'y', 0, 100)
            characterFolder.add(model.position, 'z', 0, 100)
            // characterFolder.open()
        }
    });

    /**
     * Animate
     */
    const clock = new THREE.Clock()
    let lastElapsedTime = 0

    const tick = () =>
    {
        const elapsedTime = clock.getElapsedTime()
        const deltaTime = elapsedTime - lastElapsedTime
        lastElapsedTime = elapsedTime

        world.step();
        bodys.forEach(body => {
            let position = body.rigid.translation();
            let rotation = body.rigid.rotation();

            body.mesh.position.x = position.x
            body.mesh.position.y = position.y
            body.mesh.position.z = position.z

            body.mesh.setRotationFromQuaternion(
                new THREE.Quaternion(rotation.x,
                    rotation.y,
                    rotation.z,
                    rotation.w));
        });

        // Update controls
        orbitControls.update()

        // Stats
        stats.update()

        // Render
        renderer.render(scene, camera)

        // Call tick again on the next frame
        window.requestAnimationFrame(tick)
    }

    tick();
})


// Prepare keyboard bindings listener
const keysPressed: any = {}
document.addEventListener('keydown', (event) => {
    console.log(event.key);
}, false)

document.addEventListener('keyup', (event) => {
    console.log(event.key);
}, false)

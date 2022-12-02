import * as THREE from 'three';
import { AmbientLight, MeshPhongMaterial } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { RigidBody, World } from '@dimforge/rapier3d';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { CharacterControls, CONTROLLER_BODY_RADIUS } from './characters/characterControls';

import { gsap } from 'gsap';

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
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
// camera.position.set(0, 6, 7);
camera.position.set(0, 24, 7);

console.log(camera);

if (DEBUG) {
    
    const cameraFolder = gui.addFolder('Camera')
    cameraFolder.add(camera.position, 'x', -100, 100)
    cameraFolder.add(camera.position, 'y', -100, 100)
    cameraFolder.add(camera.position, 'z', -100, 100)
    cameraFolder.add(camera, 'fov', 0, 100)
    cameraFolder.add(camera, 'far', 999, 2000)
    // cameraFolder.add(camera, 'fov', 0, 100)
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
orbitControls.enablePan = false
orbitControls.minDistance = 5
orbitControls.maxDistance = 20
orbitControls.maxPolarAngle = Math.PI / 2 - 0.05 // prevent camera below ground
orbitControls.minPolarAngle = Math.PI / 4        // prevent top down view
// orbitControls.update();
console.log(orbitControls);

if (DEBUG) {
    
    const orbitControlsFolder = gui.addFolder('Orbit Control')
    orbitControlsFolder.add(camera.position, 'x', -100, 100)
    orbitControlsFolder.add(camera.position, 'y', -100, 100)
    orbitControlsFolder.add(camera.position, 'z', -100, 100)
    // cameraFolder.open()
}

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

/**
 * Overlay Shaders
 */
const overlayGeometry = new THREE.PlaneGeometry(2, 2, 1, 1)
const overlayMaterial = new THREE.ShaderMaterial({
    // wireframe: true,
    transparent: true,
    uniforms:
    {
        uAlpha: { value: 1 }
    },
    vertexShader: `
        void main()
        {
            gl_Position = vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uAlpha;
        void main()
        {
            gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha);
        }
    `
})
const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial)
scene.add(overlay);

if (DEBUG) {
    const overlayShaderFolder = gui.addFolder('Overlay Shader Plane')
    overlayShaderFolder.add(overlay.position, 'x', 0, 100)
    overlayShaderFolder.add(overlay.position, 'y', 0, 100)
    overlayShaderFolder.add(overlay.position, 'z', 0, 100)
    // cameraFolder.open()
}

/**
 * Loading Manager
 */
 const loadingBarElement = document.querySelector<HTMLElement>('.loading-bar');
const loadingManager = new THREE.LoadingManager(
    // loaded
    () => {
        // Wrap loading transition for smooth UX
        window.setTimeout(() => {
            // fade out shader
            gsap.to(overlayMaterial.uniforms.uAlpha, { 
                duration: 3, value: 0 
            })

            // Animate camera
            gsap.to(camera.position, {
                y: 6, z:4, duration: 4, ease: 'power3.inOut',
            })

            // hide progress bar
            loadingBarElement.classList.add('ended');
            loadingBarElement.style.transform = '';

        }, 500)

    },
    // Progress
    (itemUrl, itemsLoaded, itemsTotal) => {
        camera.position.set(0, 24, 6);
        const progressRatio = itemsLoaded / itemsTotal
        loadingBarElement.style.transform = `scaleX(${progressRatio})`
    }
)


// Character Controller Definition
var characterControls: CharacterControls

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
        rigidBody.setDominanceGroup(10);

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

    const cubeBody = body(scene, world, 'dynamic', 'cube',
        { hx: 0.5, hy: 0.5, hz: 0.5 }, { x: 0, y: 15, z: 0 },
        { x: 0, y: 0.4, z: 0.7 }, 'orange');
    bodys.push(cubeBody);

    const sphereBody = body(scene, world, 'dynamic', 'sphere',
        { radius: 0.7 }, { x: 4, y: 15, z: 2 },
        { x: 0, y: 1, z: 0 }, 'blue');
    bodys.push(sphereBody);

    const sphereBody2 = body(scene, world, 'dynamic', 'sphere',
        { radius: 0.7 }, { x: 0, y: 15, z: 0 },
        { x: 0, y: 1, z: 0 }, 'red');
    bodys.push(sphereBody2);

    const cylinderBody = body(scene, world, 'dynamic', 'cylinder',
        { hh: 1.0, radius: 0.7 }, { x: -7, y: 15, z: 8 },
        { x: 0, y: 1, z: 0 }, 'green');
    bodys.push(cylinderBody);

    const coneBody = body(scene, world, 'dynamic', 'cone',
        { hh: 1.0, radius: 1 }, { x: 7, y: 15, z: -8 },
        { x: 0, y: 1, z: 0 }, 'purple');
    bodys.push(coneBody);

    // Character Model
    new GLTFLoader(loadingManager).load('models/Soldier.glb', function (gltf) {
        console.log('gltf', gltf);
        const model = gltf.scene;
        console.log('model',model);
        model.traverse(function (object: any) {
            if (object.isMesh) {
                object.castShadow = true;
            } 
        })
        scene.add(model)

        // Prepare Animation Map
        const gltfAnimations: THREE.AnimationClip[] = gltf.animations;
        const mixer = new THREE.AnimationMixer(model);
        const animationsMap: Map<string, THREE.AnimationAction> = new Map()
        gltfAnimations.filter(a => a.name != 'TPose').forEach((a: THREE.AnimationClip) => {
            animationsMap.set(a.name, mixer.clipAction(a))
        })

        // Prepare rigid body for character physics wrap
        let bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(model.position.x, model.position.y + 3, model.position.z + 0.5).setCanSleep(false);
        let rigidBody = world.createRigidBody(bodyDesc);
        let dynamicCollider = RAPIER.ColliderDesc.capsule(0.15, 0.21);
        world.createCollider(dynamicCollider, rigidBody);

        // Character bind character to controls
        let rayOrigin = {
            x: 0,
            y: 0,
            z: 0
        }
        let rayDir = {
            x: 0,
            y: -1,
            z: 0
        }
        characterControls = new CharacterControls('Aiman', model, mixer, animationsMap, 'Idle', orbitControls, camera, 
            new RAPIER.Ray(rayOrigin, rayDir), rigidBody
        )

        console.log(characterControls);

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

        // Update Player
        // let mixerUpdateDelta = clock.getDelta();
        if (characterControls) {
            characterControls.update(world, deltaTime, keysPressed);
        }

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

let isMobile = false;

if (
  /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(
    navigator.userAgent,
  )
  || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
    navigator.userAgent.substr(0, 4),
  )
) {
    isMobile = true;
}

// Prepare keyboard bindings listener
const keysPressed: any = {}
document.addEventListener('keydown', (event) => {
    (keysPressed as any)[event.key.toLowerCase()] = true;
    keysPressed['listen'] = 'down';
}, false)

document.addEventListener('keyup', (event) => {
    (keysPressed as any)[event.key.toLowerCase()] = false
    keysPressed['listen'] = 'up';
}, false)


// document.addEventListener('mousedown', (event) => {
//     console.log(event);
// }, false)

// document.addEventListener('pointerdown', (event) => {
//     console.log(event.pageX, event.pageY);
// }, false)

// document.addEventListener('pointermove', (event) => {
//     console.log(event.pageX, event.pageY);
// }, false)

// document.addEventListener('dragstart', (event) => {
//     console.log(event);
// }, false)


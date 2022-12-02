import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Ray, RigidBody, World } from '@dimforge/rapier3d';
import { gsap } from 'gsap';

export const CONTROLLER_BODY_RADIUS = 0.28;

export class CharacterControls {

    name: string;
    model: THREE.Group;
    mixer: THREE.AnimationMixer;
    animationsMap: Map<string, THREE.AnimationAction> = new Map();
    currentAction: string;

    camera: THREE.Camera;
    cameraTarget = new THREE.Vector3();
    orbitControl: OrbitControls;
    storedFall = 0;

    // Player temporary following camera
    followCamera: THREE.Object3D;
    walkDirection = new THREE.Vector3();
    rotateAngle = new THREE.Vector3(0, 1, 0);
    rotateQuarternion: THREE.Quaternion = new THREE.Quaternion();
    temp: THREE.Vector3;

    // constants
    fadeDuration: number = 0.2;
    walkVelocity = 5;

    // Physics
    ray: Ray;
    rigidBody: RigidBody;
    lerp = ( x: number, y: number, a: number ) => x * ( 1 - a ) + y * a;

    constructor(name: string, model: THREE.Group, 
        mixer: THREE.AnimationMixer, animationsMap: Map<string, THREE.AnimationAction>, currentAction: string,
        orbitControl: OrbitControls, camera: THREE.Camera,
        ray: Ray, rigidBody: RigidBody
        ) {
        this.name = name;
        this.model = model;
        this.mixer = mixer;
        this.animationsMap = animationsMap;
        this.currentAction = currentAction;
        this.animationsMap.forEach((v, k) => {
            if (k === currentAction) {
                v.play();
            }
        })

        // Camera
        this.orbitControl = orbitControl;
        this.camera = camera;
        this.updateCameraTarget(new THREE.Vector3(0, 1, 5) , 0, 0, 0);

        // Player temporary following camera
        this.followCamera = new THREE.Object3D();
        this.followCamera.position.copy(this.camera.position)
        this.model.add(this.followCamera);
        this.temp = new THREE.Vector3();

        // Physics
        this.ray = ray
        this.rigidBody = rigidBody
    }

    public update(world: World, delta: number, keyboardPressed: any) {
        const W = 'w'
        const A = 'a'
        const S = 's'
        const D = 'd'
        const SHIFT = 'shift'
        const DIRECTIONS = [W, A, S, D]

        const directionPressed = DIRECTIONS.some(key => keyboardPressed[key] === true)

        // handle key pressed & pass to 'play' variable
        var play = '';
        if (directionPressed) {
            play = 'Walk'
        } else {
            play = 'Idle'
        }

        // handle changes of animation action if not equal to var play
        if (this.currentAction != play) {
            const toPlay = this.animationsMap.get(play)
            const current = this.animationsMap.get(this.currentAction)

            current.fadeOut(this.fadeDuration)
            toPlay.reset().fadeIn(this.fadeDuration).play();

            this.currentAction = play

            // const pos = this.model.position.clone();
            // pos.z -= 0.01;
            // this.camera.lookAt(pos)
        }

        // Character current action pose
        this.mixer.update(delta);

        this.walkDirection.x = this.walkDirection.y = this.walkDirection.z = 0
        let velocity = 0;
        if (this.currentAction === 'Walk') {
            // calculate towards camera direction
            var angleYCameraDirection = Math.atan2(
                (this.camera.position.x - this.model.position.x), 
                (this.camera.position.z - this.model.position.z))
            // diagonal movement angle offset
            var directionOffset = this.directionOffset(keyboardPressed)

            // rotate model
            this.rotateQuarternion.setFromAxisAngle(this.rotateAngle, angleYCameraDirection + directionOffset)
            this.model.quaternion.rotateTowards(this.rotateQuarternion, 0.2)

            // calculate direction
            this.camera.getWorldDirection(this.walkDirection)
            this.walkDirection.y = 0
            this.walkDirection.normalize()
            this.walkDirection.applyAxisAngle(this.rotateAngle, directionOffset)

            // run/walk velocity
            velocity = this.currentAction == 'Walk' ? this.walkVelocity : this.walkVelocity
        }

        const translation = this.rigidBody.translation();
        // console.log(translation);
        if (translation.y < -40) {
            // don't fall below ground
            this.rigidBody.setNextKinematicTranslation( { 
                x: 0, 
                y: 10, 
                z: 0 
            });
            
        } else {
            const cameraPositionOffset = this.camera.position.sub(this.model.position)
            // console.log(cameraPositionOffset);
            // update model and camera
            this.model.position.x = translation.x
            this.model.position.y = translation.y
            this.model.position.z = translation.z
            this.updateCameraTarget(cameraPositionOffset, translation.x, translation.y, translation.z)

            this.walkDirection.y += this.lerp(this.storedFall, -9.81 * delta, 0.10)
            this.storedFall = this.walkDirection.y
            this.ray.origin.x = translation.x
            this.ray.origin.y = translation.y
            this.ray.origin.z = translation.z
            let hit = world.castRay(this.ray, 0.5, false, 0xfffffffff);
            if (hit) {
                const point = this.ray.pointAt(hit.toi);
                let diff = translation.y - ( point.y + 0.28);
                if (diff < 0.0) {
                    this.storedFall = 0
                    this.walkDirection.y = this.lerp(0, Math.abs(diff), 0.5)
                }
            }
    
            this.walkDirection.x = this.walkDirection.x * velocity * delta
            this.walkDirection.z = this.walkDirection.z * velocity * delta

            this.rigidBody.setNextKinematicTranslation( { 
                x: translation.x + this.walkDirection.x, 
                y: translation.y + this.walkDirection.y, 
                z: translation.z + this.walkDirection.z 
            });
        }
    }

    private updateCameraTarget(offset: THREE.Vector3, x: number, y: number, z: number ) {
        // move camera
        // console.log(this.rigidBody);
        // const rigidTranslation = this.rigidBody.translation();
        this.camera.position.x = x + offset.x
        this.camera.position.y = y + offset.y
        this.camera.position.z = z + offset.z

        // update camera target
        this.cameraTarget.x = x
        this.cameraTarget.y = y + 1
        this.cameraTarget.z = z
        this.orbitControl.target = this.cameraTarget
    }

    // on development to get smooth user experience while doing rotation
    private updateLerpCameraPosition() {
        // this.temp.setFromMatrixPosition(this.followCamera.matrixWorld)

        // this.camera.position.lerp(this.followCamera.getWorldPosition(new THREE.Vector3()), 0.03);
        // // this.camera.position.lerp(this.temp, 0.02);

        const pos = this.model.position.clone();
        pos.z += 0.01;
        this.camera.lookAt(pos)
    }

    private directionOffset(keysPressed: any) {
        const W = 'w'
        const A = 'a'
        const S = 's'
        const D = 'd'
        var directionOffset = 0 // w

        if (keysPressed[W]) {
            if (keysPressed[A]) {
                directionOffset = Math.PI / 4 // w+a
            } else if (keysPressed[D]) {
                directionOffset = - Math.PI / 4 // w+d
            }
        } else if (keysPressed[S]) {
            if (keysPressed[A]) {
                directionOffset = Math.PI / 4 + Math.PI / 2 // s+a
            } else if (keysPressed[D]) {
                directionOffset = -Math.PI / 4 - Math.PI / 2 // s+d
            } else {
                directionOffset = Math.PI // s
            }
        } else if (keysPressed[A]) {
            directionOffset = Math.PI / 2 // a
        } else if (keysPressed[D]) {
            directionOffset = - Math.PI / 2 // d
        }

        return directionOffset
    }
}
import * as THREE from 'three';
import { Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export class CharacterControls {

    test: string;
    model: THREE.Group;
    mixer: THREE.AnimationMixer;
    animationsMap: Map<string, THREE.AnimationAction> = new Map();
    currentAction: string;

    camera: THREE.Camera;
    cameraTarget = new THREE.Vector3();
    orbitControl: OrbitControls;

    // Player temporary following camera
    followCamera: THREE.Object3D;
    walkDirection = new THREE.Vector3();
    rotateAngle = new THREE.Vector3(0, 1, 0);
    rotateQuarternion: THREE.Quaternion = new THREE.Quaternion();
    temp: THREE.Vector3;

    // constants
    fadeDuration: number = 0.2;
    walkVelocity = 5;

    constructor(test: string, model: THREE.Group, 
        mixer: THREE.AnimationMixer, animationsMap: Map<string, THREE.AnimationAction>, currentAction: string,
        orbitControl: OrbitControls, camera: THREE.Camera
        ) {
        this.test = test;
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
        this.updateCameraTarget(0, 0);

        // Player temporary following camera
        this.followCamera = new THREE.Object3D();
        this.followCamera.position.copy(this.camera.position)
        this.model.add(this.followCamera);

        this.temp = new THREE.Vector3();
    }

    public update(delta: number, keyboardPressed: any) {
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
        }

        // Character current action pose
        this.mixer.update(delta);

        
        if (this.currentAction === 'Walk') {
            // calculate towards camera direction
            var angleYCameraDirection = Math.atan2(
                (this.camera.position.x - this.model.position.x), 
                (this.camera.position.z - this.model.position.z));

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
            const velocity = this.currentAction == 'Walk' ? this.walkVelocity : this.walkVelocity;

            // move model & camera
            this.model.translateZ(0.01);
            const moveX = this.walkDirection.x * velocity * delta
            const moveZ = this.walkDirection.z * velocity * delta

            this.model.position.x += moveX
            this.model.position.z += moveZ

            this.updateCameraTarget(moveX, moveZ)
            this.updateLerpCameraPosition()
        }
    }

    private updateCameraTarget(moveX: number, moveZ: number) {
        // move camera
        this.camera.position.x += moveX
        this.camera.position.z += moveZ

        // update camera target
        this.cameraTarget.x = this.model.position.x
        this.cameraTarget.y = this.model.position.y + 1
        this.cameraTarget.z = this.model.position.z

        this.orbitControl.target = this.cameraTarget
    }

    // on development to get smooth user experience while doing rotation
    private updateLerpCameraPosition() {
        this.temp.setFromMatrixPosition(this.followCamera.matrixWorld)

        // this.camera.position.lerp(this.followCamera.getWorldPosition(new THREE.Vector3()), 0.05);
        this.camera.position.lerp(this.temp, 0.02);

        const pos = this.model.position.clone();
        pos.y += 0.02;
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
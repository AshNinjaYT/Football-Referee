import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from '../core/Physics';

export class Ball {
    public mesh: THREE.Mesh;
    public body: RAPIER.RigidBody;
    public lastPossessor: any = null;

    constructor(scene: THREE.Scene, x: number, y: number, z: number) {
        // Visual
        const geometry = new THREE.SphereGeometry(22, 32, 32); 
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 0.1,
            metalness: 0.0
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);

        const physics = Physics.getInstance();
        this.body = physics.createBallBody(22, x, y, z);
    }

    public update() {
        const position = this.body.translation();
        this.mesh.position.set(position.x, position.y, position.z);
        
        const rotation = this.body.rotation();
        this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
    
    public reset(x: number, y: number, z: number) {
        this.body.setTranslation({ x, y, z }, true);
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    public applyImpulse(impulse: { x: number, y: number, z: number }) {
        this.body.applyImpulse(impulse, true);
    }
}


import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics } from '../core/Physics';
import { InputManager } from '../core/InputManager';

export class Referee {
    public mesh: THREE.Group;
    public body: RAPIER.RigidBody;
    public cameraHolder: THREE.Group;
    
    private pitch: number = 0; // Rotación vertical (Mirar arriba/abajo)
    private yaw: number = 0;   // Rotación horizontal (Girar cuerpo)

    constructor(scene: THREE.Scene, camera: THREE.Camera) {
        this.mesh = new THREE.Group();
        this.cameraHolder = new THREE.Group();
        this.cameraHolder.position.y = 85; // Altura de los ojos (Eye level)
        this.mesh.add(this.cameraHolder);
        
        // Emparentar cámara al holder para FPS
        this.cameraHolder.add(camera);
        camera.position.set(0, 0, 0);

        // Modelo de Brazos y Cuerpo para Inmersión
        const armGeo = new THREE.CapsuleGeometry(6, 40, 4, 8);
        const clothMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }); // Camiseta Árbitro
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xe5c185, roughness: 0.6 });

        // Brazo Izquierdo (Sosteniendo Silbato/Reloj invisiblemente cerca)
        const armL = new THREE.Mesh(armGeo, clothMat);
        armL.position.set(-25, 60, -20);
        armL.rotation.x = -Math.PI / 3;
        this.mesh.add(armL);
        
        // Añadir manos para visibilidad (Skin)
        const handGeo = new THREE.SphereGeometry(8, 8, 8);
        const handL = new THREE.Mesh(handGeo, skinMat);
        handL.position.set(0, -20, 0); 
        armL.add(handL);

        // Brazo Derecho
        const armR = new THREE.Mesh(armGeo, clothMat);
        armR.position.set(25, 60, -20);
        armR.rotation.x = -Math.PI / 3;
        this.mesh.add(armR);

        const handR = new THREE.Mesh(handGeo, skinMat);
        handR.position.set(0, -20, 0);
        armR.add(handR);

        // Torso para verse al mirar abajo
        const torsoGeo = new THREE.CapsuleGeometry(22, 60, 4, 8);
        const torso = new THREE.Mesh(torsoGeo, clothMat);
        torso.position.y = 40;
        this.mesh.add(torso);

        scene.add(this.mesh);

        // Física
        const physics = Physics.getInstance();
        this.body = physics.createPlayerBody(0, 100, 0);
    }

    public update(input: InputManager) {
        // 1. Control de Rotación (Ratón)
        this.yaw -= input.mouseDelta.x * 0.002;
        this.pitch -= input.mouseDelta.y * 0.002;
        this.pitch = Math.max(-Math.PI/2.5, Math.min(Math.PI/2.5, this.pitch));

        this.mesh.rotation.y = this.yaw;
        this.cameraHolder.rotation.x = this.pitch;

        // 2. Control de Movimiento (WASD)
        const moveSpeed = 600; 
        let vx = 0, vz = 0;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.quaternion);

        if (input.keys['KeyW']) { vx += forward.x * moveSpeed; vz += forward.z * moveSpeed; }
        if (input.keys['KeyS']) { vx -= forward.x * moveSpeed; vz -= forward.z * moveSpeed; }
        if (input.keys['KeyA']) { vx -= right.x * moveSpeed; vz -= right.z * moveSpeed; }
        if (input.keys['KeyD']) { vx += right.x * moveSpeed; vz += right.z * moveSpeed; }

        this.body.setLinvel({ x: vx, y: this.body.linvel().y, z: vz }, true);

        // 3. Sincronizar Malla con Física
        const pos = this.body.translation();
        this.mesh.position.set(pos.x, pos.y, pos.z);
    }
}

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics, FIELD_H } from '../core/Physics';

export enum PlayerRole {
    GOALKEEPER,
    DEFENDER,
    MIDFIELDER,
    FORWARD
}

export enum PlayerState {
    IDLE,
    CHASE,
    DRIBBLE,
    SHOOT,
    CELEBRATE,
    RETURN_TO_POS
}

/** Posición táctica base del jugador (su "casa") */
interface TacticalPos {
    x: number;
    z: number;
}

export class Player {
    public mesh: THREE.Group;
    public body: RAPIER.RigidBody;
    
    public team: number;       // 0 = local (ataca +Z), 1 = visitante (ataca -Z)
    public role: PlayerRole;
    public state: PlayerState = PlayerState.RETURN_TO_POS;
    public hasBall: boolean = false;

    private homePos: TacticalPos;   // Posición táctica base
    private teamColor: THREE.Color;
    
    // Referencias a partes del cuerpo para animación
    private legL!: THREE.Mesh;
    private legR!: THREE.Mesh;
    private armL!: THREE.Mesh;
    private armR!: THREE.Mesh;
    private animPhase: number = 0; // Acumulador para fluidez total

    // Velocidades según rol
    private readonly speeds: Record<PlayerRole, number> = {
        [PlayerRole.GOALKEEPER]: 220,
        [PlayerRole.DEFENDER]:   280,
        [PlayerRole.MIDFIELDER]: 310,
        [PlayerRole.FORWARD]:    340,
    };

    constructor(
        scene: THREE.Scene,
        team: number,
        role: PlayerRole,
        teamColor: string,
        x: number,
        z: number
    ) {
        this.team = team;
        this.role = role;
        this.teamColor = new THREE.Color(teamColor);
        this.homePos = { x, z };

        this.mesh = this.buildMesh(scene);

        const physics = Physics.getInstance();
        // Spawnear encima del suelo (y=100)
        this.body = physics.createPlayerBody(x, 100, z);
    }

    private buildMesh(scene: THREE.Scene): THREE.Group {
        const group = new THREE.Group();

        // Kit colors
        const kitMat  = new THREE.MeshStandardMaterial({ color: this.teamColor, roughness: 0.6 });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xe5c185, roughness: 0.7 });
        const shortMat= new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });

        // Torso
        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(22, 55, 4, 8), kitMat);
        torso.position.y = 105;
        torso.castShadow = true;
        group.add(torso);

        // Cabeza
        const head = new THREE.Mesh(new THREE.SphereGeometry(18, 12, 12), skinMat);
        head.position.y = 162;
        head.castShadow = true;
        group.add(head);

        // Piernas
        const legGeo = new THREE.CapsuleGeometry(10, 50, 4, 8);
        this.legL = new THREE.Mesh(legGeo, shortMat);
        this.legL.position.set(-15, 50, 0);
        group.add(this.legL);

        this.legR = new THREE.Mesh(legGeo, shortMat);
        this.legR.position.set(15, 50, 0);
        group.add(this.legR);

        // ---BRAZOS (Atleta)---
        const armGeo = new THREE.CapsuleGeometry(8, 45, 4, 8);
        this.armL = new THREE.Mesh(armGeo, skinMat);
        this.armL.position.set(-30, 115, 0);
        group.add(this.armL);

        this.armR = new THREE.Mesh(armGeo, skinMat);
        this.armR.position.set(30, 115, 0);
        group.add(this.armR);

        // Portero → guantes amarillos
        if (this.role === PlayerRole.GOALKEEPER) {
            const gkMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24 });
            const glovGeo = new THREE.SphereGeometry(10, 8, 8);
            const gL = new THREE.Mesh(glovGeo, gkMat);
            gL.position.set(0, -25, 0); // en la mano
            this.armL.add(gL);
            const gR = new THREE.Mesh(glovGeo, gkMat);
            gR.position.set(0, -25, 0); // en la mano
            this.armR.add(gR);
        }

        scene.add(group);
        return group;
    }

    /** Actualizar IA y visual cada frame */
    public update(deltaMs: number, ballPos: { x: number; y: number; z: number }, ballVel: { x: number; y: number; z: number }, ballOwner: Player | null, isChaser: boolean = false, teammates: Player[] = [], opponents: Player[] = [], slotIndex: number = 0, teamAttacking: boolean = false) {
        
        const pos = this.body.translation();
        const speed = this.body.linvel();
        const spd = Math.hypot(speed.x, speed.z);

        // ---ANTICIPACIÓN (Predicción de Trayectoria)---
        const predictionFactor = isChaser ? 0.35 : 0.55;
        const targetBallPos = {
            x: ballPos.x + ballVel.x * predictionFactor,
            z: ballPos.z + ballVel.z * predictionFactor
        };

        // ---TOMA DE DECISIONES DE IA---
        const myGoalZ  = this.team === 0 ? -FIELD_H / 2 : FIELD_H / 2;
        const atkGoalZ = this.team === 0 ?  FIELD_H / 2 : -FIELD_H / 2;
        const distToBall = Math.hypot(pos.x - ballPos.x, pos.z - ballPos.z);

        // ---BLOQUE DINÁMICO (Líneas Adelantadas/Atrasadas)---
        const atkDir = this.team === 0 ? 1 : -1;
        const ballAdvancement = (ballPos.z * atkDir) / (FIELD_H / 2); 
        
        let currentHomeZ = this.homePos.z;
        if (teamAttacking) {
            currentHomeZ += atkDir * 800 * Math.max(0, ballAdvancement);
        } else {
            currentHomeZ += atkDir * -500 * Math.max(0, -ballAdvancement);
        }

        let targetX = this.homePos.x;
        let targetZ = currentHomeZ;

        // ---IA DE REGATE (Dribble Avoidance)---
        let dribbleOffsetX = 0;
        let dribbleOffsetZ = 0;
        if (this.hasBall) {
            opponents.forEach(opp => {
                const op = opp.body.translation();
                const odx = op.x - pos.x;
                const odz = op.z - pos.z;
                const odist = Math.hypot(odx, odz);
                if (odist < 500) {
                    const sideX = -odz / odist;
                    const sideZ =  odx / odist;
                    const factor = (500 - odist) / 500;
                    dribbleOffsetX += sideX * factor * 800;
                    dribbleOffsetZ += sideZ * factor * 800;
                }
            });
        }

        // ---COMPORTAMIENTO POR ROL---
        switch (this.role) {
            case PlayerRole.GOALKEEPER: {
                targetZ = myGoalZ * 0.94;
                targetX = THREE.MathUtils.clamp(targetBallPos.x * 0.4, -GOAL_W_HALF * 0.8, GOAL_W_HALF * 0.8);
                break;
            }
            case PlayerRole.DEFENDER: {
                if (isChaser && distToBall < 1800) {
                    targetX = targetBallPos.x;
                    targetZ = targetBallPos.z;
                } else {
                    const offsetX = (slotIndex % 3 - 1) * 200;
                    const offsetZ = Math.floor(slotIndex / 3) * -150;
                    targetZ = THREE.MathUtils.clamp(currentHomeZ + offsetZ, myGoalZ * 0.95, atkGoalZ * 0.3);
                    targetX = this.homePos.x + offsetX;
                    if (distToBall < 1200) {
                        targetX = THREE.MathUtils.lerp(targetX, targetBallPos.x, 0.4);
                        targetZ = THREE.MathUtils.lerp(targetZ, targetBallPos.z, 0.4);
                    }
                }
                break;
            }
            case PlayerRole.MIDFIELDER: {
                if (this.hasBall) {
                    targetZ = atkGoalZ;
                    targetX = 0;
                } else if (isChaser) {
                    targetX = targetBallPos.x;
                    targetZ = targetBallPos.z;
                } else {
                    if (teamAttacking && ballOwner) {
                        const angle = (slotIndex * Math.PI * 2) / 8;
                        const radius = 700;
                        targetX = ballPos.x + Math.cos(angle) * radius;
                        targetZ = ballPos.z + Math.sin(angle) * radius;
                        targetX = THREE.MathUtils.lerp(targetX, this.homePos.x, 0.5);
                        targetZ = THREE.MathUtils.lerp(targetZ, currentHomeZ, 0.5);
                    } else {
                        targetX = THREE.MathUtils.lerp(this.homePos.x, targetBallPos.x, 0.2);
                        targetZ = THREE.MathUtils.lerp(currentHomeZ, targetBallPos.z, 0.2);
                    }
                }
                break;
            }
            case PlayerRole.FORWARD: {
                if (this.hasBall) {
                    targetX = 0;
                    targetZ = atkGoalZ;
                } else if (isChaser) {
                    targetX = targetBallPos.x;
                    targetZ = targetBallPos.z;
                } else if (teamAttacking) {
                    const offsetX = (slotIndex % 3 - 1) * 450;
                    targetX = this.homePos.x + offsetX;
                    targetZ = THREE.MathUtils.lerp(currentHomeZ, atkGoalZ, 0.85);
                } else {
                    const offsetX = (slotIndex % 3 - 1) * 350;
                    targetX = this.homePos.x + offsetX;
                    targetZ = THREE.MathUtils.lerp(currentHomeZ, ballPos.z, 0.3);
                }
                break;
            }
        }

        // ---MOVIMIENTO HACIA OBJETIVO---
        const dx = targetX - pos.x;
        const dz = targetZ - pos.z;
        const dist = Math.hypot(dx, dz);
        const moveSpeed = this.speeds[this.role];

        // ---FUERZA DE SEPARACIÓN (Evitar amontonamientos)---
        let sepX = 0, sepZ = 0;
        const minSep = 180; 
        teammates.forEach(tm => {
            const tp = tm.body.translation();
            const sdx = pos.x - tp.x;
            const sdz = pos.z - tp.z;
            const d = Math.hypot(sdx, sdz);
            if (d < minSep && d > 0) {
                const force = (minSep - d) / minSep;
                sepX += (sdx / d) * force * 500;
                sepZ += (sdz / d) * force * 500;
            }
        });

        // ---MOVIMIENTO FINAL---
        if (dist > 40) {
            const moveX = (dx / dist) * moveSpeed + sepX + dribbleOffsetX;
            const moveZ = (dz / dist) * moveSpeed + sepZ + dribbleOffsetZ;
            const currentVel = this.body.linvel();
            const targetVX = THREE.MathUtils.lerp(currentVel.x, moveX, 0.12);
            const targetVZ = THREE.MathUtils.lerp(currentVel.z, moveZ, 0.12);
            this.body.setLinvel({ x: targetVX, y: currentVel.y, z: targetVZ }, true);
        } else {
            const cv = this.body.linvel();
            this.body.setLinvel({ x: cv.x * 0.7, y: cv.y, z: cv.z * 0.7 }, true);
        }

        // ---SINCRONIZACIÓN VISUAL---
        this.mesh.position.set(pos.x, pos.y - 100, pos.z);  

        if (spd > 20) {
            const angle = Math.atan2(speed.x, speed.z);
            this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, angle, 0.2);
            this.animPhase += (deltaMs / 1000) * (spd / 55) * Math.PI;
            const swing = Math.sin(this.animPhase);
            this.legL.rotation.x = swing * 0.8;
            this.legR.rotation.x = Math.sin(this.animPhase + Math.PI) * 0.8;
            this.armL.rotation.x = Math.sin(this.animPhase + Math.PI) * 0.7;
            this.armR.rotation.x = swing * 0.7;
            this.mesh.rotation.z = 0;
        } else {
            this.legL.rotation.x *= 0.85;
            this.legR.rotation.x *= 0.85;
            this.armL.rotation.x *= 0.85;
            this.armR.rotation.x *= 0.85;
        }

        if (this.state === PlayerState.CELEBRATE && pos.y < 130) {
            this.body.applyImpulse({ x: 0, y: 800, z: 0 }, true);
        }

        this.body.setRotation({ x: 0, y: this.mesh.rotation.y, z: 0, w: 1 }, true);
        this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    /** Resetear a posición de formación */
    public resetToHome() {
        this.body.setTranslation({ x: this.homePos.x, y: 100, z: this.homePos.z }, true);
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.hasBall = false;
        this.state = PlayerState.RETURN_TO_POS;
    }
}

// Constante auxiliar para calcular zona de portero
const GOAL_W_HALF = 732 / 2;

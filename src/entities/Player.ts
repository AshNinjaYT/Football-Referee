import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Physics, FIELD_H, FIELD_W } from '../core/Physics';

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
    RETURN_TO_POS,
    MARK_OPPONENT,
    SUPPORT_RUN,
    PRESS
}

export class Player {
    public mesh: THREE.Group;
    public body: RAPIER.RigidBody;

    public team: number;
    public role: PlayerRole;
    public state: PlayerState = PlayerState.RETURN_TO_POS;
    public hasBall: boolean = false;

    // Posición táctica base fija (su "casa" en la formación)
    public homePos: { x: number; z: number };

    // Velocidades realistas según rol (en unidades/s)
    private readonly MAX_SPEED: Record<PlayerRole, number> = {
        [PlayerRole.GOALKEEPER]: 200,
        [PlayerRole.DEFENDER]:   260,
        [PlayerRole.MIDFIELDER]: 290,
        [PlayerRole.FORWARD]:    320,
    };

    private teamColor: THREE.Color;
    private legL!: THREE.Mesh;
    private legR!: THREE.Mesh;
    private armL!: THREE.Mesh;
    private armR!: THREE.Mesh;
    private torsoMesh!: THREE.Mesh;
    private animPhase = 0;

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
        this.body = Physics.getInstance().createPlayerBody(x, 100, z);
    }

    private buildMesh(scene: THREE.Scene): THREE.Group {
        const group = new THREE.Group();
        const kitMat   = new THREE.MeshStandardMaterial({ color: this.teamColor, roughness: 0.5, metalness: 0.1 });
        const skinMat  = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.8 });
        const shortMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });
        const sockMat  = new THREE.MeshStandardMaterial({ color: this.teamColor.clone().multiplyScalar(0.7), roughness: 0.7 });
        const bootMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });

        // Torso
        this.torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(20, 50, 6, 8), kitMat);
        this.torsoMesh.position.y = 105;
        this.torsoMesh.castShadow = true;
        group.add(this.torsoMesh);

        // Cabeza
        const head = new THREE.Mesh(new THREE.SphereGeometry(17, 12, 12), skinMat);
        head.position.y = 163;
        head.castShadow = true;
        group.add(head);

        // Shorts
        const shorts = new THREE.Mesh(new THREE.CylinderGeometry(20, 18, 22, 8), shortMat);
        shorts.position.y = 72;
        group.add(shorts);

        // Piernas
        const legGeo = new THREE.CapsuleGeometry(9, 45, 4, 8);
        this.legL = new THREE.Mesh(legGeo, skinMat);
        this.legL.position.set(-13, 48, 0);
        group.add(this.legL);
        this.legR = new THREE.Mesh(legGeo, skinMat);
        this.legR.position.set(13, 48, 0);
        group.add(this.legR);

        // Calcetines
        const sockGeo = new THREE.CapsuleGeometry(9, 20, 4, 8);
        const sockL = new THREE.Mesh(sockGeo, sockMat);
        sockL.position.set(-13, 22, 0);
        group.add(sockL);
        const sockR = new THREE.Mesh(sockGeo, sockMat);
        sockR.position.set(13, 22, 0);
        group.add(sockR);

        // Botas
        const bootGeo = new THREE.BoxGeometry(18, 10, 26);
        const bootL = new THREE.Mesh(bootGeo, bootMat);
        bootL.position.set(-13, 8, 5);
        group.add(bootL);
        const bootR = new THREE.Mesh(bootGeo, bootMat);
        bootR.position.set(13, 8, 5);
        group.add(bootR);

        // Brazos
        const armGeo = new THREE.CapsuleGeometry(7, 40, 4, 8);
        this.armL = new THREE.Mesh(armGeo, skinMat);
        this.armL.position.set(-28, 112, 0);
        group.add(this.armL);
        this.armR = new THREE.Mesh(armGeo, skinMat);
        this.armR.position.set(28, 112, 0);
        group.add(this.armR);

        // Portero → color diferente + guantes
        if (this.role === PlayerRole.GOALKEEPER) {
            this.torsoMesh.material = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
            const gkMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f });
            const glovGeo = new THREE.SphereGeometry(11, 8, 8);
            const gL = new THREE.Mesh(glovGeo, gkMat);
            gL.position.set(0, -22, 0);
            this.armL.add(gL);
            const gR = new THREE.Mesh(glovGeo, gkMat);
            gR.position.set(0, -22, 0);
            this.armR.add(gR);
        }

        scene.add(group);
        return group;
    }

    /**
     * CEREBRO DE IA — Llamado cada frame desde Engine
     * Parámetros extendidos para toma de decisiones correctas
     */
    public update(
        deltaMs: number,
        ballPos: { x: number; y: number; z: number },
        ballVel: { x: number; y: number; z: number },
        ballOwner: Player | null,
        isChaser: boolean,
        teammates: Player[],
        _opponents: Player[],
        slotIndex: number,
        teamAttacking: boolean,
        // Nuevos parámetros
        nearestOpponent: Player | null,
        _ballFreeSeconds: number
    ) {
        const pos = this.body.translation();
        const vel = this.body.linvel();
        const spd = Math.hypot(vel.x, vel.z);

        const myGoalZ  = this.team === 0 ? -FIELD_H / 2 : FIELD_H / 2;
        const atkGoalZ = this.team === 0 ?  FIELD_H / 2 : -FIELD_H / 2;
        const atkDir   = this.team === 0 ? 1 : -1;
        const distToBall = Math.hypot(pos.x - ballPos.x, pos.z - ballPos.z);

        // Predicción de trayectoria del balón (0.4s adelante)
        const PRED = 0.4;
        const predictedBall = {
            x: ballPos.x + ballVel.x * PRED,
            z: ballPos.z + ballVel.z * PRED
        };

        // Avance del balón en el campo (−1 propio tercio, +1 tercio rival)
        const ballZ_norm = (ballPos.z * atkDir) / (FIELD_H / 2);

        // Posición táctica ajustada al movimiento del balón (bloque dinámico)
        const dynamicShiftZ = atkDir * THREE.MathUtils.clamp(ballZ_norm * 1200, -2000, 2000);
        const dynamicHomeZ = THREE.MathUtils.clamp(
            this.homePos.z + dynamicShiftZ,
            myGoalZ * 0.98,
            atkGoalZ * 0.85
        );

        let targetX = this.homePos.x;
        let targetZ = dynamicHomeZ;
        let urgency = 0.1; // 0=lento, 1=sprint

        // ── PORTERO ──────────────────────────────────────────────────────
        if (this.role === PlayerRole.GOALKEEPER) {
            const GK_LINE_Z = myGoalZ * 0.92;
            // Cubre la línea de portería moviéndose lateralmente
            const lateralTrack = THREE.MathUtils.clamp(predictedBall.x * 0.35, -320, 320);
            targetX = lateralTrack;
            targetZ = GK_LINE_Z;

            // Salida al balón si está dentro del área
            const inBox = Math.abs(ballPos.x) < 1100 &&
                          Math.abs(ballPos.z - myGoalZ) < 1650;
            if (inBox && !ballOwner) {
                targetX = predictedBall.x;
                targetZ = predictedBall.z;
                urgency = 1.0;
            } else if (inBox && ballOwner && ballOwner.team !== this.team) {
                targetX = predictedBall.x;
                targetZ = predictedBall.z;
                urgency = 0.9;
            } else {
                urgency = 0.5;
            }
        }

        // ── DEFENSA ──────────────────────────────────────────────────────
        else if (this.role === PlayerRole.DEFENDER) {
            if (this.hasBall) {
                // Con balón: sacar hacia el centro o pasar lateral seguro
                targetX = 0;
                targetZ = dynamicHomeZ + atkDir * 500;
                urgency = 0.7;
            } else if (isChaser && distToBall < 2500) {
                // Ir a por el balón
                targetX = predictedBall.x;
                targetZ = predictedBall.z;
                urgency = 0.95;
            } else if (!teamAttacking) {
                // DEFENSA: cubrir al atacante más cercano en nuestro tercio
                if (nearestOpponent && nearestOpponent.role === PlayerRole.FORWARD) {
                    const opp = nearestOpponent.body.translation();
                    // Posicionarse entre el oponente y nuestra portería
                    targetX = THREE.MathUtils.lerp(opp.x, 0, 0.3);
                    targetZ = THREE.MathUtils.lerp(opp.z, myGoalZ, 0.35);
                    urgency = 0.75;
                } else {
                    // Línea defensiva compacta
                    const lineX = this.homePos.x + (slotIndex % 4 - 1.5) * 300;
                    targetX = THREE.MathUtils.lerp(lineX, ballPos.x, 0.15);
                    targetZ = THREE.MathUtils.clamp(dynamicHomeZ, myGoalZ * 0.9, myGoalZ * 0.5);
                    urgency = 0.4;
                }
            } else {
                // ATAQUE: subir como lateral pero sin sobrepasar el medio
                targetX = this.homePos.x;
                targetZ = THREE.MathUtils.clamp(dynamicHomeZ, myGoalZ * 0.7, 0);
                urgency = 0.3;
            }
        }

        // ── CENTROCAMPISTA ────────────────────────────────────────────────
        else if (this.role === PlayerRole.MIDFIELDER) {
            if (this.hasBall) {
                // Con balón: buscar espacio adelante sin ir directo a portería
                targetX = this.homePos.x;
                targetZ = dynamicHomeZ + atkDir * 800;
                urgency = 0.8;
            } else if (isChaser && distToBall < 2000) {
                targetX = predictedBall.x;
                targetZ = predictedBall.z;
                urgency = 0.9;
            } else if (teamAttacking && ballOwner) {
                // APOYO OFENSIVO: triangular, ofrecer líneas de pase
                const ownerPos = ballOwner.body.translation();
                const angle = (slotIndex * 1.8 + 0.5) * Math.PI / 3;
                const radius = 1400 + slotIndex * 200;
                const supportX = ownerPos.x + Math.cos(angle) * radius * 0.6;
                const supportZ = ownerPos.z + atkDir * Math.abs(Math.sin(angle)) * radius * 0.8;
                targetX = THREE.MathUtils.clamp(supportX, -FIELD_W * 0.45, FIELD_W * 0.45);
                targetZ = THREE.MathUtils.clamp(supportZ, myGoalZ * 0.9, atkGoalZ * 0.7);
                urgency = 0.6;
            } else if (!teamAttacking) {
                // PRESSING en bloque: avanzar al portador rival
                if (ballOwner && ballOwner.team !== this.team && distToBall < 3000) {
                    targetX = THREE.MathUtils.lerp(this.homePos.x, ballPos.x, 0.5);
                    targetZ = THREE.MathUtils.lerp(dynamicHomeZ, ballPos.z, 0.4);
                    urgency = 0.7;
                } else {
                    targetX = THREE.MathUtils.lerp(this.homePos.x, ballPos.x, 0.25);
                    targetZ = THREE.MathUtils.lerp(dynamicHomeZ, ballPos.z, 0.2);
                    urgency = 0.35;
                }
            } else {
                targetX = THREE.MathUtils.lerp(this.homePos.x, ballPos.x, 0.2);
                targetZ = dynamicHomeZ;
                urgency = 0.3;
            }
        }

        // ── DELANTERO ─────────────────────────────────────────────────────
        else if (this.role === PlayerRole.FORWARD) {
            if (this.hasBall) {
                // Con balón: ir hacia portería, buscar ángulo
                const angleToGoal = Math.atan2(-ballPos.x, atkGoalZ - ballPos.z);
                targetX = ballPos.x + Math.sin(angleToGoal) * 200;
                targetZ = atkGoalZ;
                urgency = 1.0;
            } else if (isChaser && distToBall < 1800) {
                targetX = predictedBall.x;
                targetZ = predictedBall.z;
                urgency = 1.0;
            } else if (teamAttacking) {
                // MOVIMIENTO SIN BALÓN: buscar espacio detrás de la defensa
                const spreadX = this.homePos.x + (slotIndex % 3 - 1) * 1600;
                // Carrera a la espalda: posicionarse entre los defensas y la portería rival
                const depthZ = THREE.MathUtils.lerp(dynamicHomeZ, atkGoalZ, 0.7);
                targetX = THREE.MathUtils.clamp(spreadX, -FIELD_W * 0.42, FIELD_W * 0.42);
                targetZ = depthZ;
                urgency = 0.7;
            } else {
                // SIN POSESIÓN: pressing alto, acechar al portero rival
                if (ballOwner && ballOwner.role === PlayerRole.GOALKEEPER) {
                    targetX = ballPos.x + (slotIndex % 2 === 0 ? 400 : -400);
                    targetZ = atkGoalZ - atkDir * 800;
                    urgency = 0.6;
                } else {
                    targetX = this.homePos.x + (slotIndex % 3 - 1) * 800;
                    targetZ = THREE.MathUtils.lerp(dynamicHomeZ, atkGoalZ, 0.35);
                    urgency = 0.35;
                }
            }
        }

        // ── SEPARACIÓN de compañeros (anti-aglomeración) ──────────────────
        let sepX = 0, sepZ = 0;
        const MIN_SEP = 300; // Aumentado de 200 a 300
        teammates.forEach(tm => {
            const tp = tm.body.translation();
            const sdx = pos.x - tp.x;
            const sdz = pos.z - tp.z;
            const d = Math.hypot(sdx, sdz);
            if (d < MIN_SEP && d > 1) {
                const f = ((MIN_SEP - d) / MIN_SEP) * 900; // Aumentado fuerza
                sepX += (sdx / d) * f;
                sepZ += (sdz / d) * f;
            }
        });

        // ── APLICAR VELOCIDAD ─────────────────────────────────────────────
        const dx = targetX - pos.x;
        const dz = targetZ - pos.z;
        const dist = Math.hypot(dx, dz);
        const maxSpd = this.MAX_SPEED[this.role];

        if (dist > 50) {
            const desiredSpd = maxSpd * urgency;
            const velX = (dx / dist) * desiredSpd + sepX;
            const velZ = (dz / dist) * desiredSpd + sepZ;
            // Lerp suave para momentum natural
            const lerpFactor = THREE.MathUtils.clamp(deltaMs / 180, 0.05, 0.22);
            const cv = this.body.linvel();
            this.body.setLinvel({
                x: THREE.MathUtils.lerp(cv.x, velX, lerpFactor),
                y: cv.y,
                z: THREE.MathUtils.lerp(cv.z, velZ, lerpFactor)
            }, true);
        } else {
            // Frenado
            const cv = this.body.linvel();
            this.body.setLinvel({ x: cv.x * 0.75, y: cv.y, z: cv.z * 0.75 }, true);
        }

        // ── SINCRONIZACIÓN VISUAL ─────────────────────────────────────────
        this.mesh.position.set(pos.x, pos.y - 100, pos.z);

        if (spd > 15) {
            const angle = Math.atan2(vel.x, vel.z);
            this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, angle, 0.18);
            this.animPhase += (deltaMs / 1000) * (spd / 60) * Math.PI * 2;
            const sw = Math.sin(this.animPhase);
            this.legL.rotation.x = sw * 0.85;
            this.legR.rotation.x = Math.sin(this.animPhase + Math.PI) * 0.85;
            this.armL.rotation.x = Math.sin(this.animPhase + Math.PI) * 0.65;
            this.armR.rotation.x = sw * 0.65;
        } else {
            // Amortiguación suave de la animación
            this.legL.rotation.x *= 0.88;
            this.legR.rotation.x *= 0.88;
            this.armL.rotation.x *= 0.88;
            this.armR.rotation.x *= 0.88;
        }

        // Celebración: salto
        if (this.state === PlayerState.CELEBRATE && pos.y < 130) {
            this.body.applyImpulse({ x: (Math.random() - 0.5) * 200, y: 900, z: (Math.random() - 0.5) * 200 }, true);
        }

        // Evitar rotaciones físicas
        this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    public resetToHome() {
        this.body.setTranslation({ x: this.homePos.x, y: 100, z: this.homePos.z }, true);
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        this.hasBall = false;
        this.state = PlayerState.RETURN_TO_POS;
    }
}

import RAPIER from '@dimforge/rapier3d-compat';

// Dimensiones del campo en unidades (escala 1:1 con el visual)
// Campo: 100m x 68m → 5000 x 3400 unidades (1 unidad = 2cm)
export const FIELD_W = 6800;  // Ancho FIFA (68m)
export const FIELD_H = 10500; // Largo FIFA (105m)
export const GOAL_W  = 732;   // Ancho portería (7.32m)
export const GOAL_H  = 244;   // Alto portería (2.44m)

export class Physics {
    public world: RAPIER.World;
    private static instance: Physics;
    private accumulator: number = 0;
    private readonly FIXED_DT = 1 / 60; // 60 Hz fijo

    private constructor() {
        this.world = new RAPIER.World({ x: 0.0, y: -980.0, z: 0.0 }); // gravedad realista (g=9.8m/s², x100)
    }

    public static async init(): Promise<Physics> {
        await RAPIER.init();
        if (!Physics.instance) {
            Physics.instance = new Physics();
        }
        return Physics.instance;
    }

    public static getInstance(): Physics {
        return Physics.instance;
    }

    /**
     * Fixed timestep step — llámalo con el tiempo real transcurrido.
     * Garantiza que la física siempre corre a 60 Hz independientemente del FPS.
     */
    public step(deltaMs: number) {
        this.accumulator += Math.min(deltaMs, 100) / 1000; // cap a 100ms para evitar espiral de muerte
        while (this.accumulator >= this.FIXED_DT) {
            this.world.step();
            this.accumulator -= this.FIXED_DT;
        }
    }

    public createBallBody(radius: number, x: number, y: number, z: number): RAPIER.RigidBody {
        const desc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .setLinearDamping(0.6)   // Fricción aérea del balón
            .setAngularDamping(0.5)
            .setCcdEnabled(true);

        const body = this.world.createRigidBody(desc);
        const col = RAPIER.ColliderDesc.ball(radius)
            .setRestitution(0.65)
            .setFriction(0.5)
            .setDensity(0.5);
        this.world.createCollider(col, body);
        return body;
    }

    public createPlayerBody(x: number, y: number, z: number): RAPIER.RigidBody {
        const desc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .lockRotations()
            .setLinearDamping(8.0)  // Alta fricción → se para rápido al soltar tecla
            .setCcdEnabled(true);

        const body = this.world.createRigidBody(desc);
        // Cápsula humana: más pesada y estable (radio 22, masa explícita)
        const col = RAPIER.ColliderDesc.capsule(75, 22)
            .setRestitution(0.0)
            .setFriction(1.0)
            .setDensity(2.5); // Aumentar densidad para que no vuelen por choques
        this.world.createCollider(col, body);
        return body;
    }

    /** Suelo + muros invisibles que coinciden con las líneas del campo */
    public createFieldBoundaries() {
        const W = FIELD_W / 2;
        const H = FIELD_H / 2;
        const wallH = 400;
        const wallT = 50;

        const addStatic = (hw: number, hh: number, hd: number, x: number, y: number, z: number) => {
            const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
            this.world.createCollider(RAPIER.ColliderDesc.cuboid(hw, hh, hd), body);
        };

        // Suelo
        addStatic(W + wallT, 10, H + wallT, 0, -10, 0);

        // Muro Norte/Sur (líneas de fondo)
        addStatic(W + wallT, wallH, wallT, 0, wallH, H);
        addStatic(W + wallT, wallH, wallT, 0, wallH, -H);

        // Muro Este/Oeste (líneas laterales)
        addStatic(wallT, wallH, H, W, wallH, 0);
        addStatic(wallT, wallH, H, -W, wallH, 0);

        // ---PORTERÍAS FÍSICAS---
        // Portería Sur (equipo local ataca hacia +Z)
        this.createGoalColliders(H, 1);
        // Portería Norte (equipo visitante ataca hacia -Z)
        this.createGoalColliders(-H, -1);
    }

    private createGoalColliders(zCenter: number, dir: number) {
        const gw = GOAL_W / 2;
        const gh = GOAL_H;
        const pr = 12; // radio poste
        const depth = 200; // profundidad de red

        const addStatic = (hw: number, hh: number, hd: number, x: number, y: number, z: number) => {
            const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
            this.world.createCollider(RAPIER.ColliderDesc.cuboid(hw, hh, hd), body);
        };

        // Postes verticales
        addStatic(pr, gh / 2, pr, -gw, gh / 2, zCenter);
        addStatic(pr, gh / 2, pr,  gw, gh / 2, zCenter);
        // Larguero
        addStatic(gw + pr, pr, pr, 0, gh, zCenter);
        // Fondo de red (invisible)
        addStatic(gw, pr, pr, 0, gh / 2, zCenter + dir * depth);
        // Laterales de red
        addStatic(pr, gh / 2, depth / 2, -gw, gh / 2, zCenter + dir * (depth / 2));
        addStatic(pr, gh / 2, depth / 2,  gw, gh / 2, zCenter + dir * (depth / 2));
    }
}

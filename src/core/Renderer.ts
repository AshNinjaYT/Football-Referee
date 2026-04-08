import * as THREE from 'three';
import { FIELD_W, FIELD_H, GOAL_W, GOAL_H } from './Physics';

export class Renderer {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public ambientLight: THREE.AmbientLight;
    public sunLight: THREE.DirectionalLight;

    constructor(canvas: HTMLCanvasElement) {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a1628);
        this.scene.fog = new THREE.Fog(0x0a1628, FIELD_H * 1.2, FIELD_H * 2.5);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, FIELD_H * 3);

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // Luz ambiental suave
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
        this.scene.add(this.ambientLight);

        // Sol/foco principal
        this.sunLight = new THREE.DirectionalLight(0xfff5e4, 2.0);
        this.sunLight.position.set(FIELD_W * 0.4, 4000, FIELD_H * 0.2);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.camera.left   = -FIELD_W * 0.7;
        this.sunLight.shadow.camera.right  =  FIELD_W * 0.7;
        this.sunLight.shadow.camera.top    =  FIELD_H * 0.6;
        this.sunLight.shadow.camera.bottom = -FIELD_H * 0.6;
        this.sunLight.shadow.mapSize.width  = 4096;
        this.sunLight.shadow.mapSize.height = 4096;
        this.sunLight.shadow.bias = -0.0002;
        this.scene.add(this.sunLight);

        // 4 focos de estadio en las esquinas
        const floodW = FIELD_W / 2 + 800;
        const floodH = FIELD_H / 2 + 600;
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
            const pt = new THREE.PointLight(0xfff8dc, 0.8, FIELD_W * 1.2);
            pt.position.set(sx * floodW, 2000, sz * floodH);
            this.scene.add(pt);
        });

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    public render() {
        this.renderer.render(this.scene, this.camera);
    }

    // ─────────────────────── CAMPO ──────────────────────────
    public createGrassField(fw: number, fh: number) {
        const HW = fw / 2;
        const HH = fh / 2;

        // Césped rayado (alternando oscuro/claro cada franja)
        const stripes = 18;
        const strW = fh / stripes;
        const dark  = 0x14532d;
        const light = 0x166534;

        for (let i = 0; i < stripes; i++) {
            const geo = new THREE.PlaneGeometry(fw, strW);
            const mat = new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? dark : light, roughness: 0.9 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(0, 0, -HH + (i + 0.5) * strW);
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        }

        // ── Líneas de cal (Reglamentarias FIFA) ──
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        const lw = 12; // grosor de línea (12cm)

        const line = (w: number, d: number, x: number, z: number) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d), lineMat);
            m.position.set(x, 2, z);
            this.scene.add(m);
        };

        // Perímetro (Touchlines y Goal lines)
        line(fw, lw,  0,  HH);
        line(fw, lw,  0, -HH);
        line(lw, fh,  HW, 0);
        line(lw, fh, -HW, 0);

        // Medio campo
        line(fw, lw, 0, 0);

        // Círculo central (9.15m de radio)
        const torus = new THREE.Mesh(
            new THREE.TorusGeometry(915, lw, 8, 64), lineMat
        );
        torus.rotation.x = Math.PI / 2;
        torus.position.y = 2;
        this.scene.add(torus);

        // Punto central
        const dot = new THREE.Mesh(new THREE.CircleGeometry(lw * 2, 16), lineMat);
        dot.rotation.x = -Math.PI / 2;
        dot.position.y = 2.1;
        this.scene.add(dot);

        // ── ÁREAS (Norte y Sur) ──
        [1, -1].forEach(side => {
            const zLine = side * HH;
            
            // Área Grande (16.5m)
            const bigW = 4032;
            const bigD = 1650;
            line(bigW, lw, 0, zLine - side * bigD);
            line(lw, bigD, -bigW / 2, zLine - side * bigD / 2);
            line(lw, bigD,  bigW / 2, zLine - side * bigD / 2);

            // Área Chica (5.5m)
            const smallW = 1832;
            const smallD = 550;
            line(smallW, lw, 0, zLine - side * smallD);
            line(lw, smallD, -smallW / 2, zLine - side * smallD / 2);
            line(lw, smallD,  smallW / 2, zLine - side * smallD / 2);

            // Punto de Penalti (11m)
            const pDot = new THREE.Mesh(new THREE.CircleGeometry(lw * 2, 16), lineMat);
            pDot.rotation.x = -Math.PI / 2;
            pDot.position.set(0, 2.1, zLine - side * 1100);
            this.scene.add(pDot);

            // Medialuna (Medida desde el punto de penalti)
            // Es un arco de 9.15m de radio que empieza en el límite del área grande
            const arcGeo = new THREE.TorusGeometry(915, lw, 8, 32, Math.PI * 0.45);
            const arc = new THREE.Mesh(arcGeo, lineMat);
            arc.rotation.x = Math.PI / 2;
            arc.rotation.z = side > 0 ? Math.PI : 0;
            arc.position.set(0, 2, zLine - side * 1100);
            this.scene.add(arc);
        });

        // Porterías visuales (blancas)
        this.createGoalMesh(HH,  1);
        this.createGoalMesh(-HH, -1);

        // Estructura del estadio
        this.createStadium(fw, fh);
    }

    private createGoalMesh(z: number, _dir: number) {
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
        const pr  = 10;
        const gw  = GOAL_W / 2;
        const gh  = GOAL_H;

        const post = (x: number) => {
            const m = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, gh), mat);
            m.position.set(x, gh / 2, z);
            m.castShadow = true;
            this.scene.add(m);
        };
        post(-gw);
        post( gw);

        const bar = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, GOAL_W + pr * 2), mat);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, gh, z);
        bar.castShadow = true;
        this.scene.add(bar);

        // Red (semitransparente)
        const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, wireframe: true });
        const netGeo = new THREE.BoxGeometry(GOAL_W, gh, 200);
        const net = new THREE.Mesh(netGeo, netMat);
        net.position.set(0, gh / 2, z + _dir * 100);
        this.scene.add(net);
    }

    private createStadium(fw: number, fh: number) {
        const HW = fw / 2;
        const HH = fh / 2;
        const standMat  = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
        const bulbMat   = new THREE.MeshBasicMaterial({ color: 0xfefce8 });
        const adMat     = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.2 });

        // Gradas (4 lados)
        const stands = [
            { w: fw + 3000, h: 1200, d: 2000, x: 0,       z: HH + 1200  },
            { w: fw + 3000, h: 1200, d: 2000, x: 0,       z: -(HH + 1200) },
            { w: 2000,      h: 1200, d: fh,   x: HW + 1200, z: 0         },
            { w: 2000,      h: 1200, d: fh,   x: -(HW + 1200), z: 0      },
        ];
        stands.forEach((s, idx) => {
            // Estructura principal de la grada
            const m = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), standMat);
            m.position.set(s.x, s.h / 2, s.z);
            m.castShadow = true;
            m.receiveShadow = true;
            this.scene.add(m);

            // Vallas publicitarias (Billboards) en el borde frontal
            const isHorizontal = idx < 2;
            const adW = isHorizontal ? s.w - 400 : 10;
            const adD = isHorizontal ? 10 : s.d - 400;
            const adH = 180;
            const adMesh = new THREE.Mesh(new THREE.BoxGeometry(adW, adH, adD), adMat);
            
            const offset = 1010;
            if (isHorizontal) {
                adMesh.position.set(s.x, adH / 2 + 5, s.z + (s.z > 0 ? -offset : offset));
            } else {
                adMesh.position.set(s.x + (s.x > 0 ? -offset : offset), adH / 2 + 5, s.z);
            }
            this.scene.add(adMesh);
        });

        // Torres de iluminación + focos
        const corners = [[-1,-1],[1,-1],[-1,1],[1,1]] as const;
        corners.forEach(([sx, sz]) => {
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(35, 35, 2500), pillarMat);
            pillar.position.set(sx * (HW + 800), 1250, sz * (HH + 800));
            this.scene.add(pillar);

            const bulb = new THREE.Mesh(new THREE.BoxGeometry(450, 250, 200), bulbMat);
            bulb.position.set(sx * (HW + 800), 2500, sz * (HH + 800));
            bulb.lookAt(0, 0, 0); // Orientar focos al centro
            this.scene.add(bulb);
        });
    }
}

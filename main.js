const DOM = {
    startOverlay: document.getElementById('start-overlay'),
    foulModal: document.getElementById('foul-modal'),
    hud: document.getElementById('hud'),
    respectFill: document.getElementById('respect-fill'),
    respectValue: document.getElementById('respect-value'),
    gameOver: document.getElementById('game-over'),
    playerInfo: document.getElementById('foul-player-info')
};

const state = {
    paused: true,
    scoreLocal: 0, scoreVisitante: 0, 
    localTeam: { name: 'LOCAL', color: '#3b82f6' }, // Team 1
    awayTeam: { name: 'VISITANTE', color: '#ef4444' }, // Team 2
    timeRemaining: 120, currentGameSeconds: 0,
    timerInterval: null,
    fans: [], // Phase 36
    currentMode: '8v8',
    freeKickPending: false,
    stats: { fouls: 0, yellow: 0, red: 0, goals: 0 },
    x: 0, y: 200, z: 2000, speed: 18, 
    keys: { w: false, a: false, s: false, d: false },
    players: [], respect: 100, selectedPlayer: null, currentKicker: null,
    ball: { x: 0, y: 30, z: 0, vx: 0, vy: 0, vz: 0, curve: 0, owner: null, mesh: null, lastTouch: null, throwInTeam: null },
    coaches: []
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.FogExp2(0x87CEEB, 0.0001);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 5, 30000); 
camera.rotation.order = 'YXZ'; 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.zIndex = '-1';
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
dirLight.position.set(-2000, 3000, 2000);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096; 
dirLight.shadow.mapSize.height = 4096;
dirLight.shadow.camera.left = -6000;
dirLight.shadow.camera.right = 6000;
dirLight.shadow.camera.top = 6000;
dirLight.shadow.camera.bottom = -6000;
dirLight.shadow.camera.far = 15000;
scene.add(dirLight);

// --- Stadium Floodlights (WOW factor) ---
function addSpotlight(x, z) {
    const spot = new THREE.SpotLight(0xffffff, 0.7);
    spot.position.set(x, 4000, z);
    spot.target.position.set(0, 0, 0);
    spot.angle = 0.6;
    spot.penumbra = 0.5;
    spot.decay = 1.0;
    spot.distance = 12000;
    spot.castShadow = true;
    spot.shadow.mapSize.width = 1024;
    spot.shadow.mapSize.height = 1024;
    scene.add(spot);
    scene.add(spot.target);
}
addSpotlight(-5000, -6000);
addSpotlight(5000, -6000);
addSpotlight(-5000, 6000);
addSpotlight(5000, 6000);

// --- STADIUM FACTORY (PHASE 34) ---
function buildStadium(theme) {
    // Clear existing if any (optional for first load)
    const floorGroup = new THREE.Group();
    scene.add(floorGroup);

    let colors = {
        track: 0x1e3a8a,      // Blue
        pitch: 0x2e8b57,      // Green
        walls: 0x1e293b,      // Dark Grey
        lines: 0xffffff,      // White
        bench: 0x334155,
        chair: 0x1e293b
    };

    if (theme === 'industrial') {
        colors = {
            track: 0x0f172a,      // Slate 950 (Almost black)
            pitch: 0x334155,      // Slate 600 (Dark grey grass)
            walls: 0x020617,      // Slate 950
            lines: 0x38bdf8,      // Sky 400 (Neon Cyan)
            bench: 0x1e293b,
            chair: 0x0f172a
        };
        scene.fog.color.set(0x020617);
        scene.background.set(0x020617);
    } else if (theme === 'monumental') {
        colors = {
            track: 0x4b5563,      // Grey stone
            pitch: 0x059669,      // Vibrant Emerald
            walls: 0x374151,      // Concrete
            lines: 0xffffff,
            bench: 0xef4444,      // Vibrant Red benches
            chair: 0x991b1b
        };
    }

    // 1. Perimeter Track (Expanded for monumental scale)
    const trackSizeX = theme === 'monumental' ? 30000 : 16000;
    const trackSizeZ = theme === 'monumental' ? 30000 : 20000;
    const trackMat = new THREE.MeshPhongMaterial({ color: colors.track }); 
    const track = new THREE.Mesh(new THREE.PlaneGeometry(trackSizeX, trackSizeZ), trackMat);
    track.rotation.x = -Math.PI / 2; track.position.y = -1; track.receiveShadow = true;
    floorGroup.add(track);

    // 2. Regulation Grass Pitch (Striped Grass)
    const grassCvs = document.createElement('canvas'); grassCvs.width=512; grassCvs.height=512;
    const gCtx = grassCvs.getContext('2d');
    gCtx.fillStyle = '#' + colors.pitch.toString(16).padStart(6, '0');
    gCtx.fillRect(0,0,512,512);
    // Add darker stripes
    gCtx.fillStyle = 'rgba(0,0,0,0.12)';
    for(let i=0; i<8; i++) {
        if(i % 2 === 0) gCtx.fillRect(0, i*64, 512, 64);
    }
    const grassTex = new THREE.CanvasTexture(grassCvs);
    grassTex.wrapS = THREE.RepeatWrapping; grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(1, 10); // Vertical stripes across the pitch

    const pitchMat = new THREE.MeshStandardMaterial({ 
        map: grassTex, 
        roughness: 0.8,
        metalness: 0.1
    });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(8000, 10000), pitchMat); 
    pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true;
    floorGroup.add(pitch);

    function drawLine(w, d, x, z) {
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({color: colors.lines, side: THREE.DoubleSide}));
        mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, 2, z); scene.add(mesh);
    }
    drawLine(8000, 30, 0, -5000); drawLine(8000, 30, 0, 5000); 
    drawLine(30, 10000, -4000, 0); drawLine(30, 10000, 4000, 0); 
    drawLine(8000, 30, 0, 0); 
    drawLine(2400, 30, 0, -4000); drawLine(30, 1000, -1200, -4500); drawLine(30, 1000, 1200, -4500);
    drawLine(2400, 30, 0, 4000); drawLine(30, 1000, -1200, 4500); drawLine(30, 1000, 1200, 4500);
    const circle = new THREE.Mesh(new THREE.RingGeometry(1000, 1030, 64), new THREE.MeshBasicMaterial({color: colors.lines, side: THREE.DoubleSide}));
    circle.rotation.x = -Math.PI / 2; circle.position.y = 2; scene.add(circle);

    function drawWall(w, h, d, x, y, z) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshPhongMaterial({color: colors.walls}));
        mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    }
    const wallOffX = theme === 'monumental' ? 14500 : 8100;
    const wallOffZ = theme === 'monumental' ? 14500 : 10100;
    const wallLenX = theme === 'monumental' ? 30000 : 16200;
    const wallLenZ = theme === 'monumental' ? 30000 : 20400;

    drawWall(wallLenX, 3000, 200, 0, 1500, -wallOffZ); // Taller walls for stadium
    drawWall(wallLenX, 3000, 200, 0, 1500, wallOffZ);  
    drawWall(200, 3000, wallLenZ, -wallOffX, 1500, 0); 
    drawWall(200, 3000, wallLenZ, wallOffX, 1500, 0);   

    function buildRealGoal(isNorth) {
        const zPos = isNorth ? -5000 : 5000;
        const g = new THREE.Group(); g.position.z = zPos;
        const pMat = new THREE.MeshPhongMaterial({color: colors.lines}); // Matches lines
        const pL = new THREE.Mesh(new THREE.CylinderGeometry(15,15,350), pMat); pL.position.set(-400, 175, 0);
        const pR = new THREE.Mesh(new THREE.CylinderGeometry(15,15,350), pMat); pR.position.set(400, 175, 0);
        const cb = new THREE.Mesh(new THREE.CylinderGeometry(15,15,800), pMat); cb.rotation.z = Math.PI/2; cb.position.set(0, 350, 0);
        pL.castShadow=true; pL.receiveShadow=true; pR.castShadow=true; pR.receiveShadow=true; cb.castShadow=true; cb.receiveShadow=true;
        const netGeoBack = new THREE.PlaneGeometry(800, 350, 40, 18);
        const netGeoTop = new THREE.PlaneGeometry(800, 250, 40, 12);
        const netGeoSide = new THREE.PlaneGeometry(250, 350, 12, 18);
        const nMat = new THREE.MeshBasicMaterial({color: colors.lines, wireframe: true, transparent: true, opacity: 0.3, side: THREE.DoubleSide});
        const dO = isNorth ? -125 : 125;
        const nB = new THREE.Mesh(netGeoBack, nMat); nB.position.set(0, 175, dO*2);
        const nT = new THREE.Mesh(netGeoTop, nMat); nT.rotation.x = Math.PI/2; nT.position.set(0, 350, dO);
        const nSL = new THREE.Mesh(netGeoSide, nMat); nSL.rotation.y = Math.PI/2; nSL.position.set(-400, 175, dO);
        const nSR = new THREE.Mesh(netGeoSide, nMat); nSR.rotation.y = Math.PI/2; nSR.position.set(400, 175, dO);
        g.add(pL, pR, cb, nB, nT, nSL, nSR); scene.add(g);
    }
    buildRealGoal(true); buildRealGoal(false);

    // Atmosphere
    const areaMat = new THREE.MeshBasicMaterial({color: colors.lines, transparent: true, opacity: 0.2});
    const areaL = new THREE.Mesh(new THREE.PlaneGeometry(1500, 800), areaMat); areaL.rotation.x = -Math.PI/2; areaL.position.set(-5500, 5, 0); scene.add(areaL);
    const areaR = new THREE.Mesh(new THREE.PlaneGeometry(1500, 800), areaMat); areaR.rotation.x = -Math.PI/2; areaR.position.set(5500, 5, 0); scene.add(areaR);

    function createBench(x, isLocal) {
        const bG = new THREE.Group();
        const teamColor = isLocal ? state.localTeam.color : state.awayTeam.color;
        const bMat = new THREE.MeshPhongMaterial({ color: teamColor });
        const bFloor = new THREE.Mesh(new THREE.BoxGeometry(400, 10, 1400), bMat); bFloor.position.y = 5;
        const bBack = new THREE.Mesh(new THREE.BoxGeometry(100, 450, 1400), bMat); bBack.position.set(x > 0 ? 150 : -150, 225, 0);
        const bRoof = new THREE.Mesh(new THREE.BoxGeometry(500, 20, 1400), bMat); bRoof.position.set(0, 450, 0);
        bG.add(bFloor, bBack, bRoof);
        const cMat = new THREE.MeshPhongMaterial({color: colors.chair});
        for(let i=0; i<6; i++) {
            const zOff = -500 + i*200;
            const sBase = new THREE.Mesh(new THREE.BoxGeometry(120, 50, 120), cMat); sBase.position.set(x > 0 ? 80 : -80, 35, zOff);
            const sBack = new THREE.Mesh(new THREE.BoxGeometry(20, 150, 120), cMat); sBack.position.set(x > 0 ? 130 : -130, 110, zOff);
            bG.add(sBase, sBack);
            const p = createPlayerMesh(x < 0, 'MID').mesh;
            p.position.set(x > 0 ? 80 : -80, 80, zOff); p.rotation.x = -Math.PI/2 * 0.4; p.scale.set(0.9, 0.9, 0.9);
            bG.add(p);
        }
        bG.position.set(x, 0, 0); scene.add(bG);
    }
    createBench(-5800, true); createBench(5800, false);

    // --- GRADAS Y AFICIONADOS (PHASE 36 REFINED) ---
    if (theme === 'monumental') {
        function buildSection(x, z, w, d, rotY, count) {
            // Rigid Base for the whole section
            const baseGeo = new THREE.BoxGeometry(w, 20, d + 1500);
            const base = new THREE.Mesh(baseGeo, new THREE.MeshPhongMaterial({color: 0x1f2937}));
            base.position.set(x, 10, z);
            if(rotY) base.rotation.y = rotY;
            // Shift base outwards so it's behind the starting point
            const baseShift = 750;
            base.position.x += Math.sin(rotY || 0) * baseShift;
            base.position.z += Math.cos(rotY || 0) * baseShift;
            scene.add(base);

            const steps = 4; // More steps
            for(let s=0; s<steps; s++) {
                const sH = 300 + s*500;
                const sY = sH/2;
                const sZ = s*600;
                const step = new THREE.Mesh(new THREE.BoxGeometry(w, sH, 550), new THREE.MeshPhongMaterial({color: colors.walls}));
                const g = new THREE.Group();
                g.position.set(x, sY, z);
                if(rotY) g.rotation.y = rotY;
                g.position.x += Math.sin(rotY || 0) * sZ;
                g.position.z += Math.cos(rotY || 0) * sZ;
                scene.add(step);
                step.position.copy(g.position);
                step.rotation.copy(g.rotation);

                // Add Fans
                for(let f=0; f<count; f++) {
                    const fX = (Math.random()-0.5) * (w - 100);
                    const fanColors = [0xef4444, 0x3b82f6, 0xffffff, 0xfacc15, 0x10b981];
                    const fCol = fanColors[Math.floor(Math.random()*fanColors.length)];
                    const fan = {
                        mesh: new THREE.Group(),
                        celebrating: false, celebrateTimer: 0,
                        baseY: sH/2 + 40
                    };
                    const body = new THREE.Mesh(new THREE.BoxGeometry(35, 55, 35), new THREE.MeshPhongMaterial({color: fCol}));
                    const head = new THREE.Mesh(new THREE.SphereGeometry(14), new THREE.MeshPhongMaterial({color: 0xffdbac}));
                    head.position.y = 40; fan.mesh.add(body, head);
                    fan.mesh.position.set(fX, fan.baseY, 0);
                    step.add(fan.mesh);
                    state.fans.push(fan);
                }
            }
        }
        // Lateral West (Behind benches at -5800)
        buildSection(-8800, 0, 24000, 500, -Math.PI/2, 80);
        // Lateral East (Behind benches at 5800)
        buildSection(8800, 0, 24000, 500, Math.PI/2, 80);
        // North
        buildSection(0, -10800, 20000, 500, Math.PI, 100);
        // South
        buildSection(0, 10800, 20000, 500, 0, 100);
    }

    state.coaches = [
        { mesh: createPlayerMesh(true, 'GK').mesh, tx: -5500, tz: 0, x: -5500, z: 0, area: {minX: -6000, maxX: -5000, minZ: -800, maxZ: 800}},
        { mesh: createPlayerMesh(false, 'GK').mesh, tx: 5500, tz: 0, x: 5500, z: 0, area: {minX: 5000, maxX: 6000, minZ: -800, maxZ: 800}}
    ];
    state.coaches.forEach(c => { c.mesh.scale.set(1.3, 1.3, 1.3); scene.add(c.mesh); });
}

const ballCvs = document.createElement('canvas'); ballCvs.width=512; ballCvs.height=512; 
const bCtx = ballCvs.getContext('2d');
bCtx.fillStyle='white'; bCtx.fillRect(0,0,512,512);
bCtx.fillStyle='black';
bCtx.beginPath(); bCtx.arc(256, 256, 120, 0, Math.PI*2); bCtx.fill();
bCtx.beginPath(); bCtx.arc(50, 100, 80, 0, Math.PI*2); bCtx.fill();
bCtx.beginPath(); bCtx.arc(450, 100, 80, 0, Math.PI*2); bCtx.fill();
bCtx.beginPath(); bCtx.arc(100, 450, 80, 0, Math.PI*2); bCtx.fill();
bCtx.beginPath(); bCtx.arc(450, 400, 80, 0, Math.PI*2); bCtx.fill();

const ballTex = new THREE.CanvasTexture(ballCvs);
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(30, 32, 32), new THREE.MeshPhongMaterial({map: ballTex}));
ballMesh.castShadow = true; ballMesh.receiveShadow = true;
scene.add(ballMesh);
state.ball.mesh = ballMesh;

// ── Foul Marker (Triangle) ──────────────────────────────────────────────────
const markerGeo = new THREE.ConeGeometry(40, 80, 3); // 3 sides = triangle
const markerMat = new THREE.MeshPhongMaterial({ color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 0.5 });
const foulMarker = new THREE.Mesh(markerGeo, markerMat);
foulMarker.rotation.x = Math.PI; // Point down
foulMarker.visible = false;
scene.add(foulMarker);
state.foulMarker = foulMarker;
state.foulMarkerTimer = 0;

// ── Skin tones palette ──────────────────────────────────────────────────────
const SKIN_TONES = [0xffd5b0, 0xf0c27f, 0xc68642, 0x8d5524, 0xffcba4];

function createPlayerMesh(isLocal, role, playerIndex, isCaptain) {
    const group = new THREE.Group();

    // Randomize skin tone based on player index for variety
    const skinIdx = playerIndex !== undefined ? (playerIndex * 3 + (isLocal ? 0 : 2)) % SKIN_TONES.length : Math.floor(Math.random() * SKIN_TONES.length);
    const skinColor = SKIN_TONES[skinIdx];
    const headMat = new THREE.MeshStandardMaterial({color: skinColor, roughness: 0.7});
    const head = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 16), headMat);
    head.position.y = 120;

    // Hair
    const hairColors = [0x1a0a00, 0x4b2e0a, 0xd4a044, 0xb93a1e, 0xf5f5f5];
    const hairColor = hairColors[(playerIndex || 0) % hairColors.length];
    const hairMat = new THREE.MeshStandardMaterial({color: hairColor, roughness: 0.9});
    const hair = new THREE.Mesh(new THREE.SphereGeometry(21, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
    hair.position.y = 127;
    group.add(hair);

    // Dynamic Team Colors
    const team = isLocal ? state.localTeam : state.awayTeam;
    const shirtColorHex = typeof team.color === 'string' ? parseInt(team.color.replace('#',''), 16) : team.color;
    const finalShirtColor = role === 'GK' ? (isLocal ? 0x10b981 : 0xfacc15) : shirtColorHex;

    // Torso / Jersey (High Quality Material)
    const torso = new THREE.Mesh(
        new THREE.BoxGeometry(40, 50, 25),
        new THREE.MeshStandardMaterial({color: finalShirtColor, roughness: 0.5, metalness: 0.1})
    );
    torso.position.y = 80;

    // GK — green gloves
    if (role === 'GK') {
        const gloveGeo = new THREE.BoxGeometry(10, 14, 12);
        const gloveMat = new THREE.MeshStandardMaterial({color: 0x22c55e, roughness: 0.4});
        const gloveL = new THREE.Mesh(gloveGeo, gloveMat); gloveL.position.set(-28, 85, 0);
        const gloveR = new THREE.Mesh(gloveGeo, gloveMat); gloveR.position.set(28, 85, 0);
        group.add(gloveL, gloveR);
    }

    // Shorts
    const shortsColor = role === 'GK' ? 0x111111 : 0x1e293b;
    const shorts = new THREE.Mesh(
        new THREE.BoxGeometry(42, 22, 27),
        new THREE.MeshStandardMaterial({color: shortsColor, roughness: 0.6})
    );
    shorts.position.y = 58;
    group.add(shorts);

    // Legs
    const legGeo = new THREE.CylinderGeometry(8, 8, 55);
    legGeo.translate(0, -27.5, 0);
    const sockColor = role === 'GK' ? 0x111111 : 0xffffff;
    const legMat = new THREE.MeshStandardMaterial({color: sockColor, roughness: 0.8});
    const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-10, 55, 0);
    const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(10, 55, 0);

    // Boots
    const bootMat = new THREE.MeshStandardMaterial({color: 0x111111, roughness: 0.3, metalness: 0.5});
    const bootGeo = new THREE.BoxGeometry(14, 10, 18);
    const bootL = new THREE.Mesh(bootGeo, bootMat); bootL.position.set(-10, 5, 5);
    const bootR = new THREE.Mesh(bootGeo, bootMat); bootR.position.set(10, 5, 5);
    group.add(bootL, bootR);

    // Captain armband
    if (isCaptain) {
        const bandMat = new THREE.MeshStandardMaterial({color: 0xfacc15, roughness: 0.5});
        const band = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 10, 12), bandMat);
        band.rotation.z = Math.PI / 2;
        band.position.set(-28, 90, 0);
        group.add(band);
    }

    group.add(head, torso, legL, legR);
    group.children.forEach(c => { c.castShadow = true; c.receiveShadow = true; });
    return { mesh: group, legL: legL, legR: legR };
}

function initPlayers(mode) {
    state.currentMode = mode;
    state.players.forEach(p => scene.remove(p.mesh));
    state.players = [];
    
    let localTactics = [];
    if(mode === '8v8') {
        localTactics = [
            {hx: 0, hz: -4800, role: 'GK'}, 
            {hx: 0, hz: -3000, role: 'DEF'}, {hx: -1500, hz: -2500, role: 'DEF'}, {hx: 1500, hz: -2500, role: 'DEF'},
            {hx: -2000, hz: -1500, role: 'MID'}, {hx: 2000, hz: -1500, role: 'MID'}, {hx: 0, hz: -1000, role: 'MID'},
            {hx: 0, hz: -100, role: 'ATK'}
        ];
    } else {
        localTactics = [
            {hx: 0, hz: -4800, role: 'GK'}, 
            {hx: -1000, hz: -3500, role: 'DEF'}, {hx: 1000, hz: -3500, role: 'DEF'}, 
            {hx: -2800, hz: -3000, role: 'DEF'}, {hx: 2800, hz: -3000, role: 'DEF'},
            {hx: 0, hz: -2000, role: 'MID'}, {hx: -1800, hz: -1500, role: 'MID'}, {hx: 1800, hz: -1500, role: 'MID'},
            {hx: 0, hz: -200, role: 'ATK'}, 
            {hx: -2500, hz: -600, role: 'ATK'}, {hx: 2500, hz: -600, role: 'ATK'}
        ];
    }

    const visitTactics = localTactics.map(t => ({hx: t.hx, hz: Math.abs(t.hz), role: t.role}));
    
    // ── Skills by role ────────────────────────────────────────────────────────
    const ROLE_SKILLS = {
        GK:  { speed: 0.65, dribbling: 0.35, tackling: 0.80, aggression: 0.20, stamina: 1.0 },
        DEF: { speed: 0.75, dribbling: 0.45, tackling: 0.82, aggression: 0.58, stamina: 1.0 },
        MID: { speed: 0.85, dribbling: 0.72, tackling: 0.65, aggression: 0.42, stamina: 1.0 },
        ATK: { speed: 0.98, dribbling: 0.88, tackling: 0.35, aggression: 0.38, stamina: 1.0 }
    };

    const setupTeam = (tactics, isLocal) => {
        const teamData = isLocal ? state.localTeam : state.awayTeam;
        tactics.forEach((t, i) => {
            const isCaptain = (i === 1); // second player is captain (skip GK)
            const pMesh = createPlayerMesh(isLocal, t.role, i, isCaptain);
            const rosterPlayer = teamData.players ? (teamData.players[i] || teamData.players[0]) : null;

            // Height variety per role and index
            const heightScale = t.role === 'GK' ? 1.07 :
                                t.role === 'DEF' ? 1.05 + (i % 3) * 0.03 :
                                t.role === 'ATK' ? 1.02 + (i % 2) * 0.05 :
                                0.92 + (i % 4) * 0.06;
            pMesh.mesh.scale.set(1, heightScale, 1);

            // Base skills from role + small random variation
            const baseSkills = ROLE_SKILLS[t.role];
            const skills = {
                speed:      Math.min(1, baseSkills.speed      + (Math.random() - 0.5) * 0.14),
                dribbling:  Math.min(1, baseSkills.dribbling  + (Math.random() - 0.5) * 0.18),
                tackling:   Math.min(1, baseSkills.tackling   + (Math.random() - 0.5) * 0.18),
                aggression: Math.min(1, baseSkills.aggression + (Math.random() - 0.5) * 0.22),
                stamina: 1.0
            };

            const pObj = {
                mesh: pMesh.mesh,
                legL: pMesh.legL,
                legR: pMesh.legR,
                team: teamData.name,
                role: t.role,
                name: rosterPlayer ? rosterPlayer.name : `Jugador ${i+1}`,
                age:  rosterPlayer ? rosterPlayer.age  : 20 + Math.floor(Math.random()*15),
                dorsal: rosterPlayer ? rosterPlayer.dorsal : (i + 1),
                hx: t.hx, hz: t.hz,
                x: t.hx, z: t.hz,
                // Physics: velocity components
                vx: 0, vz: 0,
                hasBall: false, fallen: false, sliding: false, immune: 0,
                yellowCards: 0,
                skills: skills,
                isCaptain: isCaptain
            };

            // Dynamic Dorsal Label
            const canvas = document.createElement('canvas'); canvas.width=64; canvas.height=64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = teamData.textColor || 'white';
            ctx.font = 'bold 48px Inter'; ctx.textAlign = 'center';
            ctx.fillText(pObj.dorsal, 32, 48);
            const tex = new THREE.CanvasTexture(canvas);
            const label = new THREE.Mesh(new THREE.PlaneGeometry(25, 25), new THREE.MeshBasicMaterial({map: tex, transparent: true}));
            label.position.set(0, 85 / heightScale, isLocal ? -13 : 13);
            if(!isLocal) label.rotation.y = Math.PI;
            pMesh.mesh.add(label);

            state.players.push(pObj);
            scene.add(pObj.mesh);
        });
    };

    setupTeam(localTactics, true);
    setupTeam(visitTactics, false);
}

function startMatchTimer() {
    if(state.timerInterval) clearInterval(state.timerInterval);
    
    const selectElement = document.getElementById('time-select');
    const realMinutesStr = selectElement ? selectElement.value : "2";
    let realMinutes = parseInt(realMinutesStr);
    if(isNaN(realMinutes)) realMinutes = 2;

    const realSecondsTotal = realMinutes * 60;
    state.timeRemaining = realSecondsTotal; 
    
    const totalGameSecs = 90 * 60; 
    const msPerGameSec = (realSecondsTotal * 1000) / totalGameSecs;

    let lastTime = Date.now();
    state.timerInterval = setInterval(() => {
        if(!state.paused) {
            const now = Date.now();
            const deltaMs = now - lastTime;
            lastTime = now;
            
            state.timeRemaining -= (deltaMs / 1000); 
            state.currentGameSeconds++; 
            
            let mins = Math.floor(state.currentGameSeconds / 60);
            let secs = Math.floor(state.currentGameSeconds % 60);
            
            if(state.currentGameSeconds >= 5400) { mins = 90; secs = 0; }
            
            let sM = mins.toString().padStart(2, '0');
            let sS = secs.toString().padStart(2, '0');
            
            const timerEl = document.getElementById('match-timer');
            if(timerEl) timerEl.innerText = `${sM}:${sS}`;
            
            if(state.timeRemaining <= 0 || state.currentGameSeconds >= 5400) { 
                endGame("¡Tiempo Reglamentario Cumplido (90')!"); 
                clearInterval(state.timerInterval);
            }
        } else {
            lastTime = Date.now(); 
        }
    }, msPerGameSec);
}

document.addEventListener('keydown', e => { if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', e => { if(state.keys.hasOwnProperty(e.key.toLowerCase())) state.keys[e.key.toLowerCase()] = false; });

const startMatch = () => {
    DOM.startOverlay.style.display = 'none';
    document.body.requestPointerLock();
    const stadiumTheme = document.getElementById('stadium-select')?.value || 'azul';
    buildStadium(stadiumTheme);
    initPlayers(state.currentMode); 
    startMatchTimer();
    state.paused = false;
    requestAnimationFrame(updateEngine);
}

// Initializing Teams from DB (Phase 37)
SoccerDB.initDB().then(async () => {
    await SoccerDB.populateDefaultTeams();
    const teams = await SoccerDB.getAllTeams();
    const localSelect = document.getElementById('local-team-select');
    const awaySelect = document.getElementById('away-team-select');
    
    if (localSelect && awaySelect) {
        teams.forEach((t, index) => {
            const opt1 = document.createElement('option');
            opt1.value = t.id; opt1.innerText = t.name;
            localSelect.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = t.id; opt2.innerText = t.name;
            awaySelect.appendChild(opt2);
        });
        // Defaults
        localSelect.value = 'madrid';
        awaySelect.value = 'barca';
    }
});

document.getElementById('btn-enter-8').onclick = async () => {
    state.currentMode = '8v8';
    await applySelectedTeams();
    startMatch();
};
document.getElementById('btn-enter-11').onclick = async () => {
    state.currentMode = '11v11';
    await applySelectedTeams();
    startMatch();
};

async function applySelectedTeams() {
    const localId = document.getElementById('local-team-select').value;
    const awayId = document.getElementById('away-team-select').value;
    state.localTeam = await SoccerDB.getTeamById(localId);
    state.awayTeam = await SoccerDB.getTeamById(awayId);

    // Update HUD
    const localLabel = document.querySelector('.score-team.local');
    const awayLabel = document.querySelector('.score-team.visitante');
    if(localLabel) {
        localLabel.innerText = state.localTeam.name.toUpperCase().substring(0,4);
        localLabel.style.background = state.localTeam.color;
    }
    if(awayLabel) {
        awayLabel.innerText = state.awayTeam.name.toUpperCase().substring(0,4);
        awayLabel.style.background = state.awayTeam.color;
    }
}

const btnWhistle = document.getElementById('btn-whistle');
if(btnWhistle) {
    btnWhistle.addEventListener('click', () => {
        state.freeKickPending = false;
        btnWhistle.style.display = 'none';
        DOM.hud.style.pointerEvents = 'none';
        document.body.requestPointerLock();
        
        if (state.currentKicker) {
            const k = state.currentKicker;
            const isLocal = k.team.includes('Azul');
            const tgtZ = isLocal ? 5000 : -5000;
            const kickAngle = Math.atan2(tgtZ - state.ball.z, 0 - state.ball.x);
            
            // SHOOT INSTANTLY 
            state.ball.vx = Math.cos(kickAngle) * 95 + (Math.random() - 0.5) * 15;
            state.ball.vz = Math.sin(kickAngle) * 95;
            state.ball.vy = 26 + Math.random() * 20; 
            state.ball.curve = (Math.random() - 0.5) * 2.8; 
            
            // Animation kicker kick loop visual
            k.legR.rotation.x = -Math.PI / 2.0; 
            setTimeout(() => { if(k && k.legR) k.legR.rotation.x = 0; }, 300);
            
            state.currentKicker = null;
        }
        
        state.paused = false;
    });
}

document.addEventListener('click', (e) => {
    if(e.target === btnWhistle) return;
    if (state.paused) return; 
    if (document.pointerLockElement !== document.body && DOM.startOverlay.style.display === 'none') {
        document.body.requestPointerLock();
    } else {
        hitTestFoul();
    }
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === document.body && !state.paused) {
        const mx = e.movementX || 0;
        const my = e.movementY || 0;
        camera.rotation.y -= mx * 0.002;
        camera.rotation.x -= my * 0.002;
        camera.rotation.x = Math.max( -Math.PI / 2.2, Math.min( Math.PI / 2.2, camera.rotation.x ) );
    }
});

const raycaster = new THREE.Raycaster();
function hitTestFoul() {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const meshes = [];
    state.players.forEach(p => meshes.push(p.mesh));
    // Intersection MUST be recursive to hit all parts (recursive: true)
    const intersects = raycaster.intersectObjects(meshes, true);
    if(intersects.length > 0) {
        let currentHit = intersects[0].object;
        // Search up the tree to find which player group this part belongs to
        let foundPlayer = null;
        while(currentHit.parent) {
            foundPlayer = state.players.find(p => p.mesh === currentHit);
            if(foundPlayer) break;
            currentHit = currentHit.parent;
        }
        if(foundPlayer) pauseFoul(foundPlayer);
    }
}

function pauseFoul(player) {
    state.paused = true;
    document.exitPointerLock(); 
    state.selectedPlayer = player;
    
    // Check for Penalty Area (Phase 35)
    // Area North: x[-1200,1200], z[-5050,-4000]
    // Area South: x[-1200,1200], z[4000,5050]
    const isInNorthBox = Math.abs(player.x) < 1200 && player.z < -4000;
    const isInSouthBox = Math.abs(player.x) < 1200 && player.z > 4000;
    
    // Penalty if foul on attacker inside defender's box
    // Local defends NORTH (z<0), Away defends SOUTH (z>0)
    const victimIsLocal = player.team === state.localTeam.name;
    const isPenalty = (victimIsLocal && isInSouthBox) || (!victimIsLocal && isInNorthBox);
    state.foulIsPenalty = isPenalty;

    const modalTitle = document.querySelector('#foul-modal h2');
    if(modalTitle) modalTitle.innerText = isPenalty ? "🚨 ¡PENALTI! 🚨" : "🚨 INFRACCIÓN TRAS CHOQUE 🚨";

    DOM.foulModal.style.display = 'block';
    DOM.hud.style.pointerEvents = 'auto'; 
    DOM.playerInfo.innerHTML = `Notificando decisión sobre <b>${player.name}</b> (#${player.dorsal}, ${player.age} años) del <b style="font-size:1.5rem; color: #34d399">${player.team}</b>`;
}

window.handleDecision = function(type) {
    if(type === 'red' || type === 'yellow' || type === 'foul') {
        // If it's a penalty, we skip standard free kick logic and go to triggerPenalty
        if(state.foulIsPenalty) {
           DOM.foulModal.style.display = 'none';
           // Victim is local → local attacks south → penalty at SOUTH goal (isNorthGoal=false)
           // Victim is away → away attacks north → penalty at NORTH goal (isNorthGoal=true)
           const isNorthGoal = state.selectedPlayer.team === state.awayTeam.name;
           triggerPenalty(isNorthGoal);
           return;
        }

        state.stats.fouls++;
        state.respect += 10; 
        if(state.respect > 100) state.respect = 100;
        
        state.ball.x = state.selectedPlayer.x;
        state.ball.y = 30;
        state.ball.z = state.selectedPlayer.z;
        state.ball.vx = 0; state.ball.vy = 0; state.ball.vz = 0; state.ball.curve = 0;
        if(state.ball.owner) { state.ball.owner.hasBall = false; state.ball.owner = null; }

        if (type === 'yellow') {
            state.stats.yellow++;
            state.selectedPlayer.yellowCards = (state.selectedPlayer.yellowCards || 0) + 1;
            
            const cardMesh = new THREE.Mesh(new THREE.BoxGeometry(16, 22, 3), new THREE.MeshBasicMaterial({color: 0xfacc15}));
            cardMesh.position.set(state.selectedPlayer.yellowCards === 1 ? -12 : 12, 165, 0); 
            state.selectedPlayer.mesh.add(cardMesh);

            if (state.selectedPlayer.yellowCards >= 2) {
                type = 'red'; 
            }
        }

        const isLocalFoul = state.selectedPlayer.team === state.localTeam.name;
        const rivalTeamName = isLocalFoul ? state.awayTeam.name : state.localTeam.name;
        const rivals = state.players.filter(p => p.team === rivalTeamName && p.role !== 'GK');
        
        let kicker = rivals[0]; let bestD = Infinity;
        rivals.forEach(r => {
            const d = Math.hypot(r.x - state.ball.x, r.z - state.ball.z);
            if(d < bestD) { bestD = d; kicker = r; }
        });

        if (!kicker) { DOM.foulModal.style.display = 'none'; state.paused = false; document.body.requestPointerLock(); return; }

        const isKickerLocal = kicker.team === state.localTeam.name;
        const tzMatch = isKickerLocal ? 5000 : -5000;
        const angToGoal = Math.atan2(tzMatch - state.ball.z, 0 - state.ball.x);
        
        // Posesionar exactamente listo para patear (de pie)
        kicker.x = state.ball.x - Math.cos(angToGoal)*35;
        kicker.z = state.ball.z - Math.sin(angToGoal)*35;
        
        // REINICIO FORZADO: Evita rotación extraña si venia caído 
        kicker.fallen = false; kicker.sliding = false;
        kicker.mesh.rotation.x = 0; kicker.mesh.position.y = 0; 
        kicker.mesh.position.x = kicker.x;
        kicker.mesh.position.z = kicker.z;
        kicker.mesh.rotation.y = -angToGoal - Math.PI/2;
        kicker.legL.rotation.x = 0; kicker.legR.rotation.x = 0;
        
        state.currentKicker = kicker; 

        state.players.forEach(p => {
             if (p !== kicker && p.role !== 'GK' && p !== state.selectedPlayer) {
                 const d = Math.hypot(p.x - state.ball.x, p.z - state.ball.z);
                 const isDefender = p.team !== kicker.team;
                 // Distancia a 450 muro, 250 companeros
                 const distanceReq = isDefender ? 450 : 250; 
                 
                 // Universal fix, levantar a TODO el mundo
                 p.fallen = false; p.sliding = false;
                 p.mesh.rotation.x = 0; 
                 p.mesh.position.y = 0;
                 p.legL.rotation.x = 0; p.legR.rotation.x = 0;

                 if (d < distanceReq) {
                     const a = Math.atan2(p.z - state.ball.z, p.x - state.ball.x);
                     p.hx = state.ball.x + Math.cos(a)*distanceReq;
                     p.hz = state.ball.z + Math.sin(a)*distanceReq;
                     p.x = p.hx; p.z = p.hz;
                     p.mesh.position.x = p.x; p.mesh.position.z = p.z; 
                 }
             }
        });

        if(type === 'red') {
            const expelled = state.selectedPlayer;
            const redCard = new THREE.Mesh(new THREE.BoxGeometry(16, 22, 4), new THREE.MeshBasicMaterial({color: 0xef4444}));
            redCard.position.set(0, 190, 0);
            expelled.mesh.add(redCard);
            
            setTimeout(() => {
                scene.remove(expelled.mesh);
                if(expelled.mesh.geometry) expelled.mesh.geometry.dispose();
            }, 3000); 
            
            state.players = state.players.filter(p => p !== expelled);
        }

    } else {
        state.respect -= 15; 
    }
    
    DOM.respectFill.style.width = Math.max(0, Math.min(100, state.respect)) + '%';
    DOM.respectValue.innerText = state.respect + '%';
    DOM.respectFill.style.background = state.respect < 40 ? '#ef4444' : '#10b981';

    if(state.respect <= 0) { endGame("¡Perdiste Autoridad!"); return; }
    
    state.selectedPlayer = null; 
    DOM.foulModal.style.display = 'none'; 
    
    if (type === 'red' || type === 'yellow' || type === 'foul') {
        state.freeKickPending = true;
        if(btnWhistle) btnWhistle.style.display = 'block';
        DOM.hud.style.pointerEvents = 'auto';
    } else {
        DOM.hud.style.pointerEvents = 'none';
        document.body.requestPointerLock(); 
        state.paused = false;
    }
};

function triggerGoal(scoringTeam) {
    if(state.paused) return; 
    
    // FIFA RULE: No goal directly from throw-in
    if(state.ball.throwInTeam) {
        const enteringNorth = scoringTeam === 'visitante';
        const throwerIsLocal = state.ball.throwInTeam === state.localTeam.name;
        state.ball.throwInTeam = null;
        // DO NOT set paused here — triggerCorner/triggerGoalKick handle their own pausing
        if(enteringNorth) {
            if(throwerIsLocal) triggerCorner(true);
            else triggerGoalKick(true);
        } else {
            if(!throwerIsLocal) triggerCorner(false);
            else triggerGoalKick(false);
        }
        return;
    }

    state.paused = true; document.exitPointerLock();
    state.stats.goals++;
    
    if (scoringTeam === 'local') state.scoreLocal++;
    if (scoringTeam === 'visitante') state.scoreVisitante++;
    
    document.getElementById('score-val').innerText = `${state.scoreLocal} - ${state.scoreVisitante}`;
    
    const uiBox = document.getElementById('goal-alert-box');
    const uiText = document.getElementById('goal-alert-text');
    if(uiBox && uiText) {
        uiText.innerText = "¡GOLAZO!";
        uiBox.style.background = "rgba(16, 185, 129, 0.9)";
        document.getElementById('goal-alert').style.display = 'flex';
    }

    setTimeout(() => {
        state.ball = { x: 0, y: 30, z: 0, vx: 0, vy: 0, vz: 0, curve: 0, owner: null, mesh: state.ball.mesh, throwInTeam: null };
        state.ball.mesh.position.set(0,30,0);
        state.x = 0; state.z = 2000; camera.rotation.set(0,0,0);
        
        state.players.forEach(p => { p.fallen = false; p.sliding = false; p.hasBall = false; p.x = p.hx; p.z = p.hz; });
        document.getElementById('goal-alert').style.display = 'none';
        
        // --- FAN CELEBRATION (PHASE 36) ---
        state.fans.forEach(f => {
            f.celebrating = true;
            f.celebrateTimer = Date.now() + 5000;
        });

        if(state.timeRemaining > 0 && state.respect > 0 && !state.freeKickPending) { document.body.requestPointerLock(); state.paused = false; }
    }, 4000);
}

function triggerGoalKick(isNorthOut) {
    if(state.paused) return; 
    state.paused = true; document.exitPointerLock();
    
    const uiBox = document.getElementById('goal-alert-box');
    const uiText = document.getElementById('goal-alert-text');
    if(uiBox && uiText) {
        uiText.innerText = "¡SAQUE DE PUERTA!";
        uiBox.style.background = "rgba(30, 41, 59, 0.9)";
        document.getElementById('goal-alert').style.display = 'flex';
    }

    setTimeout(() => {
        state.ball.vx = 0; state.ball.vz = 0; state.ball.vy = 0; state.ball.curve = 0;
        state.ball.y = 80;
        
        // North goal is defended by localTeam (isNorthOut means ball went past north goal)
        const targetTeam = isNorthOut ? state.localTeam.name : state.awayTeam.name;
        const gk = state.players.find(p => p.role === 'GK' && p.team === targetTeam);
        
        if (gk) {
            gk.hasBall = true; state.ball.owner = gk;
            state.ball.x = gk.x; state.ball.z = gk.z;

            setTimeout(() => {
                if(gk.hasBall && state.ball.owner === gk && !state.freeKickPending) {
                    gk.hasBall = false; state.ball.owner = null;
                    gk.immune = Date.now() + 5000; // Prevent immediate re-pickup after goal kick
                    const isLocal = gk.team === state.localTeam.name;
                    const targetGoalZ = isLocal ? 5000 : -5000;
                    const kickAngle = Math.atan2(targetGoalZ - gk.z, 0 - gk.x);
                    state.ball.vx = Math.cos(kickAngle) * 98 + (Math.random() - 0.5) * 20;
                    state.ball.vz = Math.sin(kickAngle) * 98;
                    state.ball.vy = 35 + Math.random() * 20; 
                    state.ball.curve = (Math.random() - 0.5) * 1.5;
                }
            }, 3000 + Math.random() * 2000);
        }
        
        state.players.forEach(p => { 
            p.fallen = false; p.sliding = false; 
            if(p !== gk) { p.hasBall = false; p.x = p.hx; p.z = p.hz; }
        });
        
        state.freeKickPending = false; // Clear any lingering free kick state before resume
        document.getElementById('goal-alert').style.display = 'none';
        
        if(state.timeRemaining > 0 && state.respect > 0) { 
            document.body.requestPointerLock(); state.paused = false; 
        }
    }, 2500);
}

function triggerPenalty(isNorthGoal) {
    const uiBox = document.getElementById('goal-alert');
    const uiText = document.getElementById('goal-alert-text');
    if(uiBox && uiText) {
        uiText.innerText = "¡PENALTI!";
        uiBox.style.background = "rgba(239, 68, 68, 0.9)";
        document.getElementById('goal-alert').style.display = 'flex';
    }

    setTimeout(() => {
        document.getElementById('goal-alert').style.display = 'none';
        state.ball.vx = 0; state.ball.vz = 0; state.ball.vy = 0; state.ball.curve = 0;
        state.ball.y = 30;
        
        const spotZ = isNorthGoal ? -3900 : 3900;
        state.ball.x = 0;
        state.ball.z = spotZ;
        state.ball.mesh.position.set(0, 30, spotZ);

        // isNorthGoal=true → away team attacks north (z=-5000) → award penalty to away
        const attackingTeamName = isNorthGoal ? state.awayTeam.name : state.localTeam.name;
        const attackers = state.players.filter(p => p.team === attackingTeamName && p.role !== 'GK');
        const kicker = attackers[0];

        kicker.x = 0; kicker.z = isNorthGoal ? -3600 : 3600;
        kicker.fallen = false; kicker.mesh.position.set(kicker.x, 0, kicker.z);
        kicker.mesh.rotation.y = isNorthGoal ? Math.PI : 0;

        state.currentKicker = kicker;
        state.freeKickPending = true;
        const btnWhistle = document.getElementById('btn-whistle');
        if(btnWhistle) btnWhistle.style.display = 'block';
        DOM.hud.style.pointerEvents = 'auto';

        state.players.forEach(p => {
            if(p !== kicker) {
                p.fallen = false; p.mesh.rotation.x = 0; p.mesh.position.y = 0;
                if(p.role === 'GK') {
                    p.x = 0; p.z = isNorthGoal ? -4985 : 4985;
                    p.mesh.rotation.y = isNorthGoal ? 0 : Math.PI;
                } else {
                    p.x = (Math.random() - 0.5) * 4000;
                    p.z = isNorthGoal ? -1000 : 1000; 
                }
                p.mesh.position.set(p.x, 0, p.z);
            }
        });
        
        state.x = 0; state.z = isNorthGoal ? -2500 : 2500;
        camera.rotation.set(0, isNorthGoal ? Math.PI : 0, 0);
    }, 2000);
}

function triggerCorner(isNorthOut) {
    if(state.paused) return; 
    state.paused = true; document.exitPointerLock();
    
    const uiBox = document.getElementById('goal-alert-box');
    const uiText = document.getElementById('goal-alert-text');
    if(uiBox && uiText) {
        uiText.innerText = "¡CÓRNER!";
        uiBox.style.background = "rgba(245, 158, 11, 0.9)"; // Orange corner style
        document.getElementById('goal-alert').style.display = 'flex';
    }

    setTimeout(() => {
        state.ball.vx = 0; state.ball.vz = 0; state.ball.vy = 0; state.ball.curve = 0;
        state.ball.y = 30;
        
        const zPos = isNorthOut ? -4980 : 4980; // Slightly inside 5050
        const xPos = state.ball.x > 0 ? 3980 : -3980; // Slightly inside 4050
        state.ball.x = xPos;
        state.ball.z = zPos;
        state.ball.mesh.position.set(xPos, 30, zPos);

        // isNorthOut=true: local goal, away team attacks. isNorthOut=false: away goal, local attacks
        const attackingTeamName = isNorthOut ? state.awayTeam.name : state.localTeam.name;
        const attackers = state.players.filter(p => p.team === attackingTeamName && p.role !== 'GK');
        
        let kicker = attackers[0]; let bestD = Infinity;
        attackers.forEach(a => {
            const d = Math.hypot(a.x - xPos, a.z - zPos);
            if(d < bestD) { bestD = d; kicker = a; }
        });

        // Kicker at the corner point
        kicker.x = xPos; kicker.z = zPos;
        kicker.fallen = false; kicker.sliding = false;
        kicker.mesh.rotation.x = 0; kicker.mesh.position.y = 0;
        kicker.mesh.position.set(xPos, 0, zPos);
        
        const targetGoalZ = isNorthOut ? -5000 : 5000;
        kicker.mesh.rotation.y = -Math.atan2(targetGoalZ - zPos, 0 - xPos) - Math.PI/2;
        
        state.currentKicker = kicker;
        state.freeKickPending = true;
        if(btnWhistle) btnWhistle.style.display = 'block';
        DOM.hud.style.pointerEvents = 'auto';

        // Reposition everyone else near the area
        const isLastMinutes = state.currentGameSeconds > 5100;

        state.players.forEach(p => {
            if(p !== kicker) {
                p.fallen = false; p.sliding = false; p.mesh.rotation.x = 0; p.mesh.position.y = 0;
                
                // FIFA TACTIC: GKs only go up in corners if it's > 85' and they are the attacking team
                if (p.role === 'GK') {
                    const isAttackingGK = p.team === attackingTeamName;
                    if (isAttackingGK && isLastMinutes) {
                        p.x = (Math.random() - 0.5) * 1000;
                        p.z = isNorthOut ? -4200 + Math.random()*500 : 4200 - Math.random()*500;
                    } else {
                        p.x = p.hx; p.z = p.hz; // Stay home
                    }
                } else {
                    // Regular area noise for non-GKs
                    p.x = (Math.random() - 0.5) * 1500;
                    p.z = isNorthOut ? -4200 + Math.random()*1000 : 4200 - Math.random()*1000;
                }
                p.mesh.position.set(p.x, 0, p.z);
            }
        });

        document.getElementById('goal-alert').style.display = 'none';
    }, 2500);
}

// ═══════════════════════════════════════════════════════════════════════════
// VISIBLE FOUL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
const foulFlashEl    = document.getElementById('foul-flash');
const foulFlashTitle = document.getElementById('foul-flash-title');
const foulFlashDesc  = document.getElementById('foul-flash-desc');
const foulFlashIcon  = document.getElementById('foul-flash-icon');
const tackleIndEl    = document.getElementById('tackle-indicator');
const tackleIndText  = document.getElementById('tackle-indicator-text');
const camShakeEl     = document.getElementById('cam-shake-overlay');

let foulFlashTimer = null;
let tackleIndTimer = null;

/**
 * Muestra alerta visual de falta en pantalla.
 * @param {string} type  'hard' | 'soft'
 * @param {string} foulerName  Nombre del que hizo la falta
 * @param {string} victimName  Nombre de la víctima
 */
function showFoulFlash(type, foulerName, victimName) {
    if (!foulFlashEl) return;
    clearTimeout(foulFlashTimer);
    foulFlashEl.className = type === 'hard' ? 'active hard' : 'active';
    foulFlashIcon.innerText   = type === 'hard' ? '🚨' : '⚠️';
    foulFlashTitle.innerText  = type === 'hard' ? '¡FALTA DURA!' : '¡FALTA!';
    foulFlashDesc.innerText   = `${foulerName} sobre ${victimName}`;
    foulFlashTimer = setTimeout(() => { foulFlashEl.className = ''; }, type === 'hard' ? 4000 : 2500);
}

/** Muestra texto sutil en la parte inferior de la pantalla */
function showTackleIndicator(text) {
    if (!tackleIndEl) return;
    clearTimeout(tackleIndTimer);
    tackleIndText.innerText = text;
    tackleIndEl.className = 'active';
    tackleIndTimer = setTimeout(() => { tackleIndEl.className = ''; }, 2000);
}

/** Efecto de viñeta roja (camera shake simulado) */
function triggerCameraShake() {
    if (!camShakeEl) return;
    camShakeEl.className = '';
    // Force reflow
    void camShakeEl.offsetWidth;
    camShakeEl.className = 'active';
    setTimeout(() => { camShakeEl.className = ''; }, 500);
    // Small positional shake on camera
    const origX = state.x, origZ = state.z;
    let shakes = 0;
    const shakeInterval = setInterval(() => {
        state.x = origX + (Math.random() - 0.5) * 60;
        state.z = origZ + (Math.random() - 0.5) * 60;
        shakes++;
        if (shakes >= 6) { clearInterval(shakeInterval); state.x = origX; state.z = origZ; }
    }, 40);
}

function updateEngine() {
    if (!state.paused) {
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        direction.y = 0; direction.normalize();
        const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0,1,0)).normalize();

        if (state.keys.w) { state.x += direction.x * state.speed; state.z += direction.z * state.speed; }
        if (state.keys.s) { state.x -= direction.x * state.speed; state.z -= direction.z * state.speed; }
        if (state.keys.d) { state.x += right.x * state.speed; state.z += right.z * state.speed; }
        if (state.keys.a) { state.x -= right.x * state.speed; state.z -= right.z * state.speed; }
        
        state.x = Math.max(-3900, Math.min(3900, state.x));
        state.z = Math.max(-4900, Math.min(4900, state.z));

        if(state.ball.owner) {
            state.ball.x = state.ball.owner.x;
            let isLoc = state.ball.owner.team.includes('Azul'); 
            state.ball.z = isLoc ? state.ball.owner.z + 70 : state.ball.owner.z - 70;
            state.ball.vx = 0; state.ball.vy = 0; state.ball.vz = 0; state.ball.curve = 0;
            
            if(state.ball.owner.role === 'GK') {
                state.ball.y = 80;
                state.ball.mesh.position.y = 80; 
            } else {
                state.ball.y = 30;
                state.ball.mesh.position.y = 30; 
                state.ball.mesh.rotation.x += 0.2;
            }
        } else {
            // ── REAL BALL PHYSICS ─────────────────────────────────────────────────
            state.ball.x += state.ball.vx;
            state.ball.y += state.ball.vy;
            state.ball.z += state.ball.vz;

            // Air resistance (lower on grass, more in air)
            const onGround = state.ball.y <= 31;
            const friction = onGround ? 0.972 : 0.994;
            state.ball.vx *= friction;
            state.ball.vz *= friction;

            if (state.ball.y > 30) {
                // Gravity — more realistic, heavier
                state.ball.vy -= 2.2;
                if (state.ball.curve) {
                    state.ball.vx += state.ball.curve * 0.9;
                    state.ball.mesh.rotation.y += state.ball.curve * 0.12;
                }
            } else {
                state.ball.y = 30;
                if (state.ball.vy < -6) {
                    state.ball.vy *= -0.48; // Bounce with energy loss
                    // Slow horizontal speed on bounce (grass friction)
                    state.ball.vx *= 0.88;
                    state.ball.vz *= 0.88;
                } else {
                    state.ball.vy = 0;
                    state.ball.curve = 0;
                    // Rolling deceleration on ground
                    state.ball.vx *= 0.960;
                    state.ball.vz *= 0.960;
                }
            }

            const speed3d = Math.hypot(state.ball.vx, state.ball.vz);
            state.ball.mesh.position.y = state.ball.y;
            state.ball.mesh.rotation.x += state.ball.vz * 0.06;
            state.ball.mesh.rotation.z -= state.ball.vx * 0.06;
            // Ball spins faster when moving fast
            state.ball.mesh.rotation.y += speed3d * 0.008;
        }

        // ── Animate Foul Marker ─────────────────────────────────────────────
        if (state.foulMarker && state.foulMarker.visible) {
            const now = Date.now();
            if (now > state.foulMarkerTimer) {
                state.foulMarker.visible = false;
            } else {
                state.foulMarker.rotation.y += 0.05;
                state.foulMarker.position.y = 220 + Math.sin(now * 0.005) * 30;
            }
        }
        
        if(!state.ball.owner) {
            // GOAL / GOAL KICK / CORNER Detection (Re-calibrated to 5050/4050)
            if (state.ball.z < -5050) { 
                if (Math.abs(state.ball.x) < 400 && state.ball.y < 350) { triggerGoal('visitante'); } 
                else { 
                    // North end: local defends. If LOCAL last touched → corner for away. Else goal kick.
                    if (state.ball.lastTouch && state.ball.lastTouch.team === state.localTeam.name) triggerCorner(true);
                    else triggerGoalKick(true);
                }
            } else if (state.ball.z > 5050) { 
                if (Math.abs(state.ball.x) < 400 && state.ball.y < 350) { triggerGoal('local'); }
                else { 
                    // South end: away defends. If AWAY last touched → corner for local. Else goal kick.
                    if (state.ball.lastTouch && state.ball.lastTouch.team === state.awayTeam.name) triggerCorner(false);
                    else triggerGoalKick(false);
                }
            }
            // SIDE BOUNDARIES (THROW-IN)
            if (state.ball.x > 4050 || state.ball.x < -4050) {
                 triggerThrowIn(state.ball.x > 0);
            }
        }
        
        state.ball.mesh.position.x = state.ball.x;
        state.ball.mesh.position.z = state.ball.z;

        const now = Date.now();
        for(let i=0; i<state.players.length; i++) {
            const p1 = state.players[i];
            let immune1 = p1.immune && now < p1.immune;

            if(!p1.fallen && !immune1) {
                for(let j=i+1; j<state.players.length; j++) {
                    const p2 = state.players[j];
                    if(p2.fallen || (p2.immune && now < p2.immune)) continue;

                    if(p1.team !== p2.team) {
                        const dist = Math.hypot(p1.x - p2.x, p1.z - p2.z);

                        // ── SOFT TACKLE zone (80-160u) ──────────────────────────────────
                        if(dist < 160 && dist > 70 && !p1.sliding && !p2.sliding && Math.random() < 0.008) {
                            // Determine who is the defender (chasing ball)
                            const ballOwner = state.ball.owner;
                            let tackler = p1, carrier = p2;
                            if (ballOwner === p1 || p2.hasBall) { tackler = p2; carrier = p1; }

                            // ── DRIBBLE CHECK ──────────────────────────────────────────────
                            const dribble = carrier.skills ? carrier.skills.dribbling : 0.5;
                            const tackle  = tackler.skills ? tackler.skills.tackling  : 0.5;
                            const dribbleRoll = Math.random();

                            if (carrier.hasBall && dribbleRoll < dribble - tackle * 0.6) {
                                // ✅ REGATE EXITOSO — carrier evades
                                const evadeAngle = Math.atan2(carrier.z - tackler.z, carrier.x - tackler.x);
                                const evadeSide  = Math.random() > 0.5 ? 1 : -1;
                                carrier.x += Math.cos(evadeAngle + evadeSide * Math.PI/2) * 60;
                                carrier.z += Math.sin(evadeAngle + evadeSide * Math.PI/2) * 60;
                                showTackleIndicator(`⚡ REGATE — ${carrier.name}`);
                            } else {
                                // 🔶 SOFT TACKLE — tackler slides
                                tackler.sliding = true;
                                const aggress = tackler.skills ? tackler.skills.aggression : 0.4;
                                // Reduced foul probability
                                const isFoul  = (tackle < 0.50 && Math.random() < 0.3) || (aggress > 0.75 && Math.random() < aggress * 0.4);

                                if (isFoul && carrier.hasBall) {
                                    // Soft foul: show flash, show triangle marker
                                    showFoulFlash('soft', tackler.name, carrier.name);
                                    state.foulMarker.position.set(carrier.x, 220, carrier.z);
                                    state.foulMarker.visible = true;
                                    state.foulMarkerTimer = now + 4000; 
                                } else {
                                    showTackleIndicator(`🦵 ENTRADA — ${tackler.name}`);
                                }
                                setTimeout(() => { tackler.sliding = false; }, 1100);
                            }
                        }

                        // ── HARD COLLISION (dist < 45u) ────────────────────────────────
                        if(dist < 45) {
                            p1.sliding = false; p2.sliding = false;
                            p1.fallen = true;   p2.fallen = true;
                            p1.vx = (p1.x - p2.x) * 0.6;  p1.vz = (p1.z - p2.z) * 0.6;
                            p2.vx = (p2.x - p1.x) * 0.6;  p2.vz = (p2.z - p1.z) * 0.6;
                            p1.immune = now + 4000; p2.immune = now + 4000;

                            if(p1.hasBall || p2.hasBall) {
                                p1.hasBall = false; p2.hasBall = false;
                                state.ball.owner = null;
                                state.ball.vx = (Math.random() - 0.5) * 25;
                                state.ball.vy = 18 + Math.random() * 12;
                                state.ball.vz = (Math.random() - 0.5) * 25;
                                state.ball.curve = 0;
                            }

                            // Hard collision → HARD FOUL
                            const agP1 = p1.skills ? p1.skills.aggression : 0.5;
                            const agP2 = p2.skills ? p2.skills.aggression : 0.5;
                            const foulProb = Math.max(agP1, agP2);
                            // Reduced probability for hard fouls
                            if (!state.paused && Math.random() < foulProb * 0.45) {
                                const fouler = agP1 > agP2 ? p1 : p2;
                                const victim = fouler === p1 ? p2 : p1;
                                triggerCameraShake();
                                showFoulFlash('hard', fouler.name, victim.name);
                                
                                // Show Triangle Marker
                                state.foulMarker.position.set(victim.x, 220, victim.z);
                                state.foulMarker.visible = true;
                                state.foulMarkerTimer = now + 5000;
                            }

                            setTimeout(() => { p1.fallen = false; p1.vx = 0; p1.vz = 0; }, 3200);
                            setTimeout(() => { p2.fallen = false; p2.vx = 0; p2.vz = 0; }, 3200);
                        }
                    }
                }
            }

            if (!p1.fallen) {
                const bx = state.ball.owner ? state.ball.owner.x : state.ball.x;
                const bz = state.ball.owner ? state.ball.owner.z : state.ball.z;
                const distToBall = Math.hypot(bx - p1.x, bz - p1.z);
                let tx = p1.hx, tz = p1.hz, isChasing = false;

                if (p1.role === 'GK') {
                    if (p1.hasBall) {
                        isChasing = false; 
                        tx = p1.x; tz = p1.z; 
                    } else {
                        tx = Math.max(-800, Math.min(800, state.ball.x)); tz = p1.hz; isChasing = true; 
                    }
                    
                    if (!p1.hasBall && distToBall < 200 && state.ball.y > 60 && state.ball.y < 400) {
                        p1.mesh.position.y = state.ball.y - 40; 
                        if (distToBall < 100) state.ball.lastTouch = p1; // Deflection touch
                    } else if (!p1.hasBall && !p1.fallen && !p1.sliding) {
                        p1.mesh.position.y = 0;
                        if (distToBall < 80) state.ball.lastTouch = p1; // Low deflection touch
                    }
                    
                } else if(p1.hasBall) {
                    const tgtZ = p1.team === state.localTeam.name ? 5000 : -5000;
                    tx = p1.x + (Math.random() > 0.5 ? 200 : -200);
                    tz = tgtZ; 
                    isChasing = false; 
                } else {
                    const isLocal = p1.team === state.localTeam.name;
                    const ballAdvance = isLocal ? state.ball.z : -state.ball.z; 
                    
                    if (ballAdvance > 1500) { tz += isLocal ? 2000 : -2000; } 
                    else if (ballAdvance > -500) { tz += isLocal ? 800 : -800; }
                    else if (ballAdvance < -1500) { tz -= isLocal ? 1500 : -1500; } 
                    
                    if (p1.role === 'ATK') { tz += isLocal ? 800 : -800; tx += Math.random() > 0.5 ? 400 : -400; } 
                    if (p1.role === 'DEF') { tz -= isLocal ? 600 : -600; } 

                    const sameTeamHasBall = state.ball.owner && state.ball.owner.team === p1.team;
                    if (distToBall < 1800 && !sameTeamHasBall) { 
                        tx = state.ball.x; tz = state.ball.z; isChasing = true; 
                    }

                    if (state.ball.owner && state.ball.owner.role === 'GK') {
                        const distToGK = Math.hypot(p1.x - state.ball.owner.x, p1.z - state.ball.owner.z);
                        if (distToGK < 800) {
                             const repelAng = Math.atan2(p1.z - state.ball.owner.z, p1.x - state.ball.owner.x);
                             tx = state.ball.owner.x + Math.cos(repelAng) * 900;
                             tz = state.ball.owner.z + Math.sin(repelAng) * 900;
                             isChasing = false;
                        }
                    }
                }

                const distT = Math.hypot(tx - p1.x, tz - p1.z);
                if (distT > 15) {
                    const angle = Math.atan2(tz - p1.z, tx - p1.x);

                    // ── Real physics: acceleration & inertia ──────────────────────────
                    const spSkill = p1.skills ? p1.skills.speed : 0.8;
                    const stam    = p1.skills ? p1.skills.stamina : 1.0;
                    let topSpeed  = isChasing ? (5.5 + spSkill * 2.5) * stam : (1.8 + spSkill * 1.2) * stam;
                    if (p1.sliding)  topSpeed += 4.0;
                    if (p1.hasBall)  topSpeed = (3.0 + spSkill * 1.2) * stam;
                    if (p1.role === 'GK' && !isChasing) topSpeed = 1.5;

                    // Accelerate gradually toward target direction
                    const accel = p1.sliding ? 0.6 : 0.22;
                    const targetVX = Math.cos(angle) * topSpeed;
                    const targetVZ = Math.sin(angle) * topSpeed;
                    p1.vx = p1.vx + (targetVX - p1.vx) * accel;
                    p1.vz = p1.vz + (targetVZ - p1.vz) * accel;

                    const step = Math.min(Math.hypot(p1.vx, p1.vz), distT);
                    p1.x += (step > 0 ? p1.vx / Math.hypot(p1.vx, p1.vz) : 0) * step;
                    p1.z += (step > 0 ? p1.vz / Math.hypot(p1.vx, p1.vz) : 0) * step;

                    p1.mesh.rotation.y = -angle - Math.PI/2;
                } else {
                    // Decelerate with friction when near target
                    p1.vx *= 0.78;
                    p1.vz *= 0.78;
                }

                let heightClear = state.ball.y < 120; 
                if (p1.role === 'GK') heightClear = state.ball.y < 400; 

                if (distToBall < 60 && isChasing && !state.ball.owner && heightClear && !immune1) {
                    state.ball.lastTouch = p1;
                    state.ball.throwInTeam = null; // Ball touched, throw-ins no longer "direct"
                    p1.hasBall = true; state.ball.owner = p1;
                    if(p1.role === 'GK') {
                        state.ball.vy = 0; p1.mesh.position.y = 0; 
                    }

                    if (p1.role === 'GK') {
                        setTimeout(() => {
                            if(p1.hasBall && state.ball.owner === p1) {
                                p1.hasBall = false; state.ball.owner = null;
                                p1.immune = Date.now() + 4000; // Prevent immediate re-pickup after kick
                                const isLocal = p1.team === state.localTeam.name;
                                const targetGoalZ = isLocal ? 5000 : -5000;
                                const kickAngle = Math.atan2(targetGoalZ - p1.z, 0 - p1.x);
                                state.ball.vx = Math.cos(kickAngle) * 90 + (Math.random() - 0.5) * 20;
                                state.ball.vz = Math.sin(kickAngle) * 90;
                                state.ball.vy = 30 + Math.random() * 20; 
                                state.ball.curve = (Math.random() - 0.5) * 1.5;
                            }
                        }, 3000 + Math.random() * 3000);
                    } else {
                        const retencionT = 400 + Math.random() * 800; 
                        setTimeout(() => {
                            if(p1.hasBall && state.ball.owner === p1 && !state.freeKickPending) {
                                p1.hasBall = false; state.ball.owner = null;

                                const isLocal = p1.team === state.localTeam.name;
                                const tgtZ = isLocal ? 5000 : -5000;
                                const distToGoal = Math.abs(p1.z - tgtZ);

                                if (distToGoal < 3000) {
                                    const kickAngle = Math.atan2(tgtZ - p1.z, 0 - p1.x);
                                    state.ball.vx = Math.cos(kickAngle) * 65 + (Math.random() - 0.5) * 15;
                                    state.ball.vz = Math.sin(kickAngle) * 65;
                                    state.ball.vy = 10 + Math.random() * 25; 
                                    state.ball.curve = (Math.random() - 0.5) * 2.0; 
                                } else {
                                    const mates = state.players.filter(t => t.team === p1.team && t !== p1 && t.role !== 'GK');
                                    let bestMate = null; let bestScore = -Infinity;
                                    mates.forEach(t => {
                                        const advance = isLocal ? (t.z - p1.z) : (p1.z - t.z);
                                        if (advance > 0 && advance < 3500) { 
                                            const score = advance - Math.abs(t.x - p1.x)*0.3 + Math.random()*300;
                                            if(score > bestScore) { bestScore = score; bestMate = t; }
                                        }
                                    });

                                    if (bestMate && Math.random() < 0.8) { 
                                        const pAng = Math.atan2(bestMate.z - p1.z, bestMate.x - p1.x);
                                        const dMate = Math.hypot(bestMate.x - p1.x, bestMate.z - p1.z);
                                        const f = Math.min(85, 25 + dMate * 0.018); 
                                        state.ball.vx = Math.cos(pAng) * f;
                                        state.ball.vz = Math.sin(pAng) * f;
                                        state.ball.vy = (f > 60) ? 10 + Math.random()*15 : 0; 
                                        state.ball.curve = (Math.random() - 0.5) * 1.0; 
                                    } else {
                                        const kAng = Math.atan2(tgtZ - p1.z, 0 - p1.x);
                                        state.ball.vx = Math.cos(kAng) * 45;
                                        state.ball.vz = Math.sin(kAng) * 45;
                                        state.ball.vy = 0; 
                                        state.ball.curve = 0;
                                    }
                                }
                            }
                        }, retencionT);
                    }
                }
            }

            if(p1.role !== 'GK' || (p1.hasBall || p1.fallen || p1.sliding)) {
                // Apply inertia slide if fallen (player skids on the ground)
                if (p1.fallen) {
                    p1.vx *= 0.88;
                    p1.vz *= 0.88;
                    p1.x += p1.vx;
                    p1.z += p1.vz;
                }

                p1.mesh.position.x = p1.x;
                p1.mesh.position.z = p1.z;
                
                const distT = Math.hypot(p1.hx - p1.x, p1.hz - p1.z); 
                
                if (p1.fallen) {
                    // Gradual dramatic fall rotation
                    const targetRot = Math.PI / 2;
                    p1.mesh.rotation.x += (targetRot - p1.mesh.rotation.x) * 0.25;
                    p1.mesh.position.y = 15;
                    p1.legL.rotation.x = Math.sin(now * 0.008 + i) * 0.5;
                    p1.legR.rotation.x = Math.cos(now * 0.008 + i) * 0.5;
                } else if (p1.sliding) {
                    p1.mesh.rotation.x = Math.PI / 2.5;
                    p1.mesh.position.y = 15;
                    p1.legL.rotation.x = -Math.PI / 4; p1.legR.rotation.x = Math.PI / 4;
                } else {
                    // Smoothly rise back to standing
                    p1.mesh.rotation.x += (0 - p1.mesh.rotation.x) * 0.2;
                    p1.mesh.position.y = p1.mesh.position.y > 0 && p1.role==='GK' ? p1.mesh.position.y : 0;
                    
                    // Leg swing speed based on player's own velocity magnitude (not ball)
                    const pSpeed = Math.hypot(p1.vx, p1.vz);
                    if (pSpeed > 0.3) {
                        const freq = 0.010 + pSpeed * 0.002;
                        p1.legL.rotation.x = Math.sin(now * freq + i) * Math.min(0.9, pSpeed * 0.18);
                        p1.legR.rotation.x = Math.sin(now * freq + i + Math.PI) * Math.min(0.9, pSpeed * 0.18);
                    } else {
                        p1.legL.rotation.x *= 0.8;
                        p1.legR.rotation.x *= 0.8;
                    }
                }
            } else {
                p1.mesh.position.x = p1.x;
                p1.mesh.position.z = p1.z;
                
                const pSpeed = Math.hypot(p1.vx || 0, p1.vz || 0);
                if (pSpeed > 0.3) {
                    const freq = 0.010 + pSpeed * 0.002;
                    p1.legL.rotation.x = Math.sin(now * freq + i) * Math.min(0.9, pSpeed * 0.18);
                    p1.legR.rotation.x = Math.sin(now * freq + i + Math.PI) * Math.min(0.9, pSpeed * 0.18);
                } else {
                    p1.legL.rotation.x *= 0.8;
                    p1.legR.rotation.x *= 0.8;
                }
            }
        }
    }

    // UPDATE COACHES
    state.coaches.forEach(c => {
         const d = Math.hypot(c.tx - c.x, c.tz - c.z);
         if (d < 10 || Math.random() < 0.01) {
             c.tx = c.area.minX + Math.random() * (c.area.maxX - c.area.minX);
             c.tz = c.area.minZ + Math.random() * (c.area.maxZ - c.area.minZ);
         } else {
             const ang = Math.atan2(c.tz - c.z, c.tx - c.x);
             c.x += Math.cos(ang) * 2;
             c.z += Math.sin(ang) * 2;
             c.mesh.position.set(c.x, 0, c.z);
             c.mesh.rotation.y = -ang - Math.PI/2;
         }
    });

    camera.position.set(state.x, 200, state.z);
    // Update Fans (Phase 36)
    state.fans.forEach(f => {
        if(f.celebrating) {
            f.mesh.position.y = f.baseY + Math.abs(Math.sin(Date.now() * 0.015)) * 40;
            if(Date.now() > f.celebrateTimer) {
                f.celebrating = false;
                f.mesh.position.y = f.baseY;
            }
        }
    });

    renderer.render(scene, camera);
    requestAnimationFrame(updateEngine);
}

function triggerThrowIn(isEast) {
    if(state.paused) return;
    state.paused = true; document.exitPointerLock();
    
    const uiBox = document.getElementById('goal-alert-box');
    const uiText = document.getElementById('goal-alert-text');
    if(uiBox && uiText) {
        uiText.innerText = "¡SAQUE DE BANDA!";
        uiBox.style.background = "rgba(59, 130, 246, 0.9)";
        document.getElementById('goal-alert').style.display = 'flex';
    }

    setTimeout(() => {
        state.ball.vx = 0; state.ball.vz = 0; state.ball.vy = 8; state.ball.curve = 0;
        state.ball.y = 150;
        state.ball.x = isEast ? 4000 : -4000;
        state.ball.mesh.position.set(state.ball.x, 150, state.ball.z);

        // Determine who throws: opponent of who last touched the ball
        const lastTeam = state.ball.lastTouch ? state.ball.lastTouch.team : state.awayTeam.name;
        const throwerTeamName = lastTeam === state.localTeam.name ? state.awayTeam.name : state.localTeam.name;
        state.ball.throwInTeam = throwerTeamName; // Store team name for no-direct-goal check

        const teamPlayers = state.players.filter(p => p.team === throwerTeamName);
        let thrower = teamPlayers[0]; let bestD = Infinity;
        teamPlayers.forEach(p => {
             const d = Math.hypot(p.x - state.ball.x, p.z - state.ball.z);
             if(d < bestD) { bestD = d; thrower = p; }
        });

        thrower.x = state.ball.x; thrower.z = state.ball.z;
        thrower.fallen = false; thrower.sliding = false; 
        thrower.mesh.rotation.x = 0; thrower.mesh.position.set(thrower.x, 0, thrower.z);
        
        state.currentKicker = thrower;
        state.freeKickPending = true;
        if(btnWhistle) btnWhistle.style.display = 'block';
        DOM.hud.style.pointerEvents = 'auto';

        document.getElementById('goal-alert').style.display = 'none';
    }, 2000);
}

function endGame(msg) {
    state.paused = true;
    document.exitPointerLock();
    if(state.timerInterval) clearInterval(state.timerInterval);
    
    // Restore mouse events so the post-match buttons respond to clicks
    DOM.hud.style.pointerEvents = 'auto';
    DOM.foulModal.style.display = 'none';
    
    const localName = state.localTeam ? state.localTeam.name : 'LOCAL';
    const awayName = state.awayTeam ? state.awayTeam.name : 'VISITANTE';
    
    DOM.gameOver.style.display = 'flex';
    document.getElementById('go-title').innerText = msg;
    document.getElementById('go-desc').innerText = `Marcador Final: ${localName} ${state.scoreLocal} - ${awayName} ${state.scoreVisitante}`;
    
    document.getElementById('stat-fouls').innerText = state.stats.fouls;
    document.getElementById('stat-yellow').innerText = state.stats.yellow;
    document.getElementById('stat-red').innerText = state.stats.red;
    document.getElementById('stat-goals').innerText = state.scoreLocal + state.scoreVisitante;
}

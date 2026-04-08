import { Renderer } from './Renderer';
import { Physics, FIELD_W, FIELD_H, GOAL_W, GOAL_H } from './Physics';
import { Ball } from '../entities/Ball';
import { Player, PlayerRole, PlayerState } from '../entities/Player';
import { Referee } from '../entities/Referee';
import { InputManager } from './InputManager';

// =============================================
// FORMACIONES — coordenadas relativas al centro
// de su mitad de campo. Z negativo = hacia su portería.
// =============================================
type FormationPos = { x: number; z: number; role: PlayerRole };

const FORMATIONS: FormationPos[][] = [
    // 4-3-3 (FIFA Standard 105m)
    [
        { x: 0,     z: -4800, role: PlayerRole.GOALKEEPER  },
        { x: -1800, z: -3800, role: PlayerRole.DEFENDER    },
        { x: -600,  z: -4200, role: PlayerRole.DEFENDER    },
        { x:  600,  z: -4200, role: PlayerRole.DEFENDER    },
        { x:  1800, z: -3800, role: PlayerRole.DEFENDER    },
        { x: -1200, z: -2000, role: PlayerRole.MIDFIELDER  },
        { x:  0,    z: -2500, role: PlayerRole.MIDFIELDER  },
        { x:  1200, z: -2000, role: PlayerRole.MIDFIELDER  },
        { x: -1500, z: -800,  role: PlayerRole.FORWARD     },
        { x:  0,    z: -1200, role: PlayerRole.FORWARD     },
        { x:  1500, z: -800,  role: PlayerRole.FORWARD     },
    ],
    // 4-4-2
    [
        { x: 0,     z: -4800, role: PlayerRole.GOALKEEPER  },
        { x: -1800, z: -3800, role: PlayerRole.DEFENDER    },
        { x: -600,  z: -4200, role: PlayerRole.DEFENDER    },
        { x:  600,  z: -4200, role: PlayerRole.DEFENDER    },
        { x:  1800, z: -3800, role: PlayerRole.DEFENDER    },
        { x: -2000, z: -2200, role: PlayerRole.MIDFIELDER  },
        { x: -700,  z: -2600, role: PlayerRole.MIDFIELDER  },
        { x:  700,  z: -2600, role: PlayerRole.MIDFIELDER  },
        { x:  2000, z: -2200, role: PlayerRole.MIDFIELDER  },
        { x: -800,  z: -1000, role: PlayerRole.FORWARD     },
        { x:  800,  z: -1000, role: PlayerRole.FORWARD     },
    ],
    // 5-3-2 (Defensivo)
    [
        { x: 0,     z: -4800, role: PlayerRole.GOALKEEPER  },
        { x: -2200, z: -3200, role: PlayerRole.DEFENDER    },
        { x: -1000, z: -3800, role: PlayerRole.DEFENDER    },
        { x:  0,    z: -4300, role: PlayerRole.DEFENDER    },
        { x:  1000, z: -3800, role: PlayerRole.DEFENDER    },
        { x:  2200, z: -3200, role: PlayerRole.DEFENDER    },
        { x: -1200, z: -2000, role: PlayerRole.MIDFIELDER  },
        { x:  0,    z: -2400, role: PlayerRole.MIDFIELDER  },
        { x:  1200, z: -2000, role: PlayerRole.MIDFIELDER  },
        { x: -800,  z: -1000, role: PlayerRole.FORWARD     },
        { x:  800,  z: -1000, role: PlayerRole.FORWARD     },
    ],
];

export class Engine {
    public renderer: Renderer;
    private physics: Physics;
    private input: InputManager;
    private ball: Ball | null = null;
    private referee: Referee | null = null;
    private players: Player[] = [];

    private isRunning = false;
    private isPaused = false;
    private score = { local: 0, away: 0 };
    private matchTime = 0;          // Segundos reales
    private readonly MATCH_DURATION = 180; // 3 minutos reales ≈ 90 min de juego
    private lastFrameTime = 0;

    // Control de posesión
    private ballOwner: Player | null = null;
    private kickCooldown = 0;       // frames de enfriamiento tras un kick

    // Foul throttle
    private foulCooldown = 0;

    // El portero de cada equipo (índice 0 de la lista de cada equipo)
    private localTeamData: any = null;
    private awayTeamData: any = null;

    constructor(canvas: HTMLCanvasElement) {
        this.renderer = new Renderer(canvas);
        this.physics = Physics.getInstance();
        this.input = new InputManager(canvas);
    }

    public async setupMatch(localTeam: any, awayTeam: any) {
        this.localTeamData = localTeam;
        this.awayTeamData  = awayTeam;

        // Campo + límites físicos (alineados con las líneas visuales)
        this.renderer.createGrassField(FIELD_W, FIELD_H);
        this.physics.createFieldBoundaries();

        // Árbitro FPS
        this.referee = new Referee(this.renderer.scene, this.renderer.camera);

        // Balón en el centro
        this.ball = new Ball(this.renderer.scene, 0, 80, 0);

        // Spawnear jugadores en formación
        this.spawnTeam(localTeam.color || '#3b82f6', 0);
        this.spawnTeam(awayTeam.color || '#ef4444',  1);

        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.loop();
    }

    private spawnTeam(color: string, team: number) {
        const formation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];
        const sign = team === 0 ? 1 : -1; // equipo 0 ataca +Z, equipo 1 ataca -Z

        formation.forEach(pos => {
            const px = pos.x;
            const pz = pos.z * sign; // espejo por equipos
            const player = new Player(
                this.renderer.scene,
                team,
                pos.role,
                color,
                px,
                pz
            );
            this.players.push(player);
        });
    }

    // ─────────────────────────  LOOP  ──────────────────────────
    private loop() {
        if (!this.isRunning) return;

        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Física con fixed timestep
        this.physics.step(delta);

        if (!this.isPaused) {
            this.updateMatchLogic(delta);
        }

        // Actualizar entidades
        // Actualizar entidades
        const bpos = this.ball!.body.translation();
        const bvel = this.ball!.body.linvel();
        
        // Determinar persequidores (el más cercano de cada equipo)
        const chaser0 = this.getClosestPlayer(bpos, 0);
        const chaser1 = this.getClosestPlayer(bpos, 1);

        // Mapas de equipo para calcular el índice relativo (slot)
        const localTeam  = this.players.filter(p => p.team === 0);
        const awayTeam   = this.players.filter(p => p.team === 1);

        const attackingTeam = this.ballOwner?.team ?? -1;

        this.players.forEach(p => {
            const teamList = p.team === 0 ? localTeam : awayTeam;
            const oppList  = p.team === 0 ? awayTeam : localTeam;
            const slotIndex = teamList.indexOf(p);
            const isChaser = (p === chaser0 || p === chaser1);
            const isAttacking = p.team === attackingTeam;
            
            // Repulsión solo con compañeros
            const teammates = teamList.filter(other => other !== p);
            
            // Llamada v6.0: Incluyendo isAttacking
            p.update(delta, bpos, bvel, this.ballOwner, isChaser, teammates, oppList, slotIndex, isAttacking);
        });
        if (this.referee) this.referee.update(this.input);
        this.ball!.update();

        this.input.update();
        this.renderer.render();
        requestAnimationFrame(() => this.loop());
    }

    // ───────────────────────  LÓGICA  ──────────────────────────
    private updateMatchLogic(delta: number) {
        // 1. Cronómetro
        this.matchTime += delta / 1000;
        this.updateHUD();

        if (this.matchTime >= this.MATCH_DURATION) {
            this.endMatch();
            return;
        }

        const ballPos = this.ball!.body.translation();

        // 2. Posesión
        this.updatePossession(ballPos);

        // 3. Kicks de IA
        this.kickCooldown = Math.max(0, this.kickCooldown - 1);
        if (this.kickCooldown === 0) {
            this.handleAIKicks(ballPos);
        }

        // 4. Límite del balón (rebote en paredes sin físicas extra)
        this.clampBallToField(ballPos);

        // 5. Goles
        this.checkGoals(ballPos);

        // 6. Faltas
        this.foulCooldown = Math.max(0, this.foulCooldown - 1);
        if (this.foulCooldown === 0) {
            this.checkFouls();
        }
    }

    /** Determinar qué jugador controla el balón */
    private updatePossession(ballPos: any) {
        let closest: Player | null = null;
        let minDist = 120; // sólo captura si está muy cerca

        this.players.forEach(p => {
            const d = Math.hypot(p.body.translation().x - ballPos.x, p.body.translation().z - ballPos.z);
            if (d < minDist) {
                minDist = d;
                closest = p;
            }
        });

        // Actualizar hasBall flags
        this.players.forEach(p => { p.hasBall = false; });
        if (closest) {
            (closest as Player).hasBall = true;
            this.ballOwner = closest;
        } else {
            this.ballOwner = null;
        }
    }

    /** IA aplica fuerzas al balón según rol/posición o busca pase */
    private handleAIKicks(ballPos: any) {
        if (!this.ballOwner) return;

        const owner = this.ballOwner;
        const atkGoalZ  = owner.team === 0 ? FIELD_H / 2 : -FIELD_H / 2;
        const dirZ = atkGoalZ > 0 ? 1 : -1;

        // 1. ¿Hay algún compañero para pasar?
        const receiver = this.findPassReceiver(owner, ballPos, dirZ);
        
        let impulseX = 0, impulseZ = 0, impulseY = 30;
        const distToGoal = Math.abs(ballPos.z - atkGoalZ);

        if (distToGoal < 1200 || owner.role === PlayerRole.FORWARD) {
            // ¡TIRO A PUERTA!
            impulseX = -ballPos.x * 0.9; 
            impulseZ = dirZ * 2600;
            impulseY = 120;
        } else if (receiver) {
            // ¡PASE!
            const targetPos = receiver.body.translation();
            const dx = targetPos.x - ballPos.x;
            const dz = targetPos.z - ballPos.z;
            const dist = Math.hypot(dx, dz);
            
            impulseX = (dx / dist) * 1800;
            impulseZ = (dz / dist) * 1800;
            impulseY = 40;
            console.log(`🎯 Pase de ${owner.role} a ${receiver.role}`);
        } else {
            // Despeje genérico
            impulseX = (Math.random() - 0.5) * 500;
            impulseZ = dirZ * 1400;
        }

        this.ball!.applyImpulse({ 
            x: impulseX + (Math.random() - 0.5) * 200, 
            y: impulseY, 
            z: impulseZ + (Math.random() - 0.5) * 200 
        });
        this.kickCooldown = 40; 
    }

    private findPassReceiver(owner: Player, ballPos: any, dirZ: number): Player | null {
        let bestReceiver: Player | null = null;
        let bestScore = -Infinity;

        this.players.forEach(p => {
            if (p.team !== owner.team || p === owner || p.role === PlayerRole.GOALKEEPER) return;
            
            const targetPos = p.body.translation();
            const dz = (targetPos.z - ballPos.z) * dirZ; // Distancia hacia adelante en el ataque
            
            // Solo pasar a alguien que esté por delante o cerca
            if (dz > -200) {
                const dist = Math.hypot(targetPos.x - ballPos.x, targetPos.z - ballPos.z);
                if (dist > 300 && dist < 3500) {
                    // Score basado en qué tan adelantado está y proximidad
                    const score = dz - (dist * 0.2); 
                    if (score > bestScore) {
                        bestScore = score;
                        bestReceiver = p;
                    }
                }
            }
        });
        return bestReceiver;
    }

    /** Mantener el balón dentro del campo (rebote suave en bandas) */
    private clampBallToField(ballPos: any) {
        const HW = FIELD_W / 2;
        const HH = FIELD_H / 2;
        const vel = this.ball!.body.linvel();

        if (Math.abs(ballPos.x) > HW - 30 && Math.sign(vel.x) === Math.sign(ballPos.x)) {
            this.ball!.body.setLinvel({ x: -vel.x * 0.6, y: vel.y, z: vel.z }, true);
        }
        if (Math.abs(ballPos.z) > HH - 30 && Math.abs(ballPos.x) > GOAL_W / 2
            && Math.sign(vel.z) === Math.sign(ballPos.z)) {
            this.ball!.body.setLinvel({ x: vel.x, y: vel.y, z: -vel.z * 0.6 }, true);
        }
    }

    /** Detectar si el balón cruzó la línea de gol */
    private checkGoals(ballPos: any) {
        const HH = FIELD_H / 2;
        const GW = GOAL_W / 2;

        // Gol en portería norte (equipo local marca)
        if (ballPos.z > HH + 50 && Math.abs(ballPos.x) < GW && ballPos.y < GOAL_H + 30) {
            this.onGoal(0);
        }
        // Gol en portería sur (equipo visitante marca)
        if (ballPos.z < -(HH + 50) && Math.abs(ballPos.x) < GW && ballPos.y < GOAL_H + 30) {
            this.onGoal(1);
        }
    }

    private onGoal(scoringTeam: number) {
        this.isPaused = true;
        if (scoringTeam === 0) this.score.local++; else this.score.away++;

        // Celebración equipo goleador
        this.players.forEach(p => {
            if (p.team === scoringTeam) p.state = PlayerState.CELEBRATE;
        });

        // Mostrar alerta en HUD
        const alert = document.getElementById('goal-alert');
        if (alert) {
            alert.classList.remove('hidden');
            const teamName = scoringTeam === 0
                ? (this.localTeamData?.name || 'LOCAL')
                : (this.awayTeamData?.name || 'VISITANTE');
            alert.textContent = `⚽ GOL DE ${teamName.toUpperCase()}!`;
        }

        this.updateHUD();

        setTimeout(() => {
            if (alert) alert.classList.add('hidden');
            this.resetAfterGoal();
            this.isPaused = false;
        }, 3000);
    }

    private resetAfterGoal() {
        // Balón al centro
        this.ball!.reset(0, 80, 0);
        this.ballOwner = null;
        this.kickCooldown = 120; // Pausa de 2s antes del próximo kick

        // Todos los jugadores a sus posiciones de formación
        this.players.forEach(p => {
            p.state = PlayerState.RETURN_TO_POS;
            p.resetToHome();
        });
    }

    private checkFouls() {
        for (let i = 0; i < this.players.length; i++) {
            for (let j = i + 1; j < this.players.length; j++) {
                const a = this.players[i];
                const b = this.players[j];
                if (a.team === b.team) continue;

                const pa = a.body.translation();
                const pb = b.body.translation();
                if (Math.hypot(pa.x - pb.x, pa.z - pb.z) > 55) continue;

                const va = a.body.linvel();
                const vb = b.body.linvel();
                const relSpd = Math.hypot(va.x - vb.x, va.z - vb.z);

                // Falta si hay choque fuerte (>700 u/s relativo) con cierta probabilidad
                if (relSpd > 700 && Math.random() < 0.04) {
                    this.triggerFoul(a, b);
                    return; // Solo una falta por frame
                }
            }
        }
    }

    private triggerFoul(a: Player, b: Player) {
        this.isPaused = true;
        this.foulCooldown = 300; // 5s cooldown antes de detectar otra falta

        const panel = document.getElementById('decision-panel');
        if (panel) panel.classList.remove('hidden');

        // Indicar sobre qué jugadores ocurrió (para debug o indicador visual futuro)
        console.log(`⚠️ Falta: Equipo ${a.team} vs Equipo ${b.team}`);

        const btns = document.querySelectorAll('[data-action]');
        const onDecision = (e: Event) => {
            const action = (e.currentTarget as HTMLElement).getAttribute('data-action');
            if (panel) panel.classList.add('hidden');
            btns.forEach(btn => btn.removeEventListener('click', onDecision));

            // Ajustar autoridad del árbitro según decisión
            this.applyRefereeDecision(action || 'play-on');
            this.isPaused = false;
        };

        btns.forEach(btn => btn.addEventListener('click', onDecision));
    }

    private applyRefereeDecision(action: string) {
        const authBar = document.getElementById('authority-bar');
        if (!authBar) return;
        
        let currentWidth = parseFloat(authBar.style.width || '70');
        switch (action) {
            case 'play-on':    currentWidth = Math.min(100, currentWidth + 2); break;
            case 'foul':       currentWidth = Math.min(100, currentWidth + 5); break;
            case 'yellow':     currentWidth = Math.min(100, currentWidth + 3); break;
            case 'red':        currentWidth = Math.max(10,  currentWidth - 3); break;
        }
        authBar.style.width = `${currentWidth}%`;
    }

    // ────────────────────────  HUD  ───────────────────────────
    private updateHUD() {
        const timeEl  = document.getElementById('hud-time');
        const scoreEl = document.getElementById('hud-score');
        if (!timeEl || !scoreEl) return;

        const ratio = Math.min(1, this.matchTime / this.MATCH_DURATION);
        const displayMin = Math.floor(ratio * 90);
        const displaySec = Math.floor((ratio * 90 * 60) % 60);
        timeEl.textContent  = `${displayMin.toString().padStart(2, '0')}:${displaySec.toString().padStart(2, '0')}`;
        scoreEl.textContent = `${this.score.local} - ${this.score.away}`;

        // Actualizar nombres de equipos en HUD
        const localNameEl = document.getElementById('local-name');
        const awayNameEl  = document.getElementById('away-name');
        if (localNameEl && this.localTeamData) localNameEl.textContent = this.localTeamData.name || 'LOCAL';
        if (awayNameEl  && this.awayTeamData)  awayNameEl.textContent  = this.awayTeamData.name  || 'VISITANTE';
    }

    private endMatch() {
        this.isRunning = false;

        const result = document.getElementById('match-result');
        if (result) {
            const winner = this.score.local > this.score.away
                ? (this.localTeamData?.name || 'LOCAL')
                : this.score.away > this.score.local
                    ? (this.awayTeamData?.name || 'VISITANTE')
                    : 'EMPATE';

            result.innerHTML = `
                <div class="result-card">
                    <h1>FIN DEL PARTIDO</h1>
                    <div class="result-score">${this.score.local} - ${this.score.away}</div>
                    <div class="result-winner">${winner === 'EMPATE' ? '🤝 Empate' : `🏆 Ganador: ${winner}`}</div>
                    <button onclick="location.reload()">NUEVO PARTIDO</button>
                </div>
            `;
            result.classList.remove('hidden');
        }
    }

    /** Busca el jugador más cercano al balón para asignarle rol de Chaser */
    private getClosestPlayer(ballPos: any, team: number): Player | null {
        let closest: Player | null = null;
        let minDist = Infinity;
        this.players.forEach(p => {
            if (p.team !== team || p.role === PlayerRole.GOALKEEPER) return;
            const pos = p.body.translation();
            const d = Math.hypot(pos.x - ballPos.x, pos.z - ballPos.z);
            if (d < minDist) {
                minDist = d;
                closest = p;
            }
        });
        return closest;
    }

    public pause() {
        this.isPaused = !this.isPaused;
    }
}

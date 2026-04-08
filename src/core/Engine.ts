import { Renderer } from './Renderer';
import { Physics, FIELD_W, FIELD_H, GOAL_W, GOAL_H } from './Physics';
import { Ball } from '../entities/Ball';
import { Player, PlayerRole, PlayerState } from '../entities/Player';
import { Referee } from '../entities/Referee';
import { InputManager } from './InputManager';

export enum MatchPhase {
    KICKOFF,
    PLAYING,
    GOAL_KICK,
    THROW_IN,
    FOUL_FREE
}

// =====================================================================
// FORMACIONES — Coordenadas desde el centro del campo.
// Z negativo = zona propia. Unidades en mm (1u = 1cm → campo 105m)
// =====================================================================
type FormationPos = { x: number; z: number; role: PlayerRole };

// 4‑3‑3 ofensiva
const F433: FormationPos[] = [
    { x:    0, z: -4800, role: PlayerRole.GOALKEEPER },
    { x: -2000, z: -3800, role: PlayerRole.DEFENDER  },
    { x:  -650, z: -4100, role: PlayerRole.DEFENDER  },
    { x:   650, z: -4100, role: PlayerRole.DEFENDER  },
    { x:  2000, z: -3800, role: PlayerRole.DEFENDER  },
    { x: -1200, z: -2400, role: PlayerRole.MIDFIELDER },
    { x:     0, z: -2900, role: PlayerRole.MIDFIELDER },
    { x:  1200, z: -2400, role: PlayerRole.MIDFIELDER },
    { x: -2000, z:  -900, role: PlayerRole.FORWARD   },
    { x:     0, z: -1300, role: PlayerRole.FORWARD   },
    { x:  2000, z:  -900, role: PlayerRole.FORWARD   },
];

// 4‑4‑2 equilibrada
const F442: FormationPos[] = [
    { x:    0, z: -4800, role: PlayerRole.GOALKEEPER },
    { x: -2000, z: -3900, role: PlayerRole.DEFENDER  },
    { x:  -650, z: -4200, role: PlayerRole.DEFENDER  },
    { x:   650, z: -4200, role: PlayerRole.DEFENDER  },
    { x:  2000, z: -3900, role: PlayerRole.DEFENDER  },
    { x: -2200, z: -2500, role: PlayerRole.MIDFIELDER },
    { x:  -700, z: -2800, role: PlayerRole.MIDFIELDER },
    { x:   700, z: -2800, role: PlayerRole.MIDFIELDER },
    { x:  2200, z: -2500, role: PlayerRole.MIDFIELDER },
    { x:  -800, z: -1100, role: PlayerRole.FORWARD   },
    { x:   800, z: -1100, role: PlayerRole.FORWARD   },
];

// 5‑3‑2 defensivo
const F532: FormationPos[] = [
    { x:    0, z: -4800, role: PlayerRole.GOALKEEPER },
    { x: -2400, z: -3400, role: PlayerRole.DEFENDER  },
    { x: -1000, z: -4000, role: PlayerRole.DEFENDER  },
    { x:     0, z: -4300, role: PlayerRole.DEFENDER  },
    { x:  1000, z: -4000, role: PlayerRole.DEFENDER  },
    { x:  2400, z: -3400, role: PlayerRole.DEFENDER  },
    { x: -1300, z: -2300, role: PlayerRole.MIDFIELDER },
    { x:     0, z: -2600, role: PlayerRole.MIDFIELDER },
    { x:  1300, z: -2300, role: PlayerRole.MIDFIELDER },
    { x:  -850, z: -1100, role: PlayerRole.FORWARD   },
    { x:   850, z: -1100, role: PlayerRole.FORWARD   },
];

const FORMATIONS = [F433, F442, F532];

// =====================================================================

export class Engine {
    public renderer: Renderer;
    private physics: Physics;
    private input: InputManager;
    private ball: Ball | null = null;
    private referee: Referee | null = null;
    private players: Player[] = [];

    private isRunning = false;
    private isPaused  = false;
    private matchPhase: MatchPhase = MatchPhase.KICKOFF;

    private score = { local: 0, away: 0 };
    private matchTime = 0;
    private readonly MATCH_DURATION = 180; // 3 min reales = 90 min simulados
    private lastFrameTime = 0;

    // Posesión
    private ballOwner: Player | null = null;
    private kickCooldown = 0;
    private ballFreeTimer = 0; // cuántos segundos lleva el balón libre
    private kickoffTimer = 0;  // temporizador para saque inicial

    // Cooldowns
    private foulCooldown = 0;
    private phaseBlocked  = false; // evita detectar out mientras se resetea

    private localTeamData: any = null;
    private awayTeamData:  any = null;

    constructor(canvas: HTMLCanvasElement) {
        this.renderer = new Renderer(canvas);
        this.physics  = Physics.getInstance();
        this.input    = new InputManager(canvas);
    }

    public async setupMatch(localTeam: any, awayTeam: any) {
        this.localTeamData = localTeam;
        this.awayTeamData  = awayTeam;

        this.renderer.createGrassField(FIELD_W, FIELD_H);
        this.physics.createFieldBoundaries();
        this.referee = new Referee(this.renderer.scene, this.renderer.camera);
        this.ball    = new Ball(this.renderer.scene, 0, 80, 0);

        this.spawnTeam(localTeam.color || '#3b82f6', 0);
        this.spawnTeam(awayTeam.color  || '#ef4444', 1);

        this.matchPhase = MatchPhase.KICKOFF;
        this.kickoffTimer = 3; // 3 segundos de espera
        this.triggerMatchPhase('PREPARADOS...', 2000);
        this.isRunning  = true;
        this.lastFrameTime = performance.now();
        this.loop();
    }

    private spawnTeam(color: string, team: number) {
        const formation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];
        const sign = team === 0 ? 1 : -1;
        formation.forEach(p => {
            const jitter = (Math.random() - 0.5) * 60; // Desplazamiento sutil (60cm)
            this.players.push(new Player(
                this.renderer.scene, team, p.role, color,
                p.x + jitter, p.z * sign + jitter
            ));
        });
    }

    // ─────────────────────────────  LOOP  ────────────────────────────────
    private loop() {
        if (!this.isRunning) return;

        const now   = performance.now();
        const delta = Math.min(now - this.lastFrameTime, 50); // max 50ms
        this.lastFrameTime = now;

        this.physics.step(delta);

        if (!this.isPaused) {
            this.updateMatchLogic(delta);
        }

        this.updateEntities(delta);

        this.input.update();
        this.renderer.render();
        requestAnimationFrame(() => this.loop());
    }

    // ──────────────────────  LÓGICA DE PARTIDO  ───────────────────────────
    private updateMatchLogic(delta: number) {
        if (this.matchPhase === MatchPhase.KICKOFF) {
            this.kickoffTimer -= delta / 1000;
            if (this.kickoffTimer <= 0) {
                this.matchPhase = MatchPhase.PLAYING;
            }
            return; // Bloquear lógica de juego durante kickoff
        }

        this.matchTime += delta / 1000;
        this.updateHUD();

        if (this.matchTime >= this.MATCH_DURATION) { this.endMatch(); return; }

        const bpos = this.ball!.body.translation();

        // Posesión
        this.updatePossession(bpos);

        // Temporizador de balón libre
        if (!this.ballOwner) {
            this.ballFreeTimer += delta / 1000;
        } else {
            this.ballFreeTimer = 0;
        }

        // IA: kicks
        this.kickCooldown = Math.max(0, this.kickCooldown - 1);
        if (this.kickCooldown === 0) {
            this.handleAIAction(bpos);
        }

        // Saques (solo si no estamos en una transición)
        if (!this.phaseBlocked && this.matchPhase === MatchPhase.PLAYING) {
            this.checkBallOut(bpos);
        }

        // Goles
        this.checkGoals(bpos);

        // Faltas
        this.foulCooldown = Math.max(0, this.foulCooldown - 1);
        if (this.foulCooldown === 0) { this.checkFouls(); }
    }

    // ─────────────────────  ACTUALIZAR ENTIDADES  ─────────────────────────
    private updateEntities(delta: number) {
        const bpos = this.ball!.body.translation();
        const bvel = this.ball!.body.linvel();

        const localTeam = this.players.filter(p => p.team === 0);
        const awayTeam  = this.players.filter(p => p.team === 1);
        const attackTeam = this.ballOwner?.team ?? -1;

        // Preparar mapas de "oponente más cercano" para cada jugador
        const nearestOpp = new Map<Player, Player | null>();
        this.players.forEach(p => {
            const opps = p.team === 0 ? awayTeam : localTeam;
            let bestD = Infinity, bestP: Player | null = null;
            opps.forEach(o => {
                const pp = p.body.translation();
                const op = o.body.translation();
                const d  = Math.hypot(pp.x - op.x, pp.z - op.z);
                if (d < bestD) { bestD = d; bestP = o; }
            });
            nearestOpp.set(p, bestP);
        });

        // Obtener los 2 perseguidores (uno por equipo, más cercanos al balón)
        const chaser0 = this.getClosestToball(bpos, 0);
        const chaser1 = this.getClosestToball(bpos, 1);

        this.players.forEach(p => {
            const teamList   = p.team === 0 ? localTeam : awayTeam;
            const oppList    = p.team === 0 ? awayTeam  : localTeam;
            const slotIndex  = teamList.indexOf(p);
            const isChaser   = (p === chaser0 || p === chaser1);
            const isAttacking = p.team === attackTeam;
            const teammates  = teamList.filter(t => t !== p);

            p.update(
                delta, bpos, bvel, this.ballOwner,
                isChaser, teammates, oppList, slotIndex, isAttacking,
                nearestOpp.get(p) ?? null,
                this.ballFreeTimer
            );
        });

        if (this.referee) this.referee.update(this.input);
        this.ball!.update();
    }

    // ─────────────────────────  POSESIÓN  ────────────────────────────────
    private updatePossession(ballPos: any) {
        let closest: Player | null = null;
        let minDist = 150; // radio de captura

        this.players.forEach(p => {
            const pp = p.body.translation();
            const d  = Math.hypot(pp.x - ballPos.x, pp.z - ballPos.z);
            if (d < minDist) { minDist = d; closest = p; }
        });

        this.players.forEach(p => { p.hasBall = false; });
        if (closest) {
            (closest as Player).hasBall = true;
            this.ballOwner = closest;
        } else {
            this.ballOwner = null;
        }
    }

    // ─────────────────────────  IA DE ACCIÓN  ────────────────────────────
    /**
     * Motor de toma de decisión del equipo con balón:
     * 1. PORTERO con balón → saque largo o corto
     * 2. Defensa con balón → pase seguro o despeje
     * 3. Cualquier jugador en posición de tiro → DISPARO
     * 4. En banda con compañero en área → CENTRO
     * 5. Si hay pase libre mejor → PASE
     * 6. Conducción hacia adelante
     */
    private handleAIAction(ballPos: any) {
        if (!this.ballOwner) return;

        const owner    = this.ballOwner;
        const ownerPos = owner.body.translation();
        const atkGoalZ = owner.team === 0 ?  FIELD_H / 2 : -FIELD_H / 2;
        const atkDir   = atkGoalZ > 0 ? 1 : -1;
        const distToGoal = Math.abs(ownerPos.z - atkGoalZ);

        let impulse = { x: 0, y: 40, z: 0 };

        // ── 1. PORTERO: lanza el balón de vuelta al campo ──────────────────
        if (owner.role === PlayerRole.GOALKEEPER) {
            const receiver = this.findBestPass(owner, ballPos, atkDir, true);
            if (receiver) {
                impulse = this.calcPassImpulse(ballPos, receiver.body.translation(), 2200, 80);
            } else {
                // Saque largo al punto medio del campo
                impulse = { x: (Math.random() - 0.5) * 400, y: 250, z: atkDir * 2000 };
            }
            this.kickCooldown = 60;
            this.applyKick(impulse);
            return;
        }

        // ── 2. DISPARO A PUERTA ────────────────────────────────────────────
        // Condiciones: en área o cerca, o delantero con ángulo
        const inShootingZone = distToGoal < 1600;
        const hasShootAngle  = Math.abs(ownerPos.x) < 1200;

        if (inShootingZone && hasShootAngle) {
            // Disparo a la escuadra opuesta
            const targetX = ownerPos.x < 0 ? 180 : -180;
            const dx = targetX - ownerPos.x;
            const dz = atkGoalZ - ownerPos.z;
            const len = Math.hypot(dx, dz);
            const power = 2800 + Math.random() * 400;
            impulse = {
                x: (dx / len) * power + (Math.random() - 0.5) * 150,
                y: 100 + Math.random() * 80,
                z: (dz / len) * power + (Math.random() - 0.5) * 150,
            };
            this.kickCooldown = 35;
            this.applyKick(impulse);
            return;
        }

        // ── 3. CENTRO DESDE LA BANDA ───────────────────────────────────────
        const isWide     = Math.abs(ownerPos.x) > FIELD_W * 0.32;
        const inAtkHalf  = (ownerPos.z * atkDir) > 0;
        const hasRunnerInBox = this.players.some(p =>
            p.team === owner.team &&
            p.role === PlayerRole.FORWARD &&
            Math.abs(p.body.translation().z - atkGoalZ) < 1800 &&
            Math.abs(p.body.translation().x) < 900
        );

        if (isWide && inAtkHalf && hasRunnerInBox) {
            // Cross bombeado al punto de penalti
            const penX = ownerPos.x < 0 ? 300 : -300;
            const penZ = atkGoalZ - atkDir * 1000;
            const dx = penX - ownerPos.x;
            const dz = penZ - ownerPos.z;
            const len = Math.hypot(dx, dz);
            impulse = {
                x: (dx / len) * 2000,
                y: 200,
                z: (dz / len) * 2000,
            };
            this.kickCooldown = 40;
            this.applyKick(impulse);
            return;
        }

        // ── 4. PASE ────────────────────────────────────────────────────────
        const receiver = this.findBestPass(owner, ballPos, atkDir, false);
        if (receiver) {
            impulse = this.calcPassImpulse(ballPos, receiver.body.translation(), 1900, 50);
            this.kickCooldown = 38;
            this.applyKick(impulse);
            return;
        }

        // ── 5. CONDUCCIÓN (llevar el balón hacia adelante) ─────────────────
        impulse = {
            x: (Math.random() - 0.5) * 300,
            y: 30,
            z: atkDir * 1200,
        };
        this.kickCooldown = 45;
        this.applyKick(impulse);
    }

    /**
     * Encontrar el mejor receptor de pase:
     * - Delante del pasador (en la dirección de ataque)
     * - Sin oponente encima (espacio libre)
     * - A distancia razonable
     * - Con buen ángulo de continuidad
     */
    private findBestPass(
        owner: Player,
        ballPos: any,
        atkDir: number,
        longPass: boolean
    ): Player | null {
        let best: Player | null = null;
        let bestScore = -Infinity;
        const ownerPos = owner.body.translation();

        this.players.forEach(p => {
            if (p.team !== owner.team || p === owner) return;
            // Portero solo recibe si es saque del portero contrario
            if (!longPass && p.role === PlayerRole.GOALKEEPER) return;

            const pp = p.body.translation();
            const forwardness = (pp.z - ownerPos.z) * atkDir; // positivo = más adelante
            const dist = Math.hypot(pp.x - ballPos.x, pp.z - ballPos.z);

            // Filtros
            const maxDist = longPass ? 5000 : 3500;
            const minDist = longPass ? 1000 : 250;
            if (dist < minDist || dist > maxDist) return;
            if (!longPass && forwardness < -400) return; // no pasar muy atrás

            // Margen libre: comprobar si hay rival cerca del receptor
            const opponents = this.players.filter(q => q.team !== owner.team);
            const isMarked = opponents.some(opp => {
                const op = opp.body.translation();
                return Math.hypot(op.x - pp.x, op.z - pp.z) < 350;
            });
            if (isMarked) return;

            // Puntuación: más adelante + espacio libre + distancia óptima
            const distScore   = 1 - Math.abs(dist - 1500) / 3000;
            const fwdScore    = forwardness / (FIELD_H / 2);
            const roleBonus   = p.role === PlayerRole.FORWARD ? 0.4 :
                                p.role === PlayerRole.MIDFIELDER ? 0.2 : 0;
            const score = fwdScore * 2 + distScore * 1.5 + roleBonus;

            if (score > bestScore) { bestScore = score; best = p; }
        });
        return best;
    }

    private calcPassImpulse(
        from: any, to: any, power: number, loft: number
    ): { x: number; y: number; z: number } {
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        const len = Math.hypot(dx, dz);
        // Pequeño pase adelantado al movimiento del receptor
        return {
            x: (dx / len) * power + (Math.random() - 0.5) * 100,
            y: loft,
            z: (dz / len) * power + (Math.random() - 0.5) * 100,
        };
    }

    private applyKick(impulse: { x: number; y: number; z: number }) {
        this.ball!.applyImpulse(impulse);
        // Pequeña separación entre el jugador y el balón tras el kick
        if (this.ballOwner) {
            const bpos = this.ball!.body.translation();
            const ppos = this.ballOwner.body.translation();
            const dx   = bpos.x - ppos.x;
            const dz   = bpos.z - ppos.z;
            const len  = Math.max(1, Math.hypot(dx, dz));
            this.ball!.body.setTranslation({
                x: ppos.x + (dx / len) * 80,
                y: bpos.y,
                z: ppos.z + (dz / len) * 80
            }, true);
        }
    }

    // ─────────────────────  LÍMITES DEL CAMPO  ───────────────────────────
    private checkBallOut(ballPos: any) {
        const HW = FIELD_W / 2;
        const HH = FIELD_H / 2;
        const GW = GOAL_W  / 2;

        if (Math.abs(ballPos.x) > HW + 80) {
            this.startPhase('SAQUE DE BANDA', MatchPhase.THROW_IN, 1800, 0, 80, 0);
        } else if (Math.abs(ballPos.z) > HH + 80 && Math.abs(ballPos.x) > GW) {
            this.startPhase('SAQUE DE META', MatchPhase.GOAL_KICK, 2000,
                0, 80,
                (ballPos.z > 0 ? 1 : -1) * (HH - 600)
            );
        }
    }

    private triggerMatchPhase(msg: string, duration: number) {
        this.isPaused = true;
        const alert = document.getElementById('goal-alert');
        if (alert) {
            alert.classList.remove('hidden');
            alert.textContent = `📢 ${msg}`;
        }
        
        setTimeout(() => {
            if (alert) alert.classList.add('hidden');
            this.isPaused = false;
        }, duration);
    }

    private startPhase(
        msg: string, phase: MatchPhase,
        delay: number, bx: number, by: number, bz: number
    ) {
        this.phaseBlocked = true;
        this.matchPhase   = phase;
        this.isPaused     = true;

        const alert = document.getElementById('goal-alert');
        if (alert) { alert.classList.remove('hidden'); alert.textContent = `📢 ${msg}`; }

        setTimeout(() => {
            if (alert) alert.classList.add('hidden');
            this.ball!.reset(bx, by, bz);
            this.ballOwner = null;
            this.kickCooldown = 90;
            this.players.forEach(p => p.resetToHome());
            this.isPaused     = false;
            this.matchPhase   = MatchPhase.PLAYING;
            setTimeout(() => { this.phaseBlocked = false; }, 500);
        }, delay);
    }

    // ─────────────────────────  GOLES  ───────────────────────────────────
    private checkGoals(ballPos: any) {
        if (this.isPaused) return;
        const HH = FIELD_H / 2;
        const GW = GOAL_W  / 2;

        if (ballPos.z > HH + 40 && Math.abs(ballPos.x) < GW && ballPos.y < GOAL_H + 50) {
            this.onGoal(0);
        }
        if (ballPos.z < -(HH + 40) && Math.abs(ballPos.x) < GW && ballPos.y < GOAL_H + 50) {
            this.onGoal(1);
        }
    }

    private onGoal(scoringTeam: number) {
        if (this.isPaused) return; // evitar doble gol
        this.isPaused = true;

        if (scoringTeam === 0) this.score.local++; else this.score.away++;

        this.players.forEach(p => {
            if (p.team === scoringTeam) p.state = PlayerState.CELEBRATE;
        });

        const alert = document.getElementById('goal-alert');
        if (alert) {
            alert.classList.remove('hidden');
            const name = scoringTeam === 0
                ? (this.localTeamData?.name || 'LOCAL')
                : (this.awayTeamData?.name  || 'VISITANTE');
            alert.textContent = `⚽ GOOOL DE ${name.toUpperCase()}!`;
        }

        this.updateHUD();

        setTimeout(() => {
            if (alert) alert.classList.add('hidden');
            this.ball!.reset(0, 80, 0);
            this.ballOwner = null;
            this.kickCooldown = 150;
            this.phaseBlocked = true;
            this.players.forEach(p => { p.state = PlayerState.RETURN_TO_POS; p.resetToHome(); });
            this.isPaused   = false;
            this.matchPhase = MatchPhase.PLAYING;
            setTimeout(() => { this.phaseBlocked = false; }, 800);
        }, 3500);
    }

    // ─────────────────────────  FALTAS  ──────────────────────────────────
    private checkFouls() {
        for (let i = 0; i < this.players.length; i++) {
            for (let j = i + 1; j < this.players.length; j++) {
                const a = this.players[i], b = this.players[j];
                if (a.team === b.team) continue;
                const pa = a.body.translation(), pb = b.body.translation();
                if (Math.hypot(pa.x - pb.x, pa.z - pb.z) > 60) continue;
                const va = a.body.linvel(), vb = b.body.linvel();
                const relSpd = Math.hypot(va.x - vb.x, va.z - vb.z);
                if (relSpd > 750 && Math.random() < 0.03) {
                    this.triggerFoul(a, b);
                    return;
                }
            }
        }
    }

    private triggerFoul(_a: Player, _b: Player) {
        this.isPaused    = true;
        this.foulCooldown = 360;
        const panel = document.getElementById('decision-panel');
        if (panel) panel.classList.remove('hidden');
        const btns = document.querySelectorAll('[data-action]');
        const onDecision = (e: Event) => {
            const action = (e.currentTarget as HTMLElement).getAttribute('data-action');
            if (panel) panel.classList.add('hidden');
            btns.forEach(b => b.removeEventListener('click', onDecision));
            this.applyRefereeDecision(action || 'play-on');
            this.isPaused = false;
        };
        btns.forEach(b => b.addEventListener('click', onDecision));
    }

    private applyRefereeDecision(action: string) {
        const bar = document.getElementById('authority-bar');
        if (!bar) return;
        let w = parseFloat(bar.style.width || '70');
        if (action === 'play-on') w = Math.min(100, w + 2);
        if (action === 'foul')    w = Math.min(100, w + 5);
        if (action === 'yellow')  w = Math.min(100, w + 3);
        if (action === 'red')     w = Math.max(10,  w - 3);
        bar.style.width = `${w}%`;
    }

    // ─────────────────────────  HUD  ─────────────────────────────────────
    private updateHUD() {
        const timeEl  = document.getElementById('hud-time');
        const scoreEl = document.getElementById('hud-score');
        if (!timeEl || !scoreEl) return;
        const ratio = Math.min(1, this.matchTime / this.MATCH_DURATION);
        const min   = Math.floor(ratio * 90);
        const sec   = Math.floor((ratio * 90 * 60) % 60);
        timeEl.textContent  = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        scoreEl.textContent = `${this.score.local} - ${this.score.away}`;
        const ln = document.getElementById('local-name');
        const an = document.getElementById('away-name');
        
        let localName = this.localTeamData?.name || 'LOCAL';
        let awayName  = this.awayTeamData?.name  || 'VISITANTE';
        
        if (localName === awayName) {
            localName += ' [L]';
            awayName  += ' [V]';
        }
        
        if (ln) ln.textContent = localName;
        if (an) an.textContent = awayName;
    }

    private endMatch() {
        this.isRunning = false;
        const result = document.getElementById('match-result');
        if (!result) return;
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
            </div>`;
        result.classList.remove('hidden');
    }

    // ─────────────────────  UTILIDADES  ──────────────────────────────────
    private getClosestToball(ballPos: any, team: number): Player | null {
        let closest: Player | null = null;
        let minDist = Infinity;
        this.players.forEach(p => {
            if (p.team !== team || p.role === PlayerRole.GOALKEEPER) return;
            const pp = p.body.translation();
            const d  = Math.hypot(pp.x - ballPos.x, pp.z - ballPos.z);
            if (d < minDist) { minDist = d; closest = p; }
        });
        return closest;
    }

    public pause() { this.isPaused = !this.isPaused; }
}

import { Database } from './core/Database';
import { Physics } from './core/Physics';
import { Engine } from './core/Engine';

async function bootstrap() {
    const loadingScreen = document.getElementById('loading-screen')!;
    const mainMenu = document.getElementById('main-menu')!;
    const hud = document.getElementById('hud')!;
    const btnStart = document.getElementById('btn-start')!;
    
    try {
        console.log("Iniciando DB...");
        const db = Database.getInstance();
        await db.init();
        console.log("DB Lista. Cargando equipos...");
        const teams = await db.loadTeams();
        
        console.log("Equipos Cargados. Iniciando Rapier...");
        await Physics.init();
        console.log("Rapier Listo.");
        
        // Llenar selectores de equipos
        const localSelect = document.getElementById('local-team') as HTMLSelectElement;
        const awaySelect = document.getElementById('away-team') as HTMLSelectElement;
        
        teams.forEach((team: any) => {
            console.log(`Cargando equipo: ${team.name}`);
            const opt = document.createElement('option');
            opt.value = team.id;
            opt.textContent = team.name;
            localSelect.appendChild(opt.cloneNode(true));
            awaySelect.appendChild(opt);
        });

        console.log("Habilitando menú principal...");
        // Mostrar Menú tras carga satisfactoria (fuerza bruta para evitar bloqueos)
        loadingScreen.style.display = 'none';
        mainMenu.classList.remove('hidden');

        // Inicializar Motor
        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        const engine = new Engine(canvas);
        (window as any).gameEngine = engine;

        console.log("✅ Motor inicializado y menú listo.");

        btnStart.addEventListener('click', () => {
            const localId = localSelect.value;
            const awayId = awaySelect.value;
            const localTeam = teams.find(t => t.id === localId);
            const awayTeam = teams.find(t => t.id === awayId);
            
            mainMenu.classList.add('hidden');
            hud.classList.remove('hidden');
            
            engine.setupMatch(localTeam, awayTeam);
        });

    } catch (err) {
        console.error("Error crítico durante la inicialización:", err);
        alert("No se pudo iniciar el motor Pro. Verifica la consola.");
    }
}

bootstrap();

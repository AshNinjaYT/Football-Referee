const DB_NAME = 'RefereeSoccerDB';
const DB_VERSION = 1;

let db;

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject(event.target.error);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('teams')) {
                db.createObjectStore('teams', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('players')) {
                db.createObjectStore('players', { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('Database initialized');
            resolve(db);
        };
    });
}

async function populateDefaultTeams() {
    let defaultTeams;
    try {
        const response = await fetch('teams.json');
        defaultTeams = await response.json();
    } catch (e) {
        console.warn("Fetch failed, using local fallback teams. This usually happens when opening via file:// protocol.");
        // Hardcoded fallback to ensure teams appear even without a server
        defaultTeams = [
            { id: "madrid", name: "Madrid CF", color: "#ffffff", textColor: "#000000", secondary: "#facc15", players: [ { name: "Pini Jr", age: 23, dorsal: 7 }, { name: "Mpayppe", age: 25, dorsal: 9 }, { name: "Bellinjuan", age: 20, dorsal: 5 }, { name: "Juler", age: 38, dorsal: 10 }, { name: "Valbirdie", age: 25, dorsal: 8 }, { name: "Rudigamo", age: 31, dorsal: 22 }, { name: "Courtoiton", age: 31, dorsal: 1 }, { name: "Tervapal", age: 32, dorsal: 2 } ] },
            { id: "barca", name: "Barcelona United", color: "#1e3a8a", textColor: "#ffffff", secondary: "#ef4444", players: [ { name: "Lamine Yabien", age: 19, dorsal: 10 }, { name: "Levanvovski", age: 35, dorsal: 9 }, { name: "Pedro", age: 21, dorsal: 8 }, { name: "Gavicino", age: 19, dorsal: 6 }, { name: "Paraullo", age: 25, dorsal: 4 }, { name: "Juanjo Garcia", age: 31, dorsal: 1 }, { name: "Raphiñaldo", age: 33, dorsal: 22 }, { name: "Fer mingo", age: 24, dorsal: 7 } ] },
            { id: "city", name: "Manchester Eagles", color: "#7dd3fc", textColor: "#000000", secondary: "#ffffff", players: [ { name: "Jalande", age: 23, dorsal: 9 }, { name: "Cherkinho", age: 24, dorsal: 17 }, { name: "Podoli", age: 27, dorsal: 16 }, { name: "Foolen", age: 23, dorsal: 47 }, { name: "Beenard", age: 29, dorsal: 20 }, { name: "Doncasuma", age: 30, dorsal: 31 } ] },
            { id: "bayern", name: "Munchen Lions", color: "#ef4444", textColor: "#ffffff", secondary: "#ffffff", players: [ { name: "Kale", age: 30, dorsal: 9 }, { name: "Muylasa", age: 21, dorsal: 42 }, { name: "Lenal carlos", age: 17, dorsal: 25 }, { name: "Klich", age: 30, dorsal: 6 }, { name: "Neulu", age: 38, dorsal: 1 } ] }
        ];
    }

    const transaction = db.transaction(['teams'], 'readwrite');
    const store = transaction.objectStore('teams');

    for (const team of defaultTeams) {
        store.put(team);
    }

    return new Promise((resolve) => {
        transaction.oncomplete = () => {
            console.log('Default teams populated');
            resolve();
        };
    });
}

function getAllTeams() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['teams'], 'readonly');
        const store = transaction.objectStore('teams');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getTeamById(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['teams'], 'readonly');
        const store = transaction.objectStore('teams');
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

window.SoccerDB = {
    initDB,
    populateDefaultTeams,
    getAllTeams,
    getTeamById
};

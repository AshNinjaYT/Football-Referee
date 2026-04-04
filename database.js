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
    const response = await fetch('teams.json');
    const defaultTeams = await response.json();

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

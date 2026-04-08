export class Database {
    private static DB_NAME = 'RefereeSoccerDB-v2';
    private static DB_VERSION = 1;
    private db: IDBDatabase | null = null;
    private static instance: Database;

    private constructor() {}

    public static getInstance() {
        if (!Database.instance) Database.instance = new Database();
        return Database.instance;
    }

    public async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(Database.DB_NAME, Database.DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('teams')) {
                    db.createObjectStore('teams', { keyPath: 'id' });
                }
            };
        });
    }

    public async loadTeams(): Promise<any[]> {
        const response = await fetch('/teams.json');
        const defaultTeams = await response.json();
        
        return new Promise((resolve, reject) => {
            if (!this.db) return reject('DB not initialized');
            const transaction = this.db.transaction(['teams'], 'readwrite');
            
            transaction.onerror = (e) => {
                console.error('Error en transacción de equipos:', e);
                reject(e);
            };
            transaction.onabort = (e) => {
                console.error('Transacción de equipos abortada:', e);
                reject(e);
            };

            const store = transaction.objectStore('teams');
            defaultTeams.forEach((team: any) => store.put(team));
            
            transaction.oncomplete = () => {
                const readTx = this.db!.transaction(['teams'], 'readonly');
                const readStore = readTx.objectStore('teams');
                const request = readStore.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = (e) => reject(e);
            };
        });
    }
}

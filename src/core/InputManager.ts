export class InputManager {
    public keys: { [key: string]: boolean } = {};
    public mouseDelta: { x: number, y: number } = { x: 0, y: 0 };
    private isLocked = false;
    private canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.initListeners();
    }

    private initListeners() {
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        this.canvas.addEventListener('mousedown', () => {
            if (!this.isLocked) this.canvas.requestPointerLock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.canvas;
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isLocked) {
                this.mouseDelta.x = e.movementX;
                this.mouseDelta.y = e.movementY;
            }
        });
    }

    public update() {
        // Reset mouse delta after each frame to prevent continuous rotation
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
    }
}

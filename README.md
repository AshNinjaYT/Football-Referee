# 🏟️ Football Referee Pro - TypeScript Engine

![Football Referee Pro Hero](./assets/hero.png)

Este es el motor de simulación de alto rendimiento de **Football Referee Pro**. Esta versión ha sido desarrollada íntegramente en **TypeScript**, utilizando un enfoque orientado a objetos para gestionar entornos 3D complejos, físicas en tiempo real e inteligencia artificial táctica.

## 🛠️ Stack Tecnológico (Core)

- **Lenguaje**: [TypeScript 5.x](https://www.typescriptlang.org/) - Proporciona tipado estático y robustez para la arquitectura del motor.
- **Gráficos**: [Three.js](https://threejs.org/) - Renderizado 3D mediante WebGL con iluminación y sombreado dinámico.
- **Físicas**: [@dimforge/rapier3d-compat](https://rapier.rs/) - Motor de físicas compilado en WebAssembly para colisiones de alta precisión.
- **Bundler**: [Vite](https://vitejs.dev/) - Entorno de desarrollo rápido y empaquetado optimizado.

## 🧠 Arquitectura de IA y Lógica

### IA Táctica en TypeScript
El motor utiliza clases dedicadas para gestionar el comportamiento de los jugadores. La arquitectura se basa en un **Motor de Estados Tácticos**:
- **Clase Player**: Gestiona fuerzas vectoriales, anticipación de trayectoria y acumuladores de fase para animación fluida.
- **Clase Engine**: Coordina el "Bloque Dinámico" del equipo, calculando las líneas de defensa y ataque en tiempo real según la posición del balón.

## ⚽ Características Técnicas
- **Escalado 1:1**: Los cálculos de distancia y velocidad utilizan una escala real (cm/u) para garantizar un movimiento humano y creíble.
- **Anatomía Articulada**: Implementación de articulaciones en brazos y piernas mediante transformaciones de matriz en Three.js.
- **Estadio FIFA**: Reconstrucción geométrica de un campo de 105m x 68m con marcaje reglamentario.

## 🏃‍♂️ Instalación y Uso

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Ejecutar servidor de desarrollo**:
   ```bash
   npm run dev
   ```

3. **Build para producción**:
   ```bash
   npm run build
   ```

---
*Football Referee Pro - Ingeniería de simulación deportiva con TypeScript.*
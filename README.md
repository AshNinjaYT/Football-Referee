# 🏟️ Football Referee Pro (TypeScript Edition) - v6.2

![Football Referee Pro Hero](./assets/hero.png)

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![Rapier Physics](https://img.shields.io/badge/Rapier-E20B8C?style=for-the-badge&logo=rust&logoColor=white)](https://rapier.rs/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

Bienvenido a la versión profesional y de alto rendimiento del simulador **Football Referee**. Esta rama representa la evolución total del proyecto, migrando de un entorno 2D plano a un motor 3D completo con físicas avanzadas e Inteligencia Artificial táctica de vanguardia.

---

## 🚀 Características Principales

### 🧠 Tactical AI Engine v6.2 ("Fútbol Total")
- **Bloque Dinámico**: El equipo funciona como una unidad coordinada. El bloque entero (defensa, media y delantera) adelanta posiciones 8 metros en ataque y repliega 5 metros en defensa automáticamente.
- **Predicción de Trayectoria**: Implementa cálculos vectoriales para interceptar el balón en su posición futura en lugar de perseguir su posición actual.
- **Evasión de Oponentes (Dribble AI)**: El portador del balón detecta la proximidad de rivales y aplica fuerzas laterales de evasión para intentar el regate.
- **Triangulaciones de Apoyo**: Los centrocampistas buscan líneas de pase libres alrededor del poseedor, facilitando el juego asociativo y la salida de balón.

### ⚽ Motor Físico y Articulación Humana
- **RAPIER 3D**: Integración de un motor de físicas profesional para colisiones precisas, inercia de carrera y fricción de balón realista.
- **Anatomía Atlética**: Jugadores modelados con brazos y piernas articulados, utilizando un acumulador de fase para animaciones de carrera suaves y sincronizadas.
- **Estabilidad Dinámica**: Bloqueo de rotación y estabilización angular para evitar caídas poco realistas durante los choques.

### 📐 Estadio FIFA Reglamentario
- **Dimensiones Reales**: Campo de **105m x 68m** (escalado 1:1, donde 1 unidad = 1cm).
- **Líneas de Cal Profesionales**:
    - Área Grande (16.5m)
    - Área de Meta / Área Chica (5.5m)
    - Círculo Central Oficial (Radio 9.15m)
    - Punto de Penalti (11m) y Medialuna (Radio 9.15m)

---

## 🎮 Controles y Tutorial
1. **Instalación**: `npm install`
2. **Ejecución**: `npm run dev`
3. **Rol del Árbitro**: Mueve la cámara libre con WASD/Flechas. Haz click sobre los jugadores para intervenir en faltas y aplicar sanciones disciplinarias.

## 📊 Especificaciones Técnicas
| Característica | Legacy (Vanilla JS) | Pro (v2-ts) |
| :--- | :--- | :--- |
| Renderizado | Canvas 2D / DOM | Three.js WebGL |
| Físicas | Cinemática básica | Dinámicas RAPIER |
| IA | Movimiento directo | IA Táctica de Bloque |
| Escala | Arbitraria | FIFA Standard (1:1) |

---
*Football Referee Pro - De los píxeles a la simulación profesional de élite.*
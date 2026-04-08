# 🏛️ Football Referee Classic - Vanilla Web Engine

Este es el simulador original de **Football Referee**, construido enteramente sobre estándares web vainilla. Esta versión se centra en la ligereza y el uso directo de las APIs del navegador para crear una experiencia de gestión deportiva táctica en 2D.

## 🛠️ Stack Tecnológico (Core)

- **Lenguaje**: [JavaScript (ES6+)](https://developer.mozilla.org/en-US/docs/Web/JavaScript) - Lógica procedural y funcional para gestionar el motor de juego.
- **Estructura**: [HTML5](https://developer.mozilla.org/en-US/docs/Web/HTML) - Uso de contenedores semánticos para la UI y el campo de juego.
- **Estilo**: [CSS3](https://developer.mozilla.org/en-US/docs/Web/CSS) - Diseño responsivo y estilización de menús dinámicos.
- **Persistencia**: [JSON](https://www.json.org/) - Almacenamiento de datos de equipos y configuraciones de clubes.

## 🧠 Lógica de Juego y Desarrollo

### Motor Prototípico
A diferencia de versiones posteriores, esta edición utiliza **JavaScript puro** para manejar el bucle de juego:
- **Movimiento por Coordenadas**: Gestión directa de posiciones X e Z en un plano 2D.
- **Lógica de Colisión Manual**: Algoritmos de proximidad basados en el teorema de Pitágoras para detectar contactos con el balón.
- **Gestión de DOM**: Actualización en tiempo real de los marcadores y estados mediante manipulación directa de elementos HTML.

## ⚽ Características de la Versión
- **Compatible con Todos los Navegadores**: Sin necesidad de WebGL o soporte para motores 3D complejos.
- **Fácil de Aprender**: Código ideal para desarrolladores que quieran entender las bases de un juego web sin frameworks.
- **Estructura Plana**: Todo el código se encuentra organizado de forma sencilla en archivos `.js` y `.css` globales.

## 🏃‍♂️ Cómo Empezar
No requiere instalación de dependencias ni compilación.

1. **Clonar la rama**:
   ```bash
   git checkout legacy-vanilla
   ```

2. **Ejecutar**:
   Simplemente abre el archivo `index.html` en cualquier navegador moderno.

---
*Football Referee Classic - El origen del simulador en código web puro.*
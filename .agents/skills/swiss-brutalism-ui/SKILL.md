---
name: swiss-brutalism-ui
description: Reglas estrictas de arquitectura CSS, eliminación de dead-code y cero regresiones visuales para cms-members-app.
---

# Directivas de Arquitectura UI/UX

1. **Cero Regresión Visual:**
   - Mantener estilos idénticos al modificar clases CSS.
   - Preservar IDs del DOM referenciados en JS.
   - Preservar atributos `data-*` usados en delegación de eventos.

2. **Arquitectura CSS (4 Archivos):**
   - `assets/css/tokens.css`: Primitivos, semánticos y de componente. NADA MÁS.
   - `assets/css/app.css`: Reset base + componentes globales + layout global.
   - `assets/css/login.css`: Exclusivo para login.
   - `assets/css/cms-members.css`: Overrides específicos del módulo (Swiss Brutalism).

3. **Gestión de JS y Dead Code:**
   - `window.Utils` solo debe contener funciones activamente utilizadas.
   - Eliminar de inmediato funciones, variables o clases CSS sin referencias.

4. **Recursos de Referencia:**
   - Lee `resources/best_practices.md` (patrones arquitectónicos).
   - Lee `resources/anti_patterns.md` (prácticas prohibidas).
   - Lee `resources/error_handling.md` (resolución de incidentes UI/DOM).

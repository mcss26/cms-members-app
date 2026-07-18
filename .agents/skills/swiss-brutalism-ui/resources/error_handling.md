# UI/UX Error Handling

- **Falla Visual (Layout Roto / Elemento Invisible):**
  1. Revisar si la clase global requerida se purgó de `app.css`.
  2. Validar que no se eliminó un alias en `tokens.css` (ej. retrocompatibilidad de `--surface-1`).
- **Comportamiento JS Inoperante (Eventos Muertos):**
  1. Validar integridad de IDs del DOM (pudieron ser alterados durante el refactor).
  2. Comprobar presencia de atributos `data-*` requeridos por la lógica delegada.
- **Conflictos de Especificidad:**
  1. NO usar `!important` como parche.
  2. Ajustar scope aplicando anclaje (ej. `.cms-members .btn-nuevo`).

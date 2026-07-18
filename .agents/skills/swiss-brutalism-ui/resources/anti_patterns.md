# UI/UX Anti-Patterns

- **Estilos Inline (`style="..."`):** PROHIBIDO. Mantiene el HTML ensucio y viola especificidad.
- **Tokens Huérfanos:** Agregar variables a `tokens.css` para un solo uso específico.
- **Comentar Código Muerto:** PROHIBIDO dejar bloques de CSS/JS comentados "por si acaso". Usamos control de versiones; eliminar sin piedad.
- **Destrucción de Listeners:** Sobrescribir `innerHTML` indiscriminadamente eliminando listeners adjuntos. Preferir manipulación del DOM granular o delegación robusta.
- **Estilos Múltiples de Verdad:** Declarar variables de color fuera de `tokens.css`.
- **IDs en Selectores CSS (`#mi-id`):** PROHIBIDO. Usar IDs únicamente como ganchos para JS. El CSS se aplica mediante clases.

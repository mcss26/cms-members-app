# UI/UX Best Practices

- **Clases Funcionales:** Composición de clases sobre estilos inline. Mover todo estilo custom al archivo CSS correspondiente.
- **Uso Estricto de Tokens:** Consumir variables de `tokens.css` (`--bg-base`, `--text-1`, `--space-4`). Cero valores HEX/RGB hardcodeados en componentes.
- **Animaciones Globales:** Mantener `@keyframes` compartidos unificados en `app.css`.
- **Limpieza Síncrona:** Si se retira un elemento HTML, eliminar sincrónicamente su CSS exclusivo y JS asociado.
- **Delegación de Eventos:** Usar propagación en contenedores padres leyendo `e.target.closest('[data-action="..."]')` en lugar de atar listeners iterativos a hijos.

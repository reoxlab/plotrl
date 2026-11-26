# PlotRL

Graficador de funciones matemáticas en el navegador con generación en vivo de
código Python (Matplotlib). Hecho en Reox Lab.

Escribe de 1 a 4 funciones simultáneas, explora raíces, derivadas y rectas
tangentes, importa tus propios datos y copia un script completo en Python que
reproduce exactamente la gráfica visible. Sin cuentas, sin servidor y sin que
tus datos salgan de tu navegador.

- **Web:** https://reoxlab.com/herramientas/plotrl
- **Demo local:** `npm install && npm run dev`
- **Licencia:** GPL v3 (todo derivado sigue libre)

## Estado

v1.1.0: añade el buzón de sugerencias (`rl-suggest`) integrado antes del pie de página.

v1.0: graficador completo con 1 a 4 funciones en vivo, raíces, derivada y
tangente, importar datos (CSV, TSV, texto plano, XLSX, XLS y ODS), código
Python (Matplotlib) que reproduce la gráfica, presets docentes, exportar
PNG/SVG, compartir por URL y temas claro, oscuro y sistema.

## Qué puedes hacer con PlotRL

- **Funciones en vivo (1 a 4):** sintaxis intuitiva (`sin(x)`, `cos(x)`,
  `exp(-x^2)`, `sqrt(x)`, `ln(x)`, `x^3 - 3*x`, `pi`, `e`), fórmula renderizada
  con KaTeX y selector de color independiente por curva.
- **Análisis visual:** detección automática de raíces en el rango visible,
  curva opcional de derivada numérica y recta tangente al hacer clic sobre la
  gráfica.
- **Control total de la vista:** zoom con rueda o botones, arrastre para
  desplazar, rangos X/Y ajustables, rejilla opcional, escalas `linear`,
  `semilogx`, `semilogy` y `loglog`, leyenda opcional, título y nombres de ejes
  editables.
- **Código Python (Matplotlib) listo para usar:** script completo y ejecutable
  con los mismos colores, rango, escala, etiquetas, derivadas, tangente y datos
  importados. Se puede copiar o descargar como `.py`.
- **Presets docentes:** seno y coseno, gaussiana, potencial de Lennard-Jones,
  decaimiento exponencial y polinomio cúbico con un clic.
- **Importar datos:** archivos CSV, TSV, texto plano, XLSX, XLS y ODS con dos
  columnas `(x, y)` graficados como dispersión (`plt.scatter`) junto a tus
  funciones.
- **Exportar y compartir:** descarga en PNG o SVG fiel a la vista actual, y
  enlaces compartibles que restauran las funciones, colores, derivadas,
  rango X e Y y opciones desde la URL. Los datos importados no viajan en el
  enlace (hay que volver a importar el archivo).
- **Temas claro, oscuro y sistema:** sigue la preferencia de tu sistema
  operativo por defecto.
- **Enlace a Reox Lab opcional:** el encabezado puede mostrar el enlace
  «← Reox Lab»; viene apagado por defecto y se enciende con la variable
  `PLOTRL_BRAND_LINK=1` al levantar el contenedor.

## Desarrollo local

Requisitos: Node.js 20+ y Python 3 (solo para validar el código generado en las
pruebas).

```bash
npm install
npm run dev      # servidor local de desarrollo en http://localhost:5173
npm run build    # compilación TypeScript y paquete de producción en dist/
npm run preview  # previsualización local del build de producción
npm test         # pruebas unitarias (parser, muestreo, importación, código Python, tema, compartir)
```

## Licencia

PlotRL es software libre bajo la licencia **GNU General Public License v3.0 o
posterior** (`GPL-3.0-or-later`). Consulta el archivo [LICENSE](LICENSE) para
más detalles.

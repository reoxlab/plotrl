# PlotX — Especificación v1.0 (para aprobación)

**Fecha:** 23 de noviembre de 2026
**Estado:** APROBADA PARA CONSTRUIR 2026-11-24 — Francisco autorizó «saca la primera versión» en llamada; construcción en curso.
**Origen:** idea nº 1 del informe `ideas-herramientas/informe-herramientas-tipo-tablex.md` (23 nov 2026). Francisco eligió «PlotX primero».

---

## 1. Objetivo

**Qué:** una herramienta web gratuita, en español y sin registro, que grafica funciones matemáticas en el navegador y entrega, junto a la gráfica, el **código Python (Matplotlib) que la reproduce**, listo para copiar. Descarga en PNG/SVG y enlace compartible por URL.

**Por qué:** es el cruce de sus tres mundos (docencia + Python + métodos numéricos). Ningún graficador en español devuelve código; Desmos y GraphCalculate no lo hacen, y el Graph Plotter investigado es genérico y en inglés. Cada preset puede ser un Short o un fragmento de sus clases.

**Para quién:** estudiantes de física/matemáticas, profesores que preparan material, y usuarios de Python que quieren una gráfica rápida sin abrir un notebook.

**Éxito:** un estudiante abre `reoxlab.com/herramientas/plotx/`, escribe `sin(x)`, ve la gráfica al instante, copia el código Python, lo corre en su máquina y obtiene la misma gráfica. Sin instalar nada, sin cuenta.

---

## 2. Supuestos (corregir si alguno es falso)

1. Misma receta que TableX: TypeScript + Vite, estático, Docker (node:22-alpine build → nginx:alpine), GPL v3, español, sin backend, sin cuentas, sin base de datos.
2. El código Python generado es un script completo y ejecutable (imports + datos + `plt.savefig`/show), no un fragmento.
3. La sintaxis de funciones es estilo mathjs: `sin(x)`, `cos(x)`, `exp(x)`, `sqrt(x)`, `x^2`, `pi`, `e`. Se acepta `x` como única variable.
4. El despliegue es en Skynet, subruta `/herramientas/plotx/`, por el túnel de Cloudflare (la ruta en Zero Trust la crea Francisco, como con TableX).
5. Repos: Gitea `fpena/plotx` (origen, por LAN) y espejo público GitHub `reoxlab/plotx`. Trabajo en rama `dev`; `main` solo se actualiza cuando Francisco lo revisa y lo fusiona (regla vigente de TableX).
6. El cascarón visual se toma de TableX: cabecera Reox Lab, pie con enlace a las demás herramientas, botón de copiar, modo oscuro, seguimiento con Umami.
7. Estimación del informe: 5–7 días de trabajo (una herramienta por semana, como TableX).

---

## 3. Alcance del MVP (v1.0)

- **Entrada:** 1 a 4 funciones simultáneas. Edición en vivo: al teclear,
  la gráfica se actualiza. Cada función (y cada serie de datos
  importada) lleva un selector de color: el usuario elige el color de
  cada curva; por default se asignan los de la marca (vino, dorado,
  carbón) y luego la paleta de Matplotlib. El color elegido se usa
  también en el código Python generado.
- **Gráfica:** Canvas, con zoom (rueda/botones), arrastre para desplazar,
  ejes con etiquetas. Rango inicial en x: −10 a 10, ajustable.
  **Rejilla opcional** (casilla para mostrarla o no) y **escala
  elegible**: lineal, logarítmica en X (semilogx), logarítmica en Y
  (semilogy) o logarítmica en ambas (loglog); son las opciones básicas
  de Matplotlib y el código generado las refleja (`plt.grid(...)`,
  `plt.xscale(...)` / `plt.yscale(...)`).
- **Leyenda, título y ejes (decidido 2026-11-24):** casilla para
  mostrar u ocultar la leyenda; campos editables para el título de la
  gráfica y los nombres de los ejes X e Y (por default el título nombra
  la función y los ejes son «x» y «f(x)»). Todo se refleja en el código
  Python generado (`plt.legend()`, `plt.title(...)`, `plt.xlabel(...)`
  / `plt.ylabel(...)`).
- **Análisis por función:** raíces (ceros visibles en el rango), derivada (curva opcional), recta tangente en un punto elegible con clic.
- **Código Python:** panel con el script Matplotlib completo que reproduce exactamente lo visible (mismas funciones, rango, colores, rejilla, etiquetas). Botón copiar. El código usa los colores de la gráfica y título/ejes en español.
- **Descargas:** PNG y SVG de la gráfica tal como se ve.
- **Presets docentes:** seno/coseno, gaussiana, potencial de Lennard-Jones, decaimiento exponencial, polinomio. Un clic carga la función y el rango sugerido.
- **Compartir:** la URL codifica funciones, rango y colores; abrirla restaura la misma vista.
- **Enlace de marca opcional (decidido 2026-11-24):** el encabezado puede
  llevar el enlace «← Reox Lab» o no, según una variable de entorno al
  levantar el contenedor en Docker; en nuestro servidor va prendido y
  quien lo aloje en su propia máquina lo apaga. Como la app es estática,
  la variable se lee al arrancar el contenedor (script de entrada que
  escribe la configuración), no en el build. (Default de la imagen:
  APAGADO — decidido 2026-11-24.)
- **Selector de tema (decidido 2026-11-24):** Sistema/Claro/Oscuro arriba
  a la derecha del encabezado, igual que TableX v1.1.0; default Sistema
  (sigue `prefers-color-scheme`); tema oscuro con los colores de la marca.
- **Importar datos (decidido 2026-11-24, desde el inicio):** CSV, ODS,
  XLSX/XLS y texto plano con dos columnas (x, y) para graficar puntos
  junto a las funciones. Todo en el navegador, sin backend: CSV y texto
  plano con FileReader; XLSX/ODS con SheetJS, la misma librería que ya
  usa TableX. El código Python generado incluye los datos importados
  (con `plt.scatter`) para reproducir la misma gráfica.
- **Idioma:** toda la interfaz en español. Fórmulas renderizadas con KaTeX.
- **SEO:** título y descripción propios («Graficador de funciones con código Python — Reox Lab»).

## 4. Fuera de alcance (v1.0) — se aparca, no se descarta

- Gráficas 3D, funciones implícitas, paramétricas y polares.
- Solucionador de ecuaciones diferenciales, integrales numéricas, ajuste de datos.
- Cuentas de usuario, guardar gráficas en el servidor, historial.
- Exportar a PDF o a LaTeX (eso es TableX/MatrizX).
- App móvil. Modo offline PWA (se valora en v1.1 si se usa).

---

## 5. Estructura

```
/home/reox/reoxlab/proyectos/plotx/      # trabajo en Magi (usuario reox)
├── src/
│   ├── main.ts            # arranque, estado global
│   ├── parser.ts          # texto -> función evaluable (mathjs)
│   ├── sampler.ts         # muestreo adaptativo, raíces, derivada numérica
│   ├── plot.ts            # render Canvas (ejes, rejilla, curvas, tangente)
│   ├── codegen.ts         # funciones + vista -> script Python Matplotlib
│   ├── presets.ts         # presets docentes
│   ├── dataimport.ts      # archivo (CSV/ODS/XLSX/texto) -> puntos (x, y)
│   ├── share.ts           # codificar/decodificar estado en la URL
│   └── ui.ts              # controles, panel de código, descargas
├── tests/
│   ├── test-parser.ts     # casos: sin(x), x^2, e^(-x^2), errores de sintaxis
│   ├── test-sampler.ts    # raíces conocidas, derivada numérica vs analítica
│   ├── test-dataimport.ts # CSV/texto y ODS de prueba -> puntos correctos
│   └── test-codegen.ts    # el .py generado contiene funciones, rango y colores
├── index.html             # cascarón Reox Lab + Umami
├── nginx.conf             # sirve bajo el prefijo /herramientas/plotx/
├── Dockerfile             # igual que TableX (node:22-alpine -> nginx:alpine)
├── package.json           # scripts iguales que TableX
└── SPEC.md                # este archivo (versionado con el código)
```

Despliegue en Skynet: `/home/rixuko/herramientas/plotx/`, red `sky-net`, sin puertos publicados. Notas de avance en Obsidian `Notas/Proyectos/plotx/` (Visión, Arquitectura, Decisiones, Avances), como TableX.

---

## 6. Comandos exactos (misma receta que TableX)

Desarrollo (en Magi, `proyectos/plotx`):

```bash
npm install
npm run dev        # vite, servidor local de desarrollo
npm test           # esbuild + node sobre tests/test-*.ts (igual que TableX)
npm run build      # tsc && vite build
```

Despliegue (rsync por LAN Magi → Skynet, luego en Skynet):

```bash
rsync -a --exclude=.git --exclude=node_modules --exclude=dist /home/reox/reoxlab/proyectos/plotx/ rixuko@192.168.1.113:/home/rixuko/herramientas/plotx/
docker compose up -d --build
```

Verificación en vivo:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://reoxlab.com/herramientas/plotx/
```

Publicación en GitHub (espejo `reoxlab/plotx`, solo rama `dev`, nunca `main`):

```bash
git add -A && git commit -m "..." && git push origin dev
```

---

## 7. Estilo

- Español en toda la interfaz y en los comentarios del código generado. Ejemplo del código Python que entrega la herramienta:

```python
import numpy as np
import matplotlib.pyplot as plt

x = np.linspace(-10, 10, 400)
y = np.sin(x)

plt.figure()
plt.plot(x, y, label=r"$f(x) = \sin(x)$")
plt.axhline(0, color="gray", linewidth=0.8)
plt.axvline(0, color="gray", linewidth=0.8)
plt.grid(True)
plt.xlabel("x")
plt.ylabel("f(x)")
plt.title("Gráfica de f(x) = sin(x)")
plt.legend()
plt.savefig("grafica.png", dpi=150)
plt.show()
```

- Colores de gráfica: paleta Reox Lab (vino #80001E, dorado #CCA757, carbón #131315) para la primera función; resto de la paleta de Matplotlib (`C0`–`C3`) para las siguientes.
- Nombres en inglés para el código (`parser.ts`, `codegen.ts`), texto visible siempre en español.

---

## 8. Estrategia de pruebas

- Sin framework de tests (igual que TableX): corredor propio con esbuild + node sobre `tests/test-*.ts`.
- **Unitarias** (`test-parser.ts`, `test-sampler.ts`, `test-codegen.ts`): el parser acepta la sintaxis documentada y rechaza lo inválido sin romper; el muestreador encuentra las raíces conocidas de `sin(x)` en [−10, 10] y la derivada numérica coincide con la analítica dentro de 1e-4; el código generado contiene las funciones, el rango y los colores, y es Python válido (se comprueba con `python3 -m py_compile` sobre el texto generado).
- **Humo tras el build:** `npm run build` sin errores; la página sirve 200 en local y en Skynet; abrirla no produce errores en consola; un preset carga y grafica.
- **Manual (Francisco):** probar en su Brave con sus funciones de clase antes de publicar.

---

## 9. Límites

**Siempre:** trabajar en rama `dev`, commits libres; probar antes de desplegar; documentar cada avance en Obsidian; medir con Umami qué se usa.

**Preguntar primero:** publicar o anunciar la herramienta; crear la ruta del túnel (es su paso manual en Zero Trust); crear los repos de Gitea/GitHub; cualquier cambio de alcance (añadir un preset, quitar una función del MVP); gastar dinero.

**Nunca:** push a `main` (ni en Gitea ni en GitHub); subir claves, contraseñas o API keys a ningún lado; tocar datos de Francisco fuera del alcance; prometer fechas de entrega.

---

## 10. Criterios de éxito (comprobables)

1. `npm run build` termina sin errores y `npm test` pasa.
2. Escribir `sin(x)` muestra la gráfica en menos de 1 s tras teclear.
3. El código Python copiado corre con `python3` + Matplotlib y dibuja la misma curva (mismo rango, mismos colores).
4. La descarga PNG y la SVG contienen la gráfica tal como se ve.
5. Una URL compartida, abierta en otro navegador, restaura las mismas funciones y el mismo rango.
6. `https://reoxlab.com/herramientas/plotx/` responde 200 y la página no tiene errores en consola.
7. Los 5 presets cargan su función y su rango con un clic.
8. Importar un CSV con dos columnas (x, y) dibuja los puntos en la
   gráfica y el código Python generado los incluye.
9. La rejilla se puede apagar y la escala logarítmica (X, Y o ambas) se
   ve en la gráfica y queda en el código Python generado.
10. El título y los nombres de los ejes se pueden cambiar y la leyenda
    se puede ocultar; el código generado lleva esos valores.

---

## 11. Preguntas abiertas para Francisco

1. **Nombre final — RESUELTO 2026-11-24: PlotX** (no PlotPy ni Plotly).
   Nombre público «PlotX» y ruta `/herramientas/plotx/`.
2. **Presets:** ¿los 5 del informe (seno/coseno, gaussiana, Lennard-Jones, decaimiento exponencial, polinomio) o cambio/agrego alguno (por ejemplo, tangente, logaritmo, valor absoluto)?
3. **Funciones simultáneas:** ¿hasta 4 está bien, o bastan 2?
4. **Tangente y derivada en el MVP** o se dejan para v1.1 y el MVP lleva solo gráfica + código + presets + compartir?
5. **Código Python:** ¿script completo con `savefig` + `show` (como el ejemplo) o prefieres que solo guarde el PNG sin mostrar ventana?

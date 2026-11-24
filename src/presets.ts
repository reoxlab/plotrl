// Copyright (C) 2026 Francisco Peña Gallardo (Reox Lab)
//
// This file is part of PlotX.
//
// PlotX is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// PlotX is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with PlotX. If not, see <https://www.gnu.org/licenses/>.

// PlotX — presets docentes listos para cargar con un clic.

export interface Preset {
  id: string
  name: string
  expr: string
  // Si hay varias expresiones, el preset carga una fila por cada una.
  exprs?: string[]
  xmin: number
  xmax: number
  description: string
  title?: string
}

export const PRESETS: Preset[] = [
  {
    id: 'sine-cosine',
    name: 'Seno / Coseno',
    expr: 'sin(x)',
    exprs: ['sin(x)', 'cos(x)'],
    xmin: -10,
    xmax: 10,
    description: 'Seno y coseno juntos en [-10, 10], desfasados π/2.',
    title: 'Seno y coseno',
  },
  {
    id: 'gaussian',
    name: 'Gaussiana',
    expr: 'exp(-x^2)',
    xmin: -3,
    xmax: 3,
    description: 'Campana de Gauss centrada en el origen.',
  },
  {
    id: 'lennard-jones',
    name: 'Lennard-Jones',
    expr: '4*((1/x)^12-(1/x)^6)',
    xmin: 0.8,
    xmax: 3,
    description: 'Potencial interatómico con pozo en x ≈ 1.12.',
  },
  {
    id: 'exp-decay',
    name: 'Decaimiento exponencial',
    expr: 'exp(-x)',
    xmin: -1,
    xmax: 5,
    description: 'Decaimiento típico en radiactividad y descarga RC.',
  },
  {
    id: 'polynomial',
    name: 'Polinomio',
    expr: 'x^3-3*x',
    xmin: -3,
    xmax: 3,
    description: 'Cúbica con tres raíces reales y dos extremos locales.',
  },
]

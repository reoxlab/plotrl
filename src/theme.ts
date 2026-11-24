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

// PlotX — temas claro / oscuro / sistema.
//
// La elección del usuario se guarda en localStorage bajo `plotx-theme-v1`.
// Por defecto es «system», que sigue a `prefers-color-scheme` del sistema
// operativo y reacciona a cambios en caliente. El tema efectivo se escribe en
// `document.documentElement.dataset.theme`.

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type ThemeChoice = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

export const THEME_KEY = 'plotx-theme-v1'

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): Theme {
  if (choice === 'dark') return 'dark'
  if (choice === 'light') return 'light'
  return prefersDark ? 'dark' : 'light'
}

export function loadThemeChoice(storage: StorageLike): ThemeChoice {
  const raw = storage.getItem(THEME_KEY)
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

export function saveThemeChoice(storage: StorageLike, choice: ThemeChoice): void {
  storage.setItem(THEME_KEY, choice)
}

import * as react from './react.js';

// To add a future extension: import its module and add it here.
export const extensions = [
  { id: react.id, label: react.label, apply: react.apply },
];

export function getExtension(id) {
  return extensions.find((e) => e.id === id);
}

export const TYPES = ['section', 'text', 'image', 'bar', 'line'];
export const uid = () => crypto.randomUUID();
export const clone = value => JSON.parse(JSON.stringify(value));
export const clamp = (n, min, max) => Math.min(Math.max(n, min), Math.max(min, max));
export function bounds(layout, element) {
  const parent = layout.elements.find(item => item.id === element.parentId);
  return parent ? { width: parent.width, height: parent.height } : layout;
}
export function constrain(layout, element) {
  const box = bounds(layout, element);
  element.width = clamp(element.width, 100, box.width);
  element.height = clamp(element.height, 60, box.height);
  element.x = clamp(element.x, 0, box.width - element.width);
  element.y = clamp(element.y, 0, box.height - element.height);
  if (element.type === 'section') {
    for (const child of layout.elements.filter(item => item.parentId === element.id)) constrain(layout, child);
  }
  return element;
}
export function removeElement(layout, id) {
  layout.elements = layout.elements.filter(item => item.id !== id && item.parentId !== id);
}
export function duplicateElement(layout, id) {
  const original = layout.elements.find(item => item.id === id);
  if (!original) return null;
  const copy = { ...clone(original), id: uid(), name: `${original.name} copy`, x: original.x + 24, y: original.y + 24 };
  layout.elements.push(copy);
  for (const child of [...layout.elements].filter(item => item.parentId === id)) {
    layout.elements.push({ ...clone(child), id: uid(), parentId: copy.id });
  }
  constrain(layout, copy);
  return copy;
}
export function makeElement(type, parentId = null) {
  return { id: uid(), type, parentId, name: ({ section: 'New section', text: 'Text block', image: 'Image', bar: 'Bar chart', line: 'Line chart' })[type],
    x: 32, y: 40, width: type === 'section' ? 720 : 340, height: type === 'section' ? 300 : type === 'text' ? 100 : 240,
    background: type === 'section' ? '#f5f6fa' : '#ffffff', color: '#252938', radius: 12, fontSize: 24,
    content: type === 'text' ? { runs: [{ text: 'Make room for your next big idea.', bold: false, italic: false }] }
      : type === 'image' ? { src: '', alt: 'Uploaded image', fit: 'cover' }
      : ['bar', 'line'].includes(type) ? { title: 'Monthly performance', labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [32, 48, 39, 65, 52, 78], accent: '#7460e8' } : {} };
}

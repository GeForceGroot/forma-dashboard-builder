import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { clone, constrain, removeElement, duplicateElement, makeElement } from '../public/assets/model.js';
import { sampleLayout } from '../public/assets/sample.js';
globalThis.crypto ??= webcrypto;

test('movement and resizing stay within the canvas', () => {
  const layout = { width: 400, height: 300, elements: [] };
  const element = makeElement('text');layout.elements.push(element);
  Object.assign(element, {x: 390, y: -20, width: 600, height: 100});constrain(layout, element);
  assert.deepEqual([element.x, element.y, element.width], [0, 0, 400]);
});
test('shrinking a section keeps every child inside', () => {
  const layout = clone(sampleLayout);const parent = layout.elements.find(e => e.id === 'metric-0');
  parent.width = 150;parent.height = 100;constrain(layout, parent);
  for (const child of layout.elements.filter(e => e.parentId === parent.id)) {
    assert.ok(child.x + child.width <= parent.width);assert.ok(child.y + child.height <= parent.height);
  }
});
test('duplicated sections get independent children and content', () => {
  const layout = clone(sampleLayout);const copy = duplicateElement(layout, 'metric-0');
  assert.notEqual(copy.id, 'metric-0');
  const children = layout.elements.filter(e => e.parentId === copy.id);assert.equal(children.length, 2);
  children[0].content.runs[0].text = 'Changed';
  assert.equal(layout.elements.find(e => e.id === 'metric-title-0').content.runs[0].text, 'Revenue');
});
test('deleting a section removes descendants but preserves siblings', () => {
  const layout = clone(sampleLayout);removeElement(layout, 'metric-0');
  assert.equal(layout.elements.length, sampleLayout.elements.length - 3);
  assert.ok(!layout.elements.some(e => e.parentId === 'metric-0'));
  assert.ok(layout.elements.some(e => e.id === 'metric-1'));
});
test('all sample elements start within their containers', () => {
  const layout = clone(sampleLayout);
  for (const e of layout.elements) {const before = clone(e);constrain(layout, e);assert.deepEqual(e, before);}
});

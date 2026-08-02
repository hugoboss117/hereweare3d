import { SceneManager } from './core/SceneManager.js';
import { Hud } from './core/Hud.js';
import { SpaceChapter } from './chapters/SpaceChapter.js';
import { OceanChapter } from './chapters/OceanChapter.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');
const navButtons = document.querySelectorAll('#chapter-nav button');

const hud = new Hud({
  labelEl: document.getElementById('chapter-label'),
  promptEl: document.getElementById('prompt'),
  actionEl: document.getElementById('action-btn'),
});

const manager = new SceneManager(canvas);

const space = new SpaceChapter(manager.renderer, hud);
const ocean = new OceanChapter(manager.renderer, hud);

manager.register('space', space);
manager.register('ocean', ocean);

function setActiveChapter(id) {
  manager.setActive(id);
  for (const btn of navButtons) {
    btn.classList.toggle('active', btn.dataset.chapter === id);
  }
}

for (const btn of navButtons) {
  btn.addEventListener('click', () => setActiveChapter(btn.dataset.chapter));
}

setActiveChapter('space');
manager.start();

requestAnimationFrame(() => {
  loading.classList.add('hidden');
});

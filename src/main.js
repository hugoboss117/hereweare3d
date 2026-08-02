import { SceneManager } from './core/SceneManager.js';
import { Hud } from './core/Hud.js';
import { SpaceChapter } from './chapters/SpaceChapter.js';
import { LandChapter } from './chapters/LandChapter.js';
import { PeopleChapter } from './chapters/PeopleChapter.js';
import { TimeChapter } from './chapters/TimeChapter.js';
import { SkyChapter } from './chapters/SkyChapter.js';
import { OceanChapter } from './chapters/OceanChapter.js';
import { NatureChapter } from './chapters/NatureChapter.js';
import { KindnessChapter } from './chapters/KindnessChapter.js';

const canvas = document.getElementById('scene');
const loading = document.getElementById('loading');
const navButtons = document.querySelectorAll('#chapter-nav button');

const hud = new Hud({
  labelEl: document.getElementById('chapter-label'),
  promptEl: document.getElementById('prompt'),
  actionEl: document.getElementById('action-btn'),
});

const manager = new SceneManager(canvas);

function setActiveChapter(id) {
  manager.setActive(id);
  for (const btn of navButtons) {
    btn.classList.toggle('active', btn.dataset.chapter === id);
  }
}

manager.register('space', new SpaceChapter(manager.renderer, hud));
manager.register('land', new LandChapter(manager.renderer, hud));
manager.register('people', new PeopleChapter(manager.renderer, hud));
manager.register('time', new TimeChapter(manager.renderer, hud));
manager.register('sky', new SkyChapter(manager.renderer, hud));
manager.register('ocean', new OceanChapter(manager.renderer, hud));
manager.register('nature', new NatureChapter(manager.renderer, hud));
manager.register('kindness', new KindnessChapter(manager.renderer, hud, () => setActiveChapter('space')));

for (const btn of navButtons) {
  btn.addEventListener('click', () => setActiveChapter(btn.dataset.chapter));
}

setActiveChapter('space');
manager.start();

requestAnimationFrame(() => {
  loading.classList.add('hidden');
});

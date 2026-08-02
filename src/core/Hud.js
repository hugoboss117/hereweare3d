export class Hud {
  constructor({ labelEl, promptEl, actionEl }) {
    this.labelEl = labelEl;
    this.promptEl = promptEl;
    this.actionEl = actionEl;
    this._actionHandler = null;

    this.actionEl.addEventListener('click', () => this._actionHandler?.());
  }

  setLabel(text) {
    this.labelEl.textContent = text ?? '';
  }

  setPrompt(text) {
    this.promptEl.textContent = text ?? '';
    this.promptEl.classList.toggle('visible', Boolean(text));
  }

  setAction(label, handler) {
    if (!label) {
      this.actionEl.classList.remove('visible');
      this._actionHandler = null;
      return;
    }
    this.actionEl.textContent = label;
    this.actionEl.classList.add('visible');
    this._actionHandler = handler;
  }
}

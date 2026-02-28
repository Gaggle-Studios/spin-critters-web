import { Application, Container } from 'pixi.js';

export class PixiBattleApp {
  app: Application;
  private _destroyed = false;

  constructor() {
    this.app = new Application();
  }

  get stage(): Container {
    return this.app.stage;
  }

  async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
    await this.app.init({
      canvas,
      width,
      height,
      backgroundColor: 0x0d0d1a,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });
  }

  resize(width: number, height: number): void {
    if (this._destroyed) return;
    this.app.renderer.resize(width, height);
  }

  get destroyed(): boolean {
    return this._destroyed;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.app.destroy(false, { children: true, texture: false, textureSource: false });
  }
}

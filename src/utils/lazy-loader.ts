/**
 * 延遲載入工具 - 支援模組的按需載入以減少啟動時間和記憶體使用
 */

type LazyFactory<T> = () => Promise<T>;

interface LazyModuleOptions {
  onLoadError?: (error: Error) => void;
}

export class LazyModule<T> {
  private instance: T | null = null;
  private loadPromise: Promise<T> | null = null;
  private factory: LazyFactory<T>;
  private options: LazyModuleOptions;

  constructor(factory: LazyFactory<T>, options: LazyModuleOptions = {}) {
    this.factory = factory;
    this.options = options;
  }

  async get(): Promise<T> {
    if (this.instance) {
      return this.instance;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.load();
    return this.loadPromise;
  }

  private async load(): Promise<T> {
    try {
      this.instance = await this.factory();
      return this.instance;
    } catch (error) {
      this.loadPromise = null;
      if (this.options.onLoadError) {
        this.options.onLoadError(error as Error);
      }
      throw error;
    }
  }

  isLoaded(): boolean {
    return this.instance !== null;
  }

  unload(): void {
    this.instance = null;
    this.loadPromise = null;
  }
}

export function createLazyModule<T>(factory: LazyFactory<T>, options?: LazyModuleOptions): LazyModule<T> {
  return new LazyModule(factory, options);
}

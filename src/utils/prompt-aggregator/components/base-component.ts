/**
 * 提示詞組件基礎類別
 */
import type { IPromptComponent, PromptContext } from '../../../types/ai-provider.js';

export abstract class BasePromptComponent implements IPromptComponent {
    protected readonly name: string;
    protected readonly order: number;

    constructor(name: string, order: number) {
        this.name = name;
        this.order = order;
    }

    getName(): string {
        return this.name;
    }

    getOrder(): number {
        return this.order;
    }

    abstract build(context: PromptContext): string | null;
}

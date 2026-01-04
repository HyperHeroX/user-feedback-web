/**
 * 提示詞組件基礎類別
 */
import type { IPromptComponent, PromptContext } from '../../../types/ai-provider.js';
export declare abstract class BasePromptComponent implements IPromptComponent {
    protected readonly name: string;
    protected readonly order: number;
    constructor(name: string, order: number);
    getName(): string;
    getOrder(): number;
    abstract build(context: PromptContext): string | null;
}
//# sourceMappingURL=base-component.d.ts.map
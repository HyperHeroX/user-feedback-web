export class BasePromptComponent {
    name;
    order;
    constructor(name, order) {
        this.name = name;
        this.order = order;
    }
    getName() {
        return this.name;
    }
    getOrder() {
        return this.order;
    }
}
//# sourceMappingURL=base-component.js.map
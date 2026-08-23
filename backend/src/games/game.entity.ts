export type GameAttributes = {
    id: string;
    name: string;
};

export class GameEntity {
    id: string;
    name: string;

    constructor(attrs: GameAttributes) {
        this.id = attrs.id;
        this.name = attrs.name;
    }

    toPublicData() {
        return {
            id: this.id, 
            name: this.name,
        };
    }
}

export type UserAttributes = {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
};

export class UserEntity {
    id: string;
    username: string;
    email: string;
    passwordHash: string;

    constructor(attrs: UserAttributes) {
        this.id = attrs.id;
        this.username = attrs.username;
        this.email = attrs.email;
        this.passwordHash = attrs.passwordHash;
    }
 
    toPublicData() {
        return {
            id: this.id, 
            username: this.username, 
            email: this.email,
        };
    }
}

export type UserAttributes = {
    id: string;
    username: string;
    email: string;
    avatar: string;
    passwordHash: string;
};

export type PublicUserData = Omit<UserAttributes, 'passwordHash'>;

export class UserEntity {
    id: string;
    username: string;
    email: string;
    avatar: string;
    passwordHash: string;

    constructor(attrs: UserAttributes) {
        this.id = attrs.id;
        this.username = attrs.username;
        this.email = attrs.email;
        this.avatar = attrs.avatar;
        this.passwordHash = attrs.passwordHash;
    }
 
    toPublicData(): PublicUserData {
        return {
            id: this.id, 
            username: this.username, 
            email: this.email,
            avatar: this.avatar,
        };
    }
}

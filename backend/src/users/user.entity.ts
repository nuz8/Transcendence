export type UserAttributes = {
    id: string;
    username: string;
    email: string;
    avatar: string;
    passwordHash: string;
    xp: number;
};

export type PublicUserData = Omit<UserAttributes, 'passwordHash' | 'xp'>;

export class UserEntity {
    id: string;
    username: string;
    email: string;
    avatar: string;
    passwordHash: string;
    xp: number;

    constructor(attrs: UserAttributes) {
        this.id = attrs.id;
        this.username = attrs.username;
        this.email = attrs.email;
        this.avatar = attrs.avatar;
        this.passwordHash = attrs.passwordHash;
        this.xp = attrs.xp;
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

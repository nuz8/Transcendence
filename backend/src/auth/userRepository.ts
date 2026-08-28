import { User } from "./types";

export interface UserRepository {
    findByEmail(email: string): Promise<User | null>;
}
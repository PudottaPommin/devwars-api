import { Column, Entity, OneToMany, OneToOne } from 'typeorm';
import { isArray, isNil } from 'lodash';

import BaseModel from './BaseModel';
import LinkedAccount from './LinkedAccount';
import Activity from './Activity';
import UserProfile from './UserProfile';
import UserStats from './UserStats';
import EmailVerification from './EmailVerification';
import GameApplication from './GameApplication';

import EmailOptIn from './EmailOptIn';
import PasswordReset from './PasswordReset';
import UserGameStats from './UserGameStats';

export enum UserRole {
    PENDING = 'PENDING',
    USER = 'USER',
    MODERATOR = 'MODERATOR',
    ADMIN = 'ADMIN',
}

@Entity('user')
export default class User extends BaseModel {
    @Column()
    public lastSignIn: Date;

    @Column({ unique: true })
    public email: string;

    @Column({ unique: true })
    public username: string;

    @Column()
    public password: string;

    @Column()
    public role: UserRole;

    @Column({ nullable: true })
    public token: string;

    @Column({ nullable: true })
    public avatarUrl: string;

    // ------------------------------------------------------------
    // Relations

    @OneToOne(() => UserProfile, (user) => user.user)
    public profile: UserProfile;

    @OneToOne(() => UserStats, (stats) => stats.user)
    public stats: UserStats;

    @OneToOne(() => UserGameStats, (stats) => stats.user)
    public gameStats: UserGameStats;

    @OneToOne(() => EmailVerification)
    public verification: EmailVerification;

    @OneToOne(() => EmailOptIn)
    public emailOptIn: EmailOptIn;

    @OneToOne(() => PasswordReset)
    public passwordReset: PasswordReset;

    @OneToMany(() => Activity, (activities) => activities.user)
    public activities: Activity;

    @OneToMany(() => GameApplication, (applications) => applications.user)
    public applications: GameApplication[];

    @OneToMany(() => LinkedAccount, (accounts) => accounts.user)
    public connections: LinkedAccount[];

    /**
     * Creates a new instance of the user model.
     * @param username The username of the user.
     * @param password The already hashed password of the user.
     * @param email The email of the user.
     * @param role The role of the user.
     */
    constructor(username?: string, password?: string, email?: string, role?: UserRole) {
        super();

        this.username = username;
        this.password = password;
        this.email = email;
        this.role = role;
    }

    /**
     * Removes a collection of properties from the current user.
     * @param fields The fields (not including password, token) that is also being removed.
     */
    public sanitize(...fields: string[]): User {
        if (isNil(fields) || !isArray(fields)) fields = [];

        fields.push('password', 'token');
        const user = { ...this };

        // remove all the properties specified in the fields list. Ensuring to also delete the users
        // password and token regardless if the user also specified it in the fields listings.
        for (const field of fields) {
            delete user[field as keyof User];
        }

        return user;
    }

    public toJSON(): User {
        const user = { ...this };

        for (const field of ['token', 'password']) {
            delete user[field as keyof User];
        }

        return user;
    }
}

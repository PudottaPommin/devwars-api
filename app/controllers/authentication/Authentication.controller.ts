import * as bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { getManager, getCustomRepository } from 'typeorm';
import * as _ from 'lodash';

import EmailVerification from '../../models/EmailVerification';
import User, { UserRole } from '../../models/User';
import PasswordReset from '../../models/PasswordReset';

import UserRepository from '../../repository/User.repository';
import PasswordResetRepository from '../../repository/PasswordReset.repository';

import LoginRequest from '../../request/LoginRequest';
import RegistrationRequest from '../../request/RegistrationRequest';
import { AuthService } from '../../services/Auth.service';
import { VerificationService } from '../../services/Verification.service';
import { ResetService } from '../../services/Reset.service';
import { RESERVED_USERNAMES } from '../../constants';
import { hash } from '../../utils/hash';

import { AuthorizedRequest } from '../../request/IRequest';
import ApiError from '../../utils/apiError';

function flattenUser(user: User) {
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
    };
}
/**
 * Attempts to register a new user with the service, enforcing validation checks on the username,
 * password and email provided. If all process checks complete and are valid, new/unique, then a
 * welcome email will be sent out to introduce the new user.
 *
 * @api {post} /register Attempts to creates a new user with the service.
 * @apiVersion 1.0.0
 * @apiName Register
 * @apiGroup Authentication
 *
 * @apiSuccess {User} user The user of the newly created account.
 */
export async function register(request: Request, response: Response) {
    let { username, email, password }: RegistrationRequest = request.body;
    username = username.trim();
    password = password.trim();
    email = email.trim();

    const userRepository = getCustomRepository(UserRepository);
    const existingUser = await userRepository.findByUsernameOrEmail(username, email);

    if (existingUser && existingUser.username.toLowerCase() === username.toLowerCase()) {
        throw new ApiError({ error: 'A user already exists with the provided username.', code: 409 });
    }

    if (existingUser && existingUser.email.toLowerCase() === email.toLowerCase()) {
        throw new ApiError({ error: 'A user already exists with the provided email.', code: 409 });
    }

    if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
        throw new ApiError({ error: 'The specified username is reserved and cannot be registered.', code: 409 });
    }

    // Register the user in the database, generating a new user with the default and minimal stats /
    // settings for usage.
    const user = await AuthService.register({ username, email, password });

    // Gather and bind the new token for the newly registered user, removing the need for the user
    // to again login since they have "already" authenticated with the service with the registering
    // process.
    response.cookie('token', await AuthService.newToken(user), { domain: process.env.COOKIE_DOMAIN });
    response.json(flattenUser(user));
}

/**
 * @api {post} /auth/reverify Sends out a users verification email.
 * @apiDescription Goes through the verification process once again with the authenticated user with
 * the system. Only if the user is not already verified.
 * @apiVersion 1.0.0
 * @apiName Reverify
 * @apiGroup Authentication
 *
 * @apiSuccess {User} user The user of the newly created account.
 */
export async function reverify(request: AuthorizedRequest, response: Response) {
    // If the user is not in the pending state, return out early stating that its complete with the
    // status of already being verified. This is a edge case which is unlikely to be done through
    // standard user interaction.
    if (request.user.role !== UserRole.PENDING) {
        return response.json({ message: `${request.user.username} is already verified` });
    }

    await VerificationService.reset(request.user);
    return response.json({ message: 'Resent verification email.' });
}

export async function verify(request: Request, response: Response) {
    const { token } = request.query;

    // Gather the verification / user link based on the provided token in the query. ensuring to
    // keep the relation set otherwise no user will be on the return object.
    const verificationToken = await EmailVerification.findOne({
        relations: ['user'],
        where: { token },
    });

    // If no verification object could be found, then redirect the user back to the home page. this
    // will happen regardless but clearly defined redirect based on failed validation check will
    // ensure future understanding.
    if (_.isNil(verificationToken)) return response.redirect(process.env.FRONT_URL);

    // Update the user role, ensuring that they are now removed from the pending state and returned
    // or setup as a standard user, then updating the database with this change.
    const { user } = verificationToken;
    user.role = UserRole.USER;

    await getManager().transaction(async (transaction) => {
        await transaction.remove(verificationToken);
        await transaction.save(user);
    });

    response.redirect(process.env.FRONT_URL);
}

/**
 *
 * @api {post} /login Attempts to authenticate the provided user into the system.
 * @apiVersion 1.0.0
 * @apiName Login
 * @apiGroup Authentication
 *
 * @apiSuccess {User} user The user of the newly created account.
 */
export async function login(request: Request, response: Response) {
    const { identifier, password } = { ...(request.body as LoginRequest) };

    const userRepository = getCustomRepository(UserRepository);
    const user = await userRepository.findByCredentials({ identifier });

    // If the user does not exist by the provided credentials, then exist before continuing.
    // Ensuring that the user is aware that they are invalid and not able to login due to that
    // reason.
    if (_.isNil(user)) {
        throw new ApiError({
            error: 'The provided username or password is not correct.',
            code: 400,
        });
    }
    // Ensure that the password provided matches the encrypted password stored in the database, this
    // will be using the salt and hash with the secret in bcrypt.
    const passwordsMatch: boolean = await bcrypt.compare(password, user.password);

    // If the password does not match, ensure the user is told about the authentication failing.
    if (!passwordsMatch) {
        throw new ApiError({
            error: 'The provided username or password is not correct.',
            code: 400,
        });
    }

    const token = await AuthService.newToken(user);
    response.cookie('token', token, { domain: process.env.COOKIE_DOMAIN });

    user.lastSignIn = new Date();
    await user.save();

    response.json(flattenUser(user));
}

export async function logout(request: AuthorizedRequest, response: Response) {
    request.user.token = null;
    await User.save(request.user);

    response.cookie('token', null, { domain: process.env.COOKIE_DOMAIN });
    return response.send();
}

/**
 * Called into with a authenticated user, if valid and logged in as expected, the current
 * authenticated user will be returned.
 *
 * @api {get} /auth/user Returns the current authenticated user.
 * @apiVersion 1.0.0
 * @apiName UserGathering
 * @apiGroup Authentication
 *
 * @apiSuccess {User} user The user who is authenticated.
 */
export async function currentUser(request: AuthorizedRequest, response: Response) {
    return response.json(request.user);
}

/**
 * @api {post} /auth/reset/email Updates the current users email
 * @apiDescription Takes the specified users current password and new email. Ensures that the
 * password matches the current users password and that the new email meets the current system
 * requirements. If both are successful, the current authenticated users email is updated with
 * the new one. This will require email verification once again via email.
 *
 * @apiVersion 1.0.0
 * @apiName UpdateEmail
 * @apiGroup Email
 *
 * @apiParam {string} password The current users password.
 * @apiParam {string} email The new users email.
 *
 *  * @apiSuccessExample Success-Response: HTTP/1.1 200 OK
 *     {
 *      "message": "Email reset, a verification email has been sent.",
 *      "verification": true
 *     }
 */
export async function initiateEmailReset(request: AuthorizedRequest, response: Response) {
    const { password, email } = request.body;

    const passwordsMatch: boolean = await bcrypt.compare(password, request.user.password);
    if (!passwordsMatch) throw new ApiError({ code: 400, error: 'Password did not match.' });

    if (request.user.email.toLowerCase() === email.toLowerCase()) {
        throw new ApiError({
            error: 'The specified email address is already the assigned address.',
            code: 409,
        });
    }

    const userRepository = getCustomRepository(UserRepository);
    if (await userRepository.userExistsWithEmail(email)) {
        throw new ApiError({
            error: 'The specified email is already in use.',
            code: 409,
        });
    }

    await ResetService.resetEmail(request.user, email);
    const { role } = request.user;

    return response.json({
        message: 'Email reset, a verification email has been sent.',
        verification: role === UserRole.USER || role === UserRole.PENDING,
    });
}

export async function initiatePasswordReset(request: Request, response: Response) {
    const { username_or_email } = request.body;

    const userRepository = getCustomRepository(UserRepository);
    const user = await userRepository.findByCredentials({ identifier: username_or_email });
    if (!user) throw new ApiError({ code: 404, error: 'User not found.' });

    const passwordResetRepository = getCustomRepository(PasswordResetRepository);
    await passwordResetRepository.delete({ user });

    await AuthService.resetPassword(user);

    return response.json({ message: 'Reset password, check your email.' });
}

export async function resetPassword(request: Request, response: Response) {
    const { token, password } = request.query as { token: string; password: string };

    const passwordResetRepository = getCustomRepository(PasswordResetRepository);
    const passwordReset = await passwordResetRepository.findByToken(token);

    if (!passwordReset) throw new ApiError({ code: 400, error: 'Could not reset password' });

    if (Date.now() > passwordReset.expiresAt.getTime()) {
        throw new ApiError({ code: 401, error: 'Expired password reset token' });
    }

    const user = passwordReset.user;
    user.password = await hash(password);

    await getManager().transaction(async (transactionalEntityManager) => {
        await transactionalEntityManager.delete(PasswordReset, passwordReset.id);
        await transactionalEntityManager.save(user);
    });

    return response.json({ message: 'Password reset!' });
}

/**
 * @api {put} /auth/reset/password Updates the current users password
 * @apiDescription Takes the specified users old and new password. Ensures that the old password
 * matches the current users password and that the new password meets the current system
 * requirements. If Both are successful, the current authenticated users password is updated with
 * the new one.
 *
 * @apiVersion 1.0.0
 * @apiName UpdatePassword
 * @apiGroup Password
 *
 * @apiParam {string} oldPassword The current users password.
 * @apiParam {string} newPassword The new users password.
 *
 *  * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *      "message": "Password successfully updated.",
 *     }
 */
export async function updatePassword(request: AuthorizedRequest, response: Response) {
    const { oldPassword, newPassword }: { oldPassword: string; newPassword: string } = request.body;

    // Ensure that the password provided matches the encrypted password stored in the database, this
    // will be using the salt and hash with the secret in bcrypt.
    const passwordsMatch: boolean = await bcrypt.compare(oldPassword, request.user.password);

    // If the password does not match, ensure the user is told about the authentication failing.
    if (!passwordsMatch) {
        throw new ApiError({
            error: 'The provided current password is not correct.',
            code: 400,
        });
    }

    request.user.password = await hash(newPassword);
    await request.user.save();

    return response.send({ message: 'Password successfully updated.' });
}

/**
 * Returns true if the user is that role or higher, otherwise false.
 * @param user The user who's role is being checked.
 * @param expectedRole The expected lower bounds role of the given user.
 */
export function isRoleOrHigher(user: User, expectedRole: UserRole): boolean {
    if (
        [UserRole.MODERATOR, UserRole.USER, UserRole.PENDING].includes(expectedRole) &&
        [UserRole.ADMIN, UserRole.MODERATOR].includes(user.role)
    )
        return true;

    if (expectedRole === UserRole.ADMIN && user.role === UserRole.ADMIN) return true;

    return false;
}

/**
 * Returns true if the user is higher, otherwise false.
 * @param user The user who's role is being checked.
 * @param expectedRole The expected lower bounds role of the given user.
 */
export function isRoleHigher(user: User, expectedRole: UserRole): boolean {
    // if the user is a admin and the role is moderator, then the user is
    // higher, otherwise if the expected role ia a admin, no one is higher, so
    // false.
    if (expectedRole === UserRole.MODERATOR && user.role === UserRole.ADMIN) return true;
    if (expectedRole === UserRole.ADMIN) return false;

    // if the expected role is a user or pending, then the user has to be a
    // moderator or higher.
    if (
        (expectedRole === UserRole.USER || expectedRole === UserRole.PENDING) &&
        isRoleOrHigher(user, UserRole.MODERATOR)
    )
        return true;

    return false;
}

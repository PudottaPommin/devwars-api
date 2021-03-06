import { Response } from 'express';
import * as _ from 'lodash';

import UserProfile from '../../models/UserProfile';
import { ProfileRequest } from '../../request/ProfileRequest';
import { UserRequest } from '../../request/IRequest';
import ApiError from '../../utils/apiError';

/**
 * @api {get} /users/:userId/profile Get all of the profile information for a certain user.
 * @apiName GetProfileforUser
 * @apiGroup User
 * @apiPermission Moderator, Owner
 *
 * @apiParam {string} id The id of a certain user.
 *
 * @apiSuccess {object} profile An object containing all of the profile properties.
 * @apiSuccess {number} id The id of the user.
 * @apiSuccess {datetime} updatedAt When the profile was last updated.
 * @apiSuccess {datetime} createdAt When the profile was created.
 * @apiSuccess {string} firstName The first name of the user.
 * @apiSuccess {string} lastName The last name of the user.
 * @apiSuccess {string} dob The birthday of the user.
 * @apiSuccess {string} sex The sex of the user.
 * @apiSuccess {string} about Description of the user.
 * @apiSuccess {boolean} forHire If the user is available for hire.
 * @apiSuccess {string} company The company the user works for.
 * @apiSuccess {string} websiteUrl The website of the user.
 * @apiSuccess {string} addressOne The primary address of the user.
 * @apiSuccess {string} addressTwo The secondary address of the user.
 * @apiSuccess {string} city The city of the user.
 * @apiSuccess {string} state The state of the user.
 * @apiSuccess {string} zip The zip of the user.
 * @apiSuccess {string} country The country of the user.
 * @apiSuccess {object} skills The skills of the user.
 * @apiSuccess {number} js The js skill of the user.
 * @apiSuccess {number} css The css skill of the user.
 * @apiSuccess {number} html The html skill of the user.
 *
 * @apiSuccessExample Success-Response:
 *      {
 *       "id": 1,
 *       "updatedAt": "2019-12-31T17:00:00.000Z",
 *       "createdAt": "2019-12-31T17:00:00.000Z",
 *       "firstName": "John",
 *       "lastName": "Doe",
 *       "dob": "1998-11-14T00:00:00.000Z",
 *       "sex": null,
 *       "about": "I love to code.",
 *       "forHire": true,
 *       "company": null,
 *       "websiteUrl": null,
 *       "addressOne": null,
 *       "addressTwo": null,
 *       "city": "",
 *       "state": "New York",
 *       "zip": null,
 *       "country": null,
 *       "skills": {
 *           "js": 4,
 *           "css": 5,
 *           "html": 5
 *       }
 *      }
 */
export async function show(request: UserRequest, response: Response) {
    const profile = await UserProfile.findOne({ where: { user: request.boundUser.id } });

    if (_.isNil(profile)) {
        throw new ApiError({
            error: `The specified user ${request.boundUser.username} does not have a profile`,
            code: 404,
        });
    }

    return response.json(profile);
}

/**
 * @api {patch} /users/:userId/profile Updates the profile information for a certain user.
 * @apiName UpdateProfileforUser
 * @apiGroup User
 * @apiPermission Administrator, Owner
 *
 * @apiParam {string} [firstName] The first name of the user.
 * @apiParam {string} [lastName] The last name of the user.
 * @apiParam {string} [dob] The birthday of the user.
 * @apiParam {string} [sex] The sex of the user.
 * @apiParam {string} [about] Description of the user.
 * @apiParam {boolean} [forHire] If the user is available for hire.
 * @apiParam {string} [company] The company the user works for.
 * @apiParam {string} [websiteUrl] The website of the user.
 * @apiParam {string} [addressOne] The primary address of the user.
 * @apiParam {string} [addressTwo] The secondary address of the user.
 * @apiParam {string} [city] The city of the user.
 * @apiParam {string} [state] The state of the user.
 * @apiParam {string} [zip] The zip of the user.
 * @apiParam {string} [country] The country of the user.
 * @apiParam {object} [skills] The skills of the user.
 * @apiParam {number} [js] The js skill of the user.
 * @apiParam {number} [css] The css skill of the user.
 * @apiParam {number} [html] The html skill of the user.
 *
 *
 * @apiParamExample {json} Request-Example:
 *      {
 *          "firstName": "Jack",
 *          "lastName": "DuPont",
 *          "dob": "1-10-2020",
 *          "skills": {
 *              "html": 5,
 *              "css": 2,
 *              "js": 3,
 *          },
 *      }
 *
 * @apiSuccess {string} firstName The first name of the user.
 * @apiSuccess {string} lastName The last name of the user.
 * @apiSuccess {string} dob The birthday of the user.
 * @apiSuccess {string} sex The sex of the user.
 * @apiSuccess {string} about Description of the user.
 * @apiSuccess {boolean} forHire If the user is available for hire.
 * @apiSuccess {string} company The company the user works for.
 * @apiSuccess {string} websiteUrl The website of the user.
 * @apiSuccess {string} addressOne The primary address of the user.
 * @apiSuccess {string} addressTwo The secondary address of the user.
 * @apiSuccess {string} city The city of the user.
 * @apiSuccess {string} state The state of the user.
 * @apiSuccess {string} zip The zip of the user.
 * @apiSuccess {string} country The country of the user.
 * @apiSuccess {object} skills The skills of the user.
 * @apiSuccess {number} skills.js The js skill of the user.
 * @apiSuccess {number} skills.css The css skill of the user.
 * @apiSuccess {number} skills.html The html skill of the user.
 *
 * @apiSuccessExample {json} Success-Response:
 *      {
 *       "firstName": "Jack",
 *       "lastName": "Dupont",
 *       "dob": "2020-1-10T00:00:00.000Z",
 *       "sex": "",
 *       "about": "",
 *       "forHire": false,
 *       "company": "",
 *       "websiteUrl": "",
 *       "addressOne": "",
 *       "addressTwo": "",
 *       "city": "",
 *       "state": "",
 *       "zip": "",
 *       "country": "",
 *       "skills": {
 *           "html": 5,
 *           "css": 2,
 *           "js": 3,
 *      }
 *      }
 */

export async function update(request: UserRequest, response: Response) {
    const params: any = { ...(request.body as ProfileRequest) };
    const profile: any = await UserProfile.findOne({ where: { user: request.boundUser.id } });

    if (_.isNil(profile)) {
        throw new ApiError({
            error: `The specified user ${request.boundUser.username} does not have a profile`,
            code: 404,
        });
    }

    Object.keys(profile).map((k) => {
        if (!_.isNil(params[k])) profile[k] = params[k];
    });

    const updatedProfile = await UserProfile.save(profile);
    return response.json(updatedProfile);
}

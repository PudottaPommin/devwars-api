import { Request, Response, NextFunction } from 'express';
import { isNil, isNumber } from 'lodash';

import logger from '../utils/logger';
import ApiError from '../utils/apiError';
import { AuthService } from '../services/Auth.service';

/**
 *  Handles catches in which the next response of a given controller is a error
 *  but was not caught by anything. Ensuring that regardless of the result, that
 *  the user still gets a response back from the server.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handleError(error: any, request: Request, response: Response, next: NextFunction) {
    const apiError = error as ApiError;

    // If specified or ont a api error, log the error.
    if (!(error instanceof ApiError) || (!isNil(apiError.code) && apiError.log)) {
        const { protocol, originalUrl } = request;

        const message = ['test', 'development'].includes(process.env.NODE_ENV) ? error.stack : error;
        logger.error(`error on request: ${protocol}://${request.get('host')}${originalUrl}, ${message}`);
    }

    // If we have thrown a instance of a apiError and it was not a 500, then process the
    // expected error message with the expected code + error message.
    if (!isNil(apiError.code) && isNumber(apiError.code)) {
        return response.status(apiError.code).json({ error: apiError.message });
    }

    // if we are in production and a internal server error occurs, just let the user know. We
    // don't want to be exposing any additional information that would help someone trying to
    // gather internal information about the system. But during development, ignore this and
    // send back the error and the stack that caused it.
    if (process.env.NODE_ENV === 'production') {
        return response.sendStatus(500).json({ error: 'Internal server error, something went wrong.' });
    }

    return response.status(500).json({ error: error.message, stack: error.stack });
}

/**
 * Handles cases in which the route does not exist, e.g /authentication/missing
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function handleMissing(request: Request, response: Response, next: NextFunction) {
    const { token } = request.cookies;

    // If the user who has been redirected to a invalid endpoint that does not
    // exist for any reason and that user is not authenticated, just respond as
    // if they are not authenticated, otherwise return 404 (not found).
    if (isNil(token) || isNil(AuthService.VerifyAuthenticationToken(token))) return response.status(401).send();
    return response.status(404).send();
}

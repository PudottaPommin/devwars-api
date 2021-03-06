import * as express from 'express';
import { wrapAsync } from './handlers';

import * as SearchController from '../controllers/search.controller';
import { mustBeMinimumRole, mustBeAuthenticated } from '../middleware/Auth.middleware';
import { UserRole } from '../models/User';

export const SearchRoute: express.Router = express
    .Router()
    .get(
        '/users',
        [mustBeAuthenticated, mustBeMinimumRole(UserRole.MODERATOR)],
        wrapAsync(SearchController.lookupUser)
    );

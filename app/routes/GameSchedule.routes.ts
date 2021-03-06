import * as express from 'express';

import * as GameScheduleController from '../controllers/game/GameSchedule.controller';
import { mustBeMinimumRole, mustBeAuthenticated } from '../middleware/Auth.middleware';
import { wrapAsync } from './handlers';
import { UserRole } from '../models/User';
import { bodyValidation } from './validators';
import { createGameScheduleSchema, updateGameScheduleSchema } from './validators/gameSchedule.validator';
import { bindScheduleFromScheduleParam } from '../middleware/GameSchedule.middleware';

const GameScheduleRoute: express.Router = express.Router();

GameScheduleRoute.get('/', wrapAsync(GameScheduleController.all));

GameScheduleRoute.post(
    '/',
    [mustBeAuthenticated, mustBeMinimumRole(UserRole.MODERATOR), bodyValidation(createGameScheduleSchema)],
    wrapAsync(GameScheduleController.create)
);

GameScheduleRoute.get('/latest', wrapAsync(GameScheduleController.latest));
GameScheduleRoute.get('/:schedule', [bindScheduleFromScheduleParam], wrapAsync(GameScheduleController.show));

GameScheduleRoute.patch(
    '/:schedule',
    [
        mustBeAuthenticated,
        mustBeMinimumRole(UserRole.MODERATOR),
        bindScheduleFromScheduleParam,
        bodyValidation(updateGameScheduleSchema),
    ],
    wrapAsync(GameScheduleController.update)
);

GameScheduleRoute.delete(
    '/:schedule',
    [mustBeAuthenticated, mustBeMinimumRole(UserRole.MODERATOR), bindScheduleFromScheduleParam],
    wrapAsync(GameScheduleController.deleteScheduleById)
);

GameScheduleRoute.post(
    '/:schedule/end',
    [mustBeAuthenticated, mustBeMinimumRole(UserRole.MODERATOR), bindScheduleFromScheduleParam],
    wrapAsync(GameScheduleController.endScheduleById)
);

GameScheduleRoute.post(
    '/:schedule/activate',
    [mustBeAuthenticated, mustBeMinimumRole(UserRole.MODERATOR), bindScheduleFromScheduleParam],
    wrapAsync(GameScheduleController.activate)
);

GameScheduleRoute.get('/status/:status', wrapAsync(GameScheduleController.byStatus));

export { GameScheduleRoute };

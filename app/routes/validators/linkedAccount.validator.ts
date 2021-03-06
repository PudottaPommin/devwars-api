import * as Joi from '@hapi/joi';

import * as constants from '../../constants';

const updates = Joi.object()
    .keys({
        twitchUser: Joi.object()
            .keys({
                username: Joi.string()
                    .min(constants.TWITCH_USERNAME_MIN_LENGTH)
                    .max(constants.TWITCH_USERNAME_MAX_LENGTH),

                id: Joi.alternatives(Joi.string().min(0), Joi.number()),
            })
            .or('username', 'id')
            .required(),

        amount: Joi.number()
            .min(constants.TWITCH_COINS_MIN_UPDATE)
            .max(constants.TWITCH_COINS_MAX_UPDATE)
            .required(),
    })
    .unknown(true);

export const updateTwitchCoinsSchema = Joi.object()
    .keys({
        updates: Joi.array()
            .items(updates)
            .required(),

        apiKey: Joi.string().optional(),
    })
    .unknown(true);

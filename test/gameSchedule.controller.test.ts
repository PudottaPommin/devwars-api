import { EntityManager, getCustomRepository, getManager } from 'typeorm';
import * as supertest from 'supertest';
import * as chai from 'chai';
import * as _ from 'lodash';

import { Connection } from '../app/services/Connection.service';
import ServerService from '../app/services/Server.service';

import { GameScheduleSeeding, GameSeeding, UserSeeding } from '../app/seeding';
import { cookieForUser } from './helpers';

import GameRepository from '../app/repository/Game.repository';
import GameSchedule, { GameStatus } from '../app/models/GameSchedule';
import GameScheduleRepository from '../app/repository/GameSchedule.repository';
import { UserRole } from '../app/models/User';

const server: ServerService = new ServerService();
let agent: any;

// Used for the creation of the database transactions without the need of constantly calling into
// get manager every time a test needs a transaction.
const connectionManager: EntityManager = getManager();

describe('Game-Schedule', () => {
    before(async () => {
        await server.Start();
        await (await Connection).synchronize(true);
    });

    beforeEach(() => {
        agent = supertest.agent(server.App());
    });

    afterEach(async () => {
        const scheduleRepository = getCustomRepository(GameScheduleRepository);
        const gameRepository = getCustomRepository(GameRepository);

        await gameRepository.delete({});
        await scheduleRepository.delete({});
    });

    describe('GET - /schedules - Gathering all schedules', () => {
        it('Should retrieve all schedules', async () => {
            const scheduleOne = GameScheduleSeeding.default().gameSchedule;
            const scheduleTwo = GameScheduleSeeding.default().gameSchedule;

            await connectionManager.transaction(async (transaction) => {
                await transaction.save(scheduleOne);
                await transaction.save(scheduleTwo);
            });

            const response = await agent.get('/schedules').send();
            chai.expect(response.body.length).to.be.equal(2);
        });
    });

    describe('GET - /schedules/latest - Gathering the latest game schedule', () => {
        it('Should return the last schedule created', async () => {
            const currentDate = new Date();
            const futureDate = new Date();

            futureDate.setHours(currentDate.getHours() + 2);

            const scheduleOne = GameScheduleSeeding.default().withStartTime(currentDate).gameSchedule;
            const scheduleTwo = GameScheduleSeeding.default().withStartTime(futureDate).gameSchedule;

            await connectionManager.transaction(async (transaction) => {
                transaction.save(scheduleTwo);
                transaction.save(scheduleOne);
            });

            const response = await agent.get('/schedules/latest').send().expect(200);

            chai.expect(response.body.id).to.be.eq(scheduleTwo.id);
        });
    });

    describe('GET - /schedules/:id - Gathering a single game schedule', () => {
        it('Should retrieve the schedule if specified', async () => {
            const schedule = await GameScheduleSeeding.default().save();

            const response = await agent.get(`/schedules/${schedule.id}`).expect(200);
            chai.expect(response.body.id).to.be.eq(schedule.id);
        });

        it('Should return 404 because no schedule is found', async () => {
            await agent.get('/schedules/3').send().expect(404);
        });
    });

    describe('POST - /schedules - Creating a new game schedule', () => {
        it('Should return 403 because user cant create a schedule.', async () => {
            const user = await UserSeeding.withRole(UserRole.USER).save();
            const schedule = GameScheduleSeeding.default().gameSchedule;

            await agent
                .post('/schedules')
                .set('Cookie', await cookieForUser(user))
                .send(Object.assign(schedule, { mode: schedule.setup.mode }))
                .expect(403);
        });

        it('Should allow creating schedule as admin or moderator.', async () => {
            for (const role of [UserRole.MODERATOR, UserRole.ADMIN]) {
                const user = await UserSeeding.withRole(role).save();
                const schedule = GameScheduleSeeding.default().gameSchedule;

                const goodRequest = await agent
                    .post('/schedules')
                    .set('Cookie', await cookieForUser(user))
                    .send(Object.assign(schedule, { mode: schedule.setup.mode }))
                    .expect(200);

                const ScheduleCreated = await GameSchedule.findOne(goodRequest.body.id);

                chai.expect(!_.isNil(ScheduleCreated) && !_.isNil(ScheduleCreated.setup)).to.be.eq(true);
                chai.expect(ScheduleCreated.setup.title).to.be.eq(goodRequest.body.title);
            }
        });
    });

    describe('PATCH - /schedules/:id - updating a existing game schedule', () => {
        it('Should return 403 because user cant update a schedule', async () => {
            const Schedule = await GameScheduleSeeding.default().save();
            const user = await UserSeeding.withRole(UserRole.USER).save();


            await agent
                .patch(`/schedules/${Schedule.id}`)
                .set('Cookie', await cookieForUser(user))
                .expect(403);
        });

        it('Should return the schedules update because mod', async () => {
            const Schedule = await GameScheduleSeeding.default().save();

            const user = await UserSeeding.withRole(UserRole.MODERATOR).save();
            const updateData = {
                title: 'helloWorld',
            };

            const request = await agent
                .patch(`/schedules/${Schedule.id}`)
                .set('Cookie', await cookieForUser(user))
                .send(updateData);

            const ScheduleUpdated = await GameSchedule.findOne(request.body.id);
            chai.expect(ScheduleUpdated.setup.title).to.be.eq(updateData.title);
        });

        it('Should return the schedules update because admin', async () => {
            const Schedule = await GameScheduleSeeding.default().save();

            const user = await UserSeeding.withRole(UserRole.ADMIN).save();
            const updateData = {
                title: 'helloWorld',
            };

            const request = await agent
                .patch(`/schedules/${Schedule.id}`)
                .set('Cookie', await cookieForUser(user))
                .send(updateData);

            const ScheduleUpdated = await GameSchedule.findOne(request.body.id);
            chai.expect(ScheduleUpdated.setup.title).to.be.eq(updateData.title);
        });
    });

    describe('POST - /schedules/:id/end - end a game schedule by id', () => {
        it('Should fail if the given schedule does not exist', async () => {
            const user = await UserSeeding.withRole(UserRole.ADMIN).save();

            await agent
                .post('/schedules/999/end')
                .set('Cookie', await cookieForUser(user))
                .expect(404, { error: 'A game schedule does not exist for the given id.' });
        });

        it('Should fail if the user is a standard user', async () => {
            const schedule = await GameScheduleSeeding.default().withStatus(GameStatus.ACTIVE).save();
            const user = await UserSeeding.withRole(UserRole.USER).save();

            await agent
                .post(`/schedules/${schedule.id}/end`)
                .set('Cookie', await cookieForUser(user))
                .expect(403, { error: "Unauthorized, you currently don't meet the minimal requirement." });
        });

        it('Should fail if the schedule is not in a activate state', async () => {
            const schedule = await GameScheduleSeeding.default().withStatus(GameStatus.ENDED).save();
            const user = await UserSeeding.withRole(UserRole.ADMIN).save();

            await agent
                .post(`/schedules/${schedule.id}/end`)
                .set('Cookie', await cookieForUser(user))
                .expect(400, { error: 'Schedule cannot be ended since its not in a active state.' });
        });

        it('Should end if the user is a moderator or administrator', async () => {
            for (const role of [UserRole.ADMIN, UserRole.MODERATOR]) {
                const schedule = await GameScheduleSeeding.default().withStatus(GameStatus.SCHEDULED).save();
                const user = await UserSeeding.withRole(role).save();

                await agent
                    .post(`/schedules/${schedule.id}/end`)
                    .set('Cookie', await cookieForUser(user))
                    .expect(200);
            }
        });
    });

    describe('DELETE - /schedules/:id - deleting a game schedule by id', () => {
        it('Should fail if the given schedule does not exist', async () => {
            const user = await UserSeeding.withRole(UserRole.ADMIN).save();

            await agent
                .delete('/schedules/999')
                .set('Cookie', await cookieForUser(user))
                .expect(404, { error: 'A game schedule does not exist for the given id.' });
        });

        it('Should fail if the user is a standard user', async () => {
            const schedule = await GameScheduleSeeding.default().withStatus(GameStatus.SCHEDULED).save();
            const user = await UserSeeding.withRole(UserRole.USER).save();

            await agent
                .delete(`/schedules/${schedule.id}`)
                .set('Cookie', await cookieForUser(user))
                .expect(403, { error: "Unauthorized, you currently don't meet the minimal requirement." });
        });

        it('Should fail if the schedule is in activate state', async () => {
            const schedule = await GameScheduleSeeding.default().withStatus(GameStatus.ACTIVE).save();
            const user = await UserSeeding.withRole(UserRole.ADMIN).save();

            await agent
                .delete(`/schedules/${schedule.id}`)
                .set('Cookie', await cookieForUser(user))
                .expect(400, { error: 'Schedule cannot be deleted since its not in a scheduled state.' });
        });

        it('Should fail if the schedule has a related game', async () => {
            const game = await GameSeeding.default().save();
            await game.save();

            const schedule = await GameScheduleSeeding.default().withStatus(GameStatus.SCHEDULED).withGame(game).save();
            const user = await UserSeeding.withRole(UserRole.ADMIN).save();

            await agent
                .delete(`/schedules/${schedule.id}`)
                .set('Cookie', await cookieForUser(user))
                .expect(400, { error: 'Schedule cannot be deleted since it has a related game.' });
        });

        it('Should delete if the user is a moderator or administrator', async () => {
            for (const role of [UserRole.ADMIN, UserRole.MODERATOR]) {
                const schedule = await GameScheduleSeeding.default().withStatus(GameStatus.SCHEDULED).save();
                const user = await UserSeeding.withRole(role).save();

                await agent
                    .delete(`/schedules/${schedule.id}`)
                    .set('Cookie', await cookieForUser(user))
                    .expect(202);
            }
        });
    });

    describe('GET - /schedules/status/:status - Gathering schedules by status', () => {
        it('Should return a list of schedules by status', async () => {
            const gameStates = [GameStatus.ACTIVE, GameStatus.ACTIVE, GameStatus.ENDED, GameStatus.SCHEDULED];

            await connectionManager.transaction(async (transaction) => {
                for (const state of gameStates) {
                    const schedule = GameScheduleSeeding.default().withStatus(state).gameSchedule;
                    await transaction.save(schedule);
                }
            });

            const request = await agent.get('/schedules/status/active').expect(200);
            chai.expect(request.body).to.have.lengthOf(2);
        });
    });

    describe('POST - /schedules/:schedule/activate - Activating the schedule and creating the game', async () => {
        let user: any = null;
        let mod: any = null;
        let schedule: GameSchedule = null;

        beforeEach(async () => {
            user = await UserSeeding.withRole(UserRole.USER).save();
            mod = await UserSeeding.withRole(UserRole.MODERATOR).save();
            schedule = await GameScheduleSeeding.default().withStatus(GameStatus.SCHEDULED).save();
        });

        it('should fail if not authenticated as a moderator or higher', async () => {
            await agent.post(`/schedules/${schedule.id}/activate`).expect(401);

            await agent
                .post(`/schedules/${schedule.id}/activate`)
                .set('Cookie', await cookieForUser(user))
                .expect(403);

            await agent
                .post(`/schedules/${schedule.id}/activate`)
                .set('Cookie', await cookieForUser(mod))
                .expect(200);
        });

        it('should fail if the given schedule does not exist.', async () => {
            await agent
                .post('/schedules/999/activate')
                .set('Cookie', await cookieForUser(mod))
                .expect(404, {
                    error: 'A game schedule does not exist for the given id.',
                });
        });

        it('should fail if the schedule is not in a scheduled state', async () => {
            const expectedBody = {
                error: 'schedule cannot be activated since its not in a scheduled state.',
            };

            for (const updatedStatus of [GameStatus.ACTIVE, GameStatus.ENDED]) {
                schedule.status = updatedStatus;
                await schedule.save();

                await agent
                    .post(`/schedules/${schedule.id}/activate`)
                    .set('Cookie', await cookieForUser(mod))
                    .expect(400, expectedBody);
            }
        });

        it('should fail if the schedule already has a related game', async () => {
            await agent
                .post(`/schedules/${schedule.id}/activate`)
                .set('Cookie', await cookieForUser(mod))
                .expect(200);

            schedule.status = GameStatus.SCHEDULED;
            schedule.game = await GameSeeding.default().save();
            await schedule.save();

            await agent
                .post(`/schedules/${schedule.id}/activate`)
                .set('Cookie', await cookieForUser(mod))
                .expect(400, {
                    error: 'schedule cannot be activated since game already exists',
                });
        });

        it('should mark the schedule as active and allow game creation.', async () => {
            await agent
                .post(`/schedules/${schedule.id}/activate`)
                .set('Cookie', await cookieForUser(mod))
                .expect(200);

            const scheduleRepository = getCustomRepository(GameScheduleRepository);
            const updatedSchedule = await scheduleRepository.findById(schedule.id);

            chai.expect(updatedSchedule.id).to.be.eq(schedule.id);
            chai.expect(updatedSchedule.status).to.be.eq(GameStatus.ACTIVE);
        });
    });
});

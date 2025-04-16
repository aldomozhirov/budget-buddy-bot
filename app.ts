import 'dotenv/config';
import {Scenes, session, Telegraf, Telegram} from 'telegraf';
import { Poll, appendPoll, findActivePollByChatId } from './src/polls';
import {
    formatSummaryByCurrency,
    formatEquivalence,
    formatDate,
    formatPollDateTime, formatUserName
} from './src/formatters';
import { BudgetBuddyContext, BudgetBuddySession } from './src/types/session';
import { ChartScene } from './src/scenes/chart';
// @ts-ignore
import mexp from 'math-expression-evaluator';
import {Currency} from "current-currency/dist/types/currencies";
import {BudgetBuddyBotService} from "./src/service";
import {CreateVaultScene} from "./src/scenes/createVault";
import {EditVaultScene} from "./src/scenes/editVault";

const API_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const PORT = process.env.PORT || 3000;
const URL = process.env.URL || 'https://budget-buddy-bot.herokuapp.com';
const EQUIVALENCE_CURRENCY = (process.env.EQUIVALENCE_CURRENCY) as Currency || 'USD';
const STAGE_TTL = 100;

const telegram = new Telegram(process.env.TELEGRAM_BOT_TOKEN || '');
const bot = new Telegraf<BudgetBuddyContext>(process.env.TELEGRAM_BOT_TOKEN || '');

const service: BudgetBuddyBotService = new BudgetBuddyBotService();
const stage = new Scenes.Stage<BudgetBuddyContext>(
    [
        new ChartScene(bot, service, EQUIVALENCE_CURRENCY),
        new CreateVaultScene(service),
        new EditVaultScene(service)
    ],
    {
        ttl: STAGE_TTL
    }
);

bot.use(session());
bot.use(stage.middleware());
bot.use((ctx, next) => {
    ctx.session.isWaitingForCode ??= false;
    return next();
});

const sendQuestion = async (session: BudgetBuddySession, chatId: number, text: string) => {
    const poll = findActivePollByChatId(chatId);
    if (!poll) return;

    const inlineKeyboard = []
    inlineKeyboard.push([ { text: 'Не изменилось ➡️', callback_data: `next${chatId}` } ]);
    if (!poll.isFirstQuestion())
    {
        inlineKeyboard.push([ { text: 'К предыдущему ⬅️', callback_data: `previous${chatId}` } ]);
    }

    const message = await bot.telegram.sendMessage(chatId, text, {
        reply_markup: {
            inline_keyboard: inlineKeyboard
        }
    });
    session.lastMessageId = message.message_id;
    return message;
}

const getSummaryMessages = async (): Promise<any> => {
    const summaryByCurrency = await service.getLatestSummaryByCurrency(EQUIVALENCE_CURRENCY);
    if (!summaryByCurrency) {
        return null;
    }
    const { byCurrency, equivalence, date } = summaryByCurrency;

    let summaryText;
    let equivalenceText;
    const previousSummaryByCurrency = await service.getPreviousSummaryByCurrency(EQUIVALENCE_CURRENCY);
    if (!previousSummaryByCurrency) {
        summaryText = formatSummaryByCurrency(byCurrency);
        equivalenceText = formatEquivalence(equivalence);
    } else {
        const {
            byCurrency: byCurrencyOld,
            equivalence: equivalenceOld
        } = previousSummaryByCurrency;
        summaryText = formatSummaryByCurrency(byCurrency, byCurrencyOld);
        equivalenceText = formatEquivalence(equivalence, equivalenceOld);
    }

    return { summaryText, equivalenceText, date: formatDate(date) };
}

const finalisePoll = async (chatId: number, poll: Poll, session: BudgetBuddySession) => {
    await bot.telegram.sendMessage(
        chatId,
        `📝 Я запомнил ваши значения. Теперь мы ждем когда другие участники подсчета закончат ввод значений и после этого, я пришлю вам результаты.`
    );

    for(const answer of poll.answers) {
        await service.setPollValue(poll.pollId, answer.id, answer.text);
    }
    const allSet = await service.checkAllValuesSet(poll.pollId);
    if (allSet) {
        await service.completePoll(poll.pollId);
        const recipients = await service.getAllRecipients();
        const { summaryText, equivalenceText, date } = await getSummaryMessages();
        const message = `Подсчет завершен 👏 Сводный отчет по состоянию на ${date}:\n\n${summaryText}\n${equivalenceText}`;
        for (const chatId of recipients) {
            await bot.telegram.sendMessage(chatId, message,{
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Посмотреть график 📊', callback_data: 'chart'}]
                    ]
                }
            });
        }
    }
}

const processValue = async (chatId: number, session: BudgetBuddySession, text?: string) => {
    const poll = findActivePollByChatId(chatId);
    if (!poll) return;

    const value = text || poll.getCurrentQuestion().data.previousValue.toString();
    let evalValue;
    try {
        evalValue = mexp.eval(value);
    } catch (e) {
        await bot.telegram.sendMessage(chatId, 'Неверное значение');
        await sendQuestion(session, chatId, poll.getCurrentQuestion().text);
        return;
    }

    poll.saveAnswer(evalValue);
    await bot.telegram.editMessageReplyMarkup(chatId, session.lastMessageId, undefined, {
        inline_keyboard: []
    })
    await bot.telegram.sendMessage(
        chatId,
        `Сохранено значение ${evalValue}`
    );

    if (poll.isActive) {
        await sendQuestion(session, chatId, poll.getCurrentQuestion().text);
    } else {
        await finalisePoll(chatId, poll, session);
    }
}

bot.command('start', async (ctx: any) => {
    const chatId = ctx.message.chat.id;

    // Check if user already has started a poll
    const activePoll = findActivePollByChatId(chatId);
    if (activePoll)
    {
        await ctx.reply('Вы уже находитесь в режиме подсчета');
        await sendQuestion(ctx.session, chatId, activePoll.getCurrentQuestion().text);
        return;
    }

    // Check if there are polls started by other users
    const currentPolls = await service.getNotCompletedPolls();
    let pollId: number;
    if (currentPolls.length) {
        const currentPoll = currentPolls[0];
        pollId = currentPoll.id;
        const createdAt = formatPollDateTime(currentPoll.createdAt);
        const createdBy = formatUserName(currentPoll.createdBy);
        await ctx.reply(
            `Вы добавились к подсчету созданном ${createdAt} пользователем ${createdBy}`
        );
    }
    else
    {
        const newPoll = await service.createPoll(chatId.toString());
        pollId = newPoll.id;

        await ctx.reply('Вы создали новый подсчет');

        const recipients= (await service.getAllRecipients())
            .filter((r) => r !== chatId.toString());
        const createdBy = formatUserName(newPoll.createdBy);
        for (const recipient of recipients) {
            await bot.telegram.sendMessage(
                recipient,
                `Пользователь ${createdBy} начал новый подсчет. Чтобы присоединиться, введите команду /start`
            );
        }
    }

    const vaults = await service.getUserVaults(chatId.toString());
    const pollItems = vaults
            .map((vault: any) => {
                const previousValue = vault.amount;
                return {
                    id: vault.id,
                    text: `${vault.title} ${vault.currency} (${previousValue === undefined ? '?' : previousValue})`,
                    data: { previousValue }
                }
            });

    if (!pollItems.length)
    {
        await ctx.reply('У вас нет счетов для подсчета. Пожалуйста, добавьте их с помощью команды /create');
        return;
    }

    const poll = new Poll(chatId, pollId, pollItems);
    appendPoll(poll);
    await sendQuestion(ctx.session, chatId, poll.getCurrentQuestion().text);
})

bot.command('summary', async (ctx: any) => {
    let summaryMessages: any = {};
    await ctx.persistentChatAction('typing', async () => {
        summaryMessages = await getSummaryMessages();
    });
    const { summaryText, equivalenceText, date } = summaryMessages;

    await ctx.reply(
        `Сводный отчет по состоянию на ${date}:\n\n${summaryText}\n${equivalenceText}`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Посмотреть график 📊', callback_data: 'chart'}]
                ]
            }
        }
    );
})

bot.command('vaults', async (ctx: any) => {
    const vaults = await service.getUserVaults(ctx.message.chat.id.toString());
    if (!vaults.length) {
        await ctx.reply('Вы еще не добавили ни одного счета');
        return;
    }

    const vaultsText = vaults.map(vault =>
        `${vault.title} (${vault.amount === undefined ? '?' : vault.amount} ${vault.currency})`
    ).join('\n');
    await ctx.reply(`Ваши счета:\n\n${vaultsText}`);
})

bot.command('create', async (ctx: any) => {
    await ctx.scene.enter('createVault');
})

bot.command('edit', async (ctx: any) => {
    await ctx.scene.enter('editVault');
})

bot.on('text', async (ctx: any) => {
    const {
        message: {
            text,
            chat: { id: chatId }
        },
        session
    } = ctx;

    await processValue(chatId, session, text);
});

bot.action(/next+/, async (ctx: any) => {
    const chatId = parseInt(ctx.match.input.substring(4));
    await processValue(chatId, ctx.session);
    ctx.answerCbQuery();
});

bot.action(/previous+/, async (ctx: any) => {
    const chatId = parseInt(ctx.match.input.substring(8));
    const poll = findActivePollByChatId(chatId);
    if (!poll) return;
    poll.goToPreviousQuestion();
    await sendQuestion(ctx.session, chatId, poll.getCurrentQuestion().text);
    ctx.answerCbQuery();
});

bot.action('chart', async (ctx: any) => {
    ctx.editMessageReplyMarkup({  inline_keyboard: [] })
    await ctx.scene.enter('chart');
})

telegram.setMyCommands([
    {command: 'start', description: 'Начать подсчет'},
    {command: 'summary', description: 'Получить сводный отчет'},
    {command: 'vaults', description: 'Посмотреть свои счета'},
    {command: 'create', description: 'Создать новый счет'},
    {command: 'edit', description: 'Редактировать существующий счет'}
])
bot.launch();

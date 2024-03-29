import 'dotenv/config';
import { Scenes, session, Telegraf } from 'telegraf';
import {
    createColumn,
    getPaymentSources,
    setValue,
    checkAllValuesSet,
    getAllRecipients,
    getLatestSummaryByCurrency,
    getLatestValues,
    getPreviousSummaryByCurrency
} from './src/spreadsheets';
import { Pool, appendPool, findActivePoolByChatId } from './src/pools';
import { formatSummaryByCurrency, formatEquivalence } from './src/formatters';
import { getAuth, storeNewToken } from './src/spreadsheets/auth';
import { OAuth2Client } from 'google-auth-library';
import { BudgetBuddyContext, BudgetBuddySession } from './src/types/session';
import { ChartScene } from './src/scenes/chart';
// @ts-ignore
import mexp from 'math-expression-evaluator';
import {Currency} from "current-currency/dist/types/currencies";

const API_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const PORT = process.env.PORT || 3000;
const URL = process.env.URL || 'https://budget-buddy-bot.herokuapp.com';
const EQUIVALENCE_CURRENCY = (process.env.EQUIVALENCE_CURRENCY) as Currency || 'USD';
const STAGE_TTL = 100;

const bot = new Telegraf<BudgetBuddyContext>(process.env.TELEGRAM_BOT_TOKEN || '');
const stage = new Scenes.Stage<BudgetBuddyContext>(
    [
        new ChartScene(bot, EQUIVALENCE_CURRENCY)
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

const authorizeSpreadsheets = async (chatId: number, session: BudgetBuddySession) => {
    session.auth = await getAuth(async (authUrl: string) => {
        session.isWaitingForCode = true;
        await bot.telegram.sendMessage(chatId,
            '🤖 Кажется, я не могу получить доступ к вашей Google Spreadsheet таблице.\nПожалуйста, авторизуруйтесь в Google, нажав на кнопку ниже и пришлите мне токен аутентификации.',
            {
                reply_markup: {
                    inline_keyboard: [
                        [ { text: 'Аутентифицироваться в Google', url: authUrl } ]
                    ]
                }
            });
    });
    return session.auth;
}

const sendQuestion = (chatId: number, text: string) => {
    return bot.telegram.sendMessage(chatId, text, {
        reply_markup: {
            inline_keyboard: [
                [ { text: 'Не изменилось', callback_data: `next${chatId}` } ]
            ]
        }
    });
}

const getSummaryMessages = async (auth: OAuth2Client): Promise<any> => {
    const summaryByCurrency = await getLatestSummaryByCurrency(auth, EQUIVALENCE_CURRENCY);
    if (!summaryByCurrency) {
        return null;
    }
    const { byCurrency, equivalence, date } = summaryByCurrency;

    let summaryText;
    let equivalenceText;
    const previousSummaryByCurrency = await getPreviousSummaryByCurrency(auth, EQUIVALENCE_CURRENCY);
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

    return { summaryText, equivalenceText, date };
}

const finalisePool = async (chatId: number, pool: Pool, session: BudgetBuddySession) => {
    await bot.telegram.sendMessage(
        chatId,
        `📝 Я запомнил ваши значения. Теперь мы ждем когда другие участники подсчета закончат ввод значений и после этого, я пришлю вам результаты.`
    );

    let auth;
    try {
        auth = await authorizeSpreadsheets(chatId, session);
    } catch (err) {}
    if (!auth) return;

    const column = await createColumn(auth);
    for(const answer of pool.answers) {
        await setValue(auth, column, answer.id, answer.text);
    }
    const allSet = await checkAllValuesSet(auth, column);
    if (allSet) {
        const recipients = await getAllRecipients(auth);
        const { summaryText, equivalenceText, date } = await getSummaryMessages(auth);
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
    const pool = findActivePoolByChatId(chatId);
    if (!pool) return;

    const value = text || pool.getCurrentQuestion().data.previousValue.toString();
    let evalValue;
    try {
        evalValue = mexp.eval(value);
    } catch (e) {
        await bot.telegram.sendMessage(chatId, 'Неверное значение');
        await sendQuestion(chatId, pool.getCurrentQuestion().text);
        return;
    }

    pool.saveAnswer(evalValue);
    await bot.telegram.sendMessage(
        chatId,
        `Сохранено значение ${evalValue}`
    );

    if (pool.isActive) {
        await sendQuestion(chatId, pool.getCurrentQuestion().text);
    } else {
        await finalisePool(chatId, pool, session);
    }
}

bot.command('start', async (ctx: any) => {
    const chatId = ctx.message.chat.id;

    let auth;
    try {
        auth = await authorizeSpreadsheets(chatId, ctx.session);
    } catch (err) {}
    if (!auth) return;

    const paymentSources = await getPaymentSources(auth);
    const latestValues = await getLatestValues(auth);
    const userPaymentSources = paymentSources
            .filter((source: any) => parseInt(source.chatId) === chatId)
            .map((source: any) => ({
                id: source.id,
                text: `${source.name} ${source.currency} (${latestValues[source.id]})`,
                data: { previousValue: latestValues[source.id] }
            }));

    if (userPaymentSources.length) {
        const pool = new Pool(chatId, userPaymentSources);
        appendPool(pool);
        await sendQuestion(chatId, pool.getCurrentQuestion().text);
    }
})

bot.command('summary', async (ctx: any) => {
    const chatId = ctx.message.chat.id;

    let auth;
    try {
        auth = await authorizeSpreadsheets(chatId, ctx.session);
    } catch (err) {}
    if (!auth) return;

    const { summaryText, equivalenceText, date } = await getSummaryMessages(auth);
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

bot.on('text', async (ctx: any) => {
    const {
        message: {
            text,
            chat: { id: chatId }
        },
        session
    } = ctx;

    if (session.isWaitingForCode) {
        await storeNewToken(text);
        ctx.session.isWaitingForCode = false;
        ctx.reply('🤖 Сработало! Теперь можете выполнить команду.');
    }

    await processValue(chatId, session, text);
});

bot.action(/next+/, async (ctx: any) => {
    const chatId = parseInt(ctx.match.input.substring(4));
    await processValue(chatId, ctx.session);
});

bot.action('chart', async (ctx: any) => {
    await ctx.scene.enter('chart');
});

if (process.env.NODE_ENV === 'production') {
    bot.telegram.setWebhook(`${URL}/bot${API_TOKEN}`);
    // @ts-ignore
    bot.startWebhook(`/bot${API_TOKEN}`, null, PORT);
} else {
    bot.launch();
}
